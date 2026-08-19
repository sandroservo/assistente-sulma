/**
 * Fila de disparo no Postgres: cada destinatário é um job.
 * Sem Redis — `FOR UPDATE SKIP LOCKED` + um worker no processo do Next.
 */

import { prisma } from "@/lib/prisma";
import { evolutionSendText, evolutionSendMedia } from "@/lib/evolution";
import {
  pickRandomInstance,
  poolBlockInfo,
  computePacedDelay,
  recordSendSuccess,
  recordSendFailure,
  classifySendError,
  formatSendError,
  type AntiBlockProfile,
} from "@/lib/anti-block";
import { saveMedia } from "@/lib/media-storage";
import {
  confirmMassOutbound,
  extractEvolutionMessageId,
  prepareMassOutbound,
  revertMassOutbound,
} from "@/lib/mass-inbox";
import { isSuppressed } from "@/lib/suppression";
import type { Campaign, CampaignContact, CampaignRun, CampaignStatus } from "@prisma/client";

const MAX_CONSECUTIVE_FAILURES = 5;
const STALE_CLAIM_MS = 3 * 60 * 1000;

type JobResult =
  | { kind: "ok"; hourlyLimit: number }
  | { kind: "paused" }
  | { kind: "wait"; waitMs: number };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeProfile(p: string): AntiBlockProfile {
  return (["conservative", "balanced", "aggressive"] as const).includes(p as AntiBlockProfile)
    ? (p as AntiBlockProfile)
    : "balanced";
}

type ClaimedJob = CampaignContact & {
  run: CampaignRun & { campaign: Campaign };
};

let busy = false;
const mediaByRun = new Map<string, string | null>();

export function startCampaignWorker() {
  if (busy) return;
  processCampaignQueue().catch((err) => console.error("[CampaignWorker]", err));
}

export async function processCampaignQueue() {
  if (busy) return;
  busy = true;
  try {
    await reclaimStaleJobs();
    await resumeRateLimitedRuns();
    while (true) {
      const job = await claimNextJob();
      if (!job) break;

      const outcome = await processJob(job);
      if (outcome.kind === "paused") continue;
      if (outcome.kind === "wait") {
        await sleep(outcome.waitMs);
        await prisma.campaignRun
          .update({
            where: { id: job.runId },
            data: { waitUntil: null, waitReason: null },
          })
          .catch(() => undefined);
        continue;
      }

      await maybeFinalizeRun(job.runId);
      const stillRunning = await prisma.campaignRun.findFirst({
        where: { id: job.runId, status: "RUNNING" },
        select: { id: true },
      });
      if (stillRunning) {
        await sleep(computePacedDelay(outcome.hourlyLimit));
      }
    }
  } finally {
    busy = false;
  }
}

async function resumeRateLimitedRuns() {
  const paused = await prisma.campaignRun.findMany({
    where: {
      status: "PAUSED",
      OR: [
        { pauseReason: { contains: "Limite horário" } },
        { pauseReason: { contains: "Limite diário" } },
      ],
    },
    select: { id: true, campaignId: true },
  });
  if (!paused.length) return;
  await prisma.campaignRun.updateMany({
    where: { id: { in: paused.map((r) => r.id) } },
    data: {
      status: "RUNNING",
      pauseReason: null,
      consecutiveFailures: 0,
      waitUntil: null,
      waitReason: null,
    },
  });
  await prisma.campaign.updateMany({
    where: { id: { in: [...new Set(paused.map((r) => r.campaignId))] } },
    data: { status: "RUNNING" },
  });
  console.log("[CampaignWorker] retomando lotes pausados por limite de hora/dia:", paused.length);
}

async function reclaimStaleJobs() {
  const stale = new Date(Date.now() - STALE_CLAIM_MS);
  await prisma.campaignContact.updateMany({
    where: { status: "sending", claimedAt: { lt: stale } },
    data: { status: "pending", claimedAt: null },
  });
}

