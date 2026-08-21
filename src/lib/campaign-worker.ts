/**
 * Fila de disparo no Postgres: cada destinatário é um job.
 * Sem Redis — `FOR UPDATE SKIP LOCKED` + um worker no processo do Next.
 */

import { prisma } from "@/lib/prisma";
import { evolutionSendText, evolutionSendMedia, evolutionNumberExists } from "@/lib/evolution";
import {
  pickRandomInstance,
  poolBlockInfo,
  computeCampaignDelay,
  recordSendSuccess,
  recordSendFailure,
  classifySendError,
  formatSendError,
  instanceHealth,
  personalizeCampaignMessage,
  composingDelayMs,
  msUntilCampaignWindow,
  formatBrasiliaTime,
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
  | { kind: "ok"; delayMs: number }
  | { kind: "paused" }
  | { kind: "wait"; waitMs: number; reason: string };

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

export async function syncCampaignStatus(campaignId: string) {
  const open = await prisma.campaignRun.findMany({
    where: { campaignId, status: { in: ["RUNNING", "PAUSED"] } },
    select: { status: true },
  });
  let status: CampaignStatus = "DRAFT";
  if (open.some((r) => r.status === "RUNNING")) status = "RUNNING";
  else if (open.some((r) => r.status === "PAUSED")) status = "PAUSED";
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status, ...(status === "DRAFT" ? { lastRunAt: new Date() } : {}) },
  });
}

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
      const quietMs = msUntilCampaignWindow();
      if (quietMs > 0) {
        const running = await prisma.campaignRun.findFirst({
          where: { status: "RUNNING" },
          select: { id: true },
        });
        if (!running) break;
        const when = formatBrasiliaTime(quietMs);
        const waitReason = `Horário de proteção: disparos só das 8h às 19h (Brasília). Continua às ${when}.`;
        await markRunningWaits(quietMs, waitReason);
        await sleep(Math.min(quietMs, 10 * 60_000));
        continue;
      }

      const job = await claimNextJob();
      if (!job) break;

      const outcome = await processJob(job);
      if (outcome.kind === "paused") continue;
      if (outcome.kind === "wait") {
        await markRunWait(job.runId, outcome.waitMs, outcome.reason);
        await sleep(Math.min(outcome.waitMs, 10 * 60_000));
        continue;
      }

      await maybeFinalizeRun(job.runId);
      const stillRunning = await prisma.campaignRun.findFirst({
        where: { id: job.runId, status: "RUNNING" },
        select: { id: true },
      });
      if (stillRunning) {
        await sleep(outcome.delayMs);
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
      WITH user_wait AS (
        SELECT
          COALESCE(r."createdByUserId", '') AS uid,
          MAX(cc."sentAt") AS last_sent
        FROM "CampaignRun" r
        INNER JOIN "CampaignContact" cc ON cc."runId" = r.id
        WHERE r.status = 'RUNNING'::"CampaignStatus"
        GROUP BY 1
        HAVING COUNT(*) FILTER (WHERE cc.status = 'pending') > 0
      ),
      next_user AS (
        SELECT uid FROM user_wait
        ORDER BY last_sent NULLS FIRST, uid ASC
        LIMIT 1
      )
      SELECT cc.id
      FROM "CampaignContact" cc
      INNER JOIN "CampaignRun" r ON r.id = cc."runId"
      WHERE cc.status = 'pending'
        AND r.status = 'RUNNING'::"CampaignStatus"
        AND COALESCE(r."createdByUserId", '') = (SELECT uid FROM next_user)
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
    return { kind: "ok", delayMs: 8_000 };
  }

  const quietNow = msUntilCampaignWindow();
  if (quietNow > 0) {
    await prisma.campaignContact.update({
      where: { id: job.id },
      data: { status: "pending", claimedAt: null },
    });
    return {
      kind: "wait",
      waitMs: quietNow,
      reason: `Horário de proteção: disparos só das 8h às 19h (Brasília). Continua às ${formatBrasiliaTime(quietNow)}.`,
    };
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
    if (info && (info.kind === "hourly" || info.kind === "daily" || info.kind === "quiet" || info.kind === "cooldown")) {
      const until = new Date(Date.now() + info.waitMs);
      const when = until.toLocaleTimeString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
      });
      const waitReason = `${info.reason} Continua às ${when}.`;
      console.log("[CampaignWorker] aguardando janela", {
        runId: job.runId,
        waitMs: info.waitMs,
        waitReason,
      });
      return { kind: "wait", waitMs: info.waitMs, reason: waitReason };
    }
    const reason = info?.reason || "Instância indisponível no momento.";
    console.warn("[CampaignWorker] pausando disparo:", job.runId, reason);
    await pauseRun(job.runId, campaign.id, reason);
    return { kind: "paused" };
  }

  const exists = await evolutionNumberExists(job.phone, {
    instanceName: picked.instanceName,
    token: picked.token || undefined,
  });
  if (exists === false) {
    console.log("[CampaignWorker] sem WhatsApp, descartado", { runId: job.runId, phone: job.phone });
    await prisma.campaignContact.update({
      where: { id: job.id },
      data: {
        status: "skipped",
        errorKind: "invalid_number",
        errorMsg: "Sem WhatsApp — descartado.",
      },
    });
    await prisma.campaignRun.update({
      where: { id: job.runId },
      data: { skipped: { increment: 1 } },
    });
    return { kind: "ok", delayMs: 5_000 };
  }
  if (exists !== true) {
    console.warn("[CampaignWorker] WhatsApp não confirmado, não envia", { runId: job.runId, phone: job.phone });
    await prisma.campaignContact.update({
      where: { id: job.id },
      data: { status: "pending", claimedAt: null },
    });
    return { kind: "ok", delayMs: 15_000 };
  }

  let inboxId: string | null = null;
  const health = instanceHealth(picked, profile);
  const text = personalizeCampaignMessage(campaign.message, job.name);
  const typing = composingDelayMs(text);
  const delayMs = computeCampaignDelay(job.run.sent + job.run.failed, profile, health.hourly);

  try {
    const mediaUrl = await mediaUrlForRun(job.run);
    const inbox = await prepareMassOutbound({
      organizationId: campaign.organizationId,
      phone: job.phone,
      name: job.name,
      body: text,
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
        caption: text,
        instanceName: picked.instanceName,
        instanceToken: picked.token || undefined,
        delayMs: typing,
      });
    } else {
      result = await evolutionSendText({
        number: job.phone,
        text,
        instanceName: picked.instanceName,
        instanceToken: picked.token || undefined,
        delayMs: typing,
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
    console.log("[CampaignWorker] enviado", {
      runId: job.runId,
      userId: job.run.createdByUserId,
      phone: job.phone,
      delayMs,
      typing,
    });
    return { kind: "ok", delayMs };
  } catch (error) {
    if (inboxId) await revertMassOutbound(inboxId);
    const errMsg = error instanceof Error ? error.message : "Erro desconhecido";
    const kind = classifySendError(errMsg);
    console.warn("[CampaignWorker] falha", { runId: job.runId, phone: job.phone, kind, errMsg });
    if (kind === "invalid_number") {
      await prisma.campaignContact.update({
        where: { id: job.id },
        data: {
          status: "skipped",
          errorKind: "invalid_number",
          errorMsg: "Sem WhatsApp — descartado.",
        },
      });
      await prisma.campaignRun.update({
        where: { id: job.runId },
        data: { skipped: { increment: 1 } },
      });
      return { kind: "ok", delayMs: 5_000 };
    }

    await recordSendFailure(picked.id, errMsg);
    await prisma.campaignContact.update({
      where: { id: job.id },
      data: { status: "failed", errorKind: kind, errorMsg: formatSendError(errMsg) },
    });

    const stopNow =
      kind === "blocked" ||
      /connection closed|restricted|banned|forbidden/i.test(errMsg);
    const updated = await prisma.campaignRun.update({
      where: { id: job.runId },
      data: {
        failed: { increment: 1 },
        consecutiveFailures: { increment: 1 },
      },
    });

    if (stopNow || updated.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      await pauseRun(
        job.runId,
        campaign.id,
        stopNow
          ? "WhatsApp restringiu o número. Pare o disparo, reconecte e só retome amanhã das 8h às 19h."
          : `Pausa automática: ${updated.consecutiveFailures} falhas seguidas. Verifique a instância e a lista.`
      );
      return { kind: "paused" };
    }
    return { kind: "ok", delayMs };
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

async function markRunWait(runId: string, waitMs: number, reason: string) {
  const until = new Date(Date.now() + waitMs);
  await prisma.campaignRun.update({
    where: { id: runId },
    data: { waitUntil: until, waitReason: reason, status: "RUNNING" },
  });
}

async function markRunningWaits(waitMs: number, reason: string, organizationId?: string) {
  const until = new Date(Date.now() + waitMs);
  await prisma.campaignRun.updateMany({
    where: {
      status: "RUNNING",
      ...(organizationId ? { campaign: { organizationId } } : {}),
    },
    data: { waitUntil: until, waitReason: reason },
  });
}

async function pauseRun(runId: string, campaignId: string, reason: string) {
  await prisma.campaignRun.update({
    where: { id: runId },
    data: { status: "PAUSED", pauseReason: reason, waitUntil: null, waitReason: null },
  });
  await syncCampaignStatus(campaignId);
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
  await syncCampaignStatus(run.campaignId);
  mediaByRun.delete(runId);
}

export async function pauseCampaignRun(runId: string, reason = "Pausado pelo consultor") {
  const run = await prisma.campaignRun.findUnique({ where: { id: runId } });
  if (!run) throw new Error("Execução não encontrada");
  if (run.status !== "RUNNING") throw new Error("Este disparo não está em andamento");
  await pauseRun(runId, run.campaignId, reason);
}

export async function stopCampaignRun(runId: string) {
  const run = await prisma.campaignRun.findUnique({ where: { id: runId } });
  if (!run) throw new Error("Execução não encontrada");
  if (run.status === "DONE" || run.status === "CANCELLED") {
    throw new Error("Este disparo já terminou");
  }

  await prisma.campaignContact.updateMany({
    where: { runId, status: { in: ["pending", "sending"] } },
    data: { status: "skipped", errorKind: "cancelled", errorMsg: "Parado pelo consultor" },
  });

  const [sent, failed, skipped] = await Promise.all([
    prisma.campaignContact.count({ where: { runId, status: { in: ["sent", "delivered", "read"] } } }),
    prisma.campaignContact.count({ where: { runId, status: "failed" } }),
    prisma.campaignContact.count({ where: { runId, status: "skipped" } }),
  ]);

  await prisma.campaignRun.update({
    where: { id: runId },
    data: {
      status: "CANCELLED",
      sent,
      failed,
      skipped,
      finishedAt: new Date(),
      waitUntil: null,
      waitReason: null,
      pauseReason: "Parado pelo consultor",
    },
  });
  await syncCampaignStatus(run.campaignId);
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
  await syncCampaignStatus(run.campaignId);
  startCampaignWorker();
}