async function claimNextJob(): Promise<ClaimedJob | null> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT cc.id
      FROM "CampaignContact" cc
      INNER JOIN "CampaignRun" r ON r.id = cc."runId"
      WHERE cc.status = 'pending'
        AND r.status = 'RUNNING'::"CampaignStatus"
      ORDER BY r."startedAt" ASC, cc.id ASC
      LIMIT 1
      FOR UPDATE OF cc SKIP LOCKED
    `;
    if (!rows[0]) return null;
    return tx.campaignContact.update({
      where: { id: rows[0].id },
      data: { status: "sending", claimedAt: new Date() },
      include: { run: { include: { campaign: true } } },
    });
  });
}

async function processJob(job: ClaimedJob): Promise<JobResult> {
  const campaign = job.run.campaign;
  const profile = safeProfile(campaign.profile);

  if (await isSuppressed(campaign.organizationId, job.phone)) {
    await prisma.campaignContact.update({
      where: { id: job.id },
      data: { status: "skipped", errorKind: "opt_out", errorMsg: "Lista de não contato" },
    });
    await prisma.campaignRun.update({
      where: { id: job.runId },
      data: { skipped: { increment: 1 }, consecutiveFailures: 0 },
    });
    return { kind: "ok", hourlyLimit: 100 };
  }

  const pool = await prisma.instance.findMany({
    where: { organizationId: campaign.organizationId, status: "CONNECTED" },
  });
  const picked = pickRandomInstance(pool, profile);
  if (!picked) {
    await prisma.campaignContact.update({
      where: { id: job.id },
      data: { status: "pending", claimedAt: null },
    });
    const info = poolBlockInfo(pool, profile);
    if (info && (info.kind === "hourly" || info.kind === "daily")) {
      const until = new Date(Date.now() + info.waitMs);
      const when = until.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const waitReason = `${info.reason} Continua às ${when}.`;
      console.log("[CampaignWorker] aguardando janela", {
        runId: job.runId,
        waitMs: info.waitMs,
        waitReason,
      });
      await prisma.campaignRun.update({
        where: { id: job.runId },
        data: { waitUntil: until, waitReason, status: "RUNNING" },
      });
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: "RUNNING" },
      });
      return { kind: "wait", waitMs: info.waitMs };
    }
    const reason = info?.reason || "Instância indisponível no momento.";
    console.warn("[CampaignWorker] pausando disparo:", job.runId, reason);
    await pauseRun(job.runId, campaign.id, reason);
    return { kind: "paused" };
  }

  let inboxId: string | null = null;
  try {
    const mediaUrl = await mediaUrlForRun(job.run);
    const inbox = await prepareMassOutbound({
      organizationId: campaign.organizationId,
      phone: job.phone,
      name: job.name,
      body: campaign.message,
      mediaUrl,
      type: mediaUrl ? "image" : "text",
      source: "campaign",
      sourceLabel: campaign.name,
    });
    inboxId = inbox.messageId;

    let result: unknown;
    if (campaign.mediaBase64) {
      result = await evolutionSendMedia({
        number: job.phone,
        mediatype: "image",
        media: campaign.mediaBase64,
        mimetype: campaign.mediaMimeType || "image/jpeg",
        caption: campaign.message,
        instanceName: picked.instanceName,
        instanceToken: picked.token || undefined,
      });
    } else {
      result = await evolutionSendText({
        number: job.phone,
        text: campaign.message,
        instanceName: picked.instanceName,
        instanceToken: picked.token || undefined,
      });
    }

    const providerId = extractEvolutionMessageId(result);
    await confirmMassOutbound(inboxId, providerId);
    await recordSendSuccess(picked.id);
    await prisma.campaignContact.update({
      where: { id: job.id },
      data: { status: "sent", providerId, sentAt: new Date() },
    });
    await prisma.campaignRun.update({
      where: { id: job.runId },
      data: { sent: { increment: 1 }, consecutiveFailures: 0 },
    });
    console.log("[CampaignWorker] enviado", { runId: job.runId, phone: job.phone });
    return { kind: "ok", hourlyLimit: picked.hourlyLimit || 100 };
  } catch (error) {
    if (inboxId) await revertMassOutbound(inboxId);
    const errMsg = error instanceof Error ? error.message : "Erro desconhecido";
    const kind = classifySendError(errMsg);
    console.warn("[CampaignWorker] falha", { runId: job.runId, phone: job.phone, kind, errMsg });
    await recordSendFailure(picked.id, errMsg);
    await prisma.campaignContact.update({
      where: { id: job.id },
      data: { status: "failed", errorKind: kind, errorMsg: formatSendError(errMsg) },
    });

    const tripCircuit = kind !== "invalid_number";
    const updated = await prisma.campaignRun.update({
      where: { id: job.runId },
      data: {
        failed: { increment: 1 },
        ...(tripCircuit ? { consecutiveFailures: { increment: 1 } } : {}),
      },
    });

    if (tripCircuit && updated.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      await pauseRun(
        job.runId,
        campaign.id,
        `Pausa automática: ${updated.consecutiveFailures} falhas seguidas. Verifique a instância e a lista.`
      );
      return { kind: "paused" };
    }
    return { kind: "ok", hourlyLimit: picked.hourlyLimit || 100 };
  }
}

async function mediaUrlForRun(run: CampaignRun & { campaign: Campaign }): Promise<string | null> {
  if (mediaByRun.has(run.id)) return mediaByRun.get(run.id) ?? null;
  let url: string | null = null;
  if (run.campaign.mediaBase64) {
    try {
      url = await saveMedia(run.campaign.mediaBase64, run.campaign.mediaMimeType || "image/jpeg");
    } catch (e) {
      console.error("[CampaignWorker] mídia:", e);
    }
  }
  mediaByRun.set(run.id, url);
  return url;
}

async function pauseRun(runId: string, campaignId: string, reason: string) {
  await prisma.campaignRun.update({
    where: { id: runId },
    data: { status: "PAUSED", pauseReason: reason, waitUntil: null, waitReason: null },
  });
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "PAUSED" },
  });
}

async function maybeFinalizeRun(runId: string) {
  const open = await prisma.campaignContact.count({
    where: { runId, status: { in: ["pending", "sending"] } },
  });
  if (open > 0) return;
  const run = await prisma.campaignRun.findUnique({
    where: { id: runId },
    include: { campaign: true },
  });
  if (!run || run.status === "DONE" || run.status === "CANCELLED") return;
  if (run.status === "PAUSED") return;

  await prisma.campaignRun.update({
    where: { id: runId },
    data: { status: "DONE", finishedAt: new Date(), waitUntil: null, waitReason: null },
  });
  await prisma.campaign.update({
    where: { id: run.campaignId },
    data: { lastRunAt: new Date(), status: "DRAFT" as CampaignStatus },
  });
  mediaByRun.delete(runId);
}

export async function resumeCampaignRun(runId: string) {
  const run = await prisma.campaignRun.findUnique({
    where: { id: runId },
    include: { campaign: true },
  });
  if (!run) throw new Error("Execução não encontrada");
  if (run.status !== "PAUSED") throw new Error("Esta execução não está pausada");

  await prisma.campaignContact.updateMany({
    where: { runId, status: "sending" },
    data: { status: "pending", claimedAt: null },
  });
  await prisma.campaignRun.update({
    where: { id: runId },
    data: { status: "RUNNING", pauseReason: null, consecutiveFailures: 0, waitUntil: null, waitReason: null },
  });
  await prisma.campaign.update({
    where: { id: run.campaignId },
    data: { status: "RUNNING" },
  });
  startCampaignWorker();
}
