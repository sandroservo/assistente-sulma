/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Worker standalone de envio de campanhas (RabbitMQ). Roda FORA do Next.js
 * (PM2/systemd): `tsx src/workers/campaign-sender.ts`.
 *
 * prefetch=1, ack manual. Nunca segura a mensagem em wait longo: espera de
 * capacidade/janela vira republish numa retry queue. Idempotente: um contato
 * com providerId já persistido nunca é reenviado.
 *
 * Reusa os leaf helpers do envio legado (anti-block, mass-inbox, evolution,
 * suppression) — o `campaign-worker.ts` legado permanece intacto p/ rollback.
 */

import "dotenv/config";
import type { ConsumeMessage } from "amqplib";
import { prisma } from "@/lib/prisma";
import { getConfirmChannel, sendToQueueConfirm, closeRabbit } from "@/lib/messaging/rabbit";
import { MAIN_QUEUE, retryQueueFor } from "@/lib/messaging/topology";
import { CampaignSendJobV1, CAMPAIGN_SEND_EVENT } from "@/lib/messaging/contracts";
import {
  pickRandomInstance,
  poolBlockInfo,
  personalizeCampaignMessage,
  composingDelayMs,
  msUntilCampaignWindow,
  recordSendSuccess,
  recordSendFailure,
  classifySendError,
  formatSendError,
  type AntiBlockProfile,
} from "@/lib/anti-block";
import {
  prepareMassOutbound,
  confirmMassOutbound,
  revertMassOutbound,
  extractEvolutionMessageId,
} from "@/lib/mass-inbox";
import { isSuppressed } from "@/lib/suppression";
import { spin } from "@/lib/spintax";
import { generateVariations } from "@/lib/message-variations";
import { evolutionSendText, evolutionSendMedia, evolutionNumberExists } from "@/lib/evolution";
import { saveMedia } from "@/lib/media-storage";

const MAX_ATTEMPTS = Number(process.env.CAMPAIGN_MAX_ATTEMPTS || 5);
const WORKER = process.env.CAMPAIGN_WORKER_NAME || "campaign-sender-1";
const SHUTDOWN_TIMEOUT = Number(process.env.CAMPAIGN_WORKER_SHUTDOWN_TIMEOUT_MS || 30_000);
// Lease: um contato em "sending" só pode ser re-clamado após esse tempo (crash mid-send).
// Enquanto dentro do lease, outro worker não rouba o job em andamento (multi-worker safe).
const LEASE_MS = Number(process.env.CAMPAIGN_LEASE_MS || 3 * 60_000);

const mediaByRun = new Map<string, string | null>();
const variationsByRun = new Map<string, string[]>();

/** Texto do envio: pool de variações da IA (se ligado) sorteado, senão o texto; sempre passa pelo spin. */
async function pickMessage(runId: string, aiVariation: boolean, message: string): Promise<string> {
  if (!aiVariation) return spin(message);
  let pool = variationsByRun.get(runId);
  if (!pool) {
    pool = await generateVariations(message);
    variationsByRun.set(runId, pool);
  }
  const base = pool[Math.floor(Math.random() * pool.length)] ?? message;
  return spin(base);
}

type Outcome =
  | { type: "ack" }
  | { type: "retry"; queue: string | null; attempt: number }
  | { type: "dead" };

function safeProfile(p: string): AntiBlockProfile {
  return (["conservative", "balanced", "aggressive"] as const).includes(p as AntiBlockProfile)
    ? (p as AntiBlockProfile)
    : "balanced";
}

function log(event: string, fields: Record<string, unknown>) {
  console.log(JSON.stringify({ service: "campaign-sender", worker: WORKER, event, ...fields }));
}

async function setPending(id: string, notBefore?: Date) {
  await prisma.campaignContact.update({
    where: { id },
    data: { status: "pending", processingAt: null, ...(notBefore ? { notBefore } : {}) },
  });
}

async function markSkipped(id: string, runId: string, kind: string, msg: string) {
  await prisma.campaignContact.update({
    where: { id },
    data: { status: "skipped", errorKind: kind, errorMsg: msg, processingAt: null },
  });
  await prisma.campaignRun.update({ where: { id: runId }, data: { skipped: { increment: 1 } } });
}

async function maybeFinalizeRun(runId: string) {
  const open = await prisma.campaignContact.count({
    where: { runId, status: { in: ["pending", "sending"] } },
  });
  if (open > 0) return;
  const run = await prisma.campaignRun.findUnique({ where: { id: runId }, select: { status: true, campaignId: true } });
  if (!run || ["DONE", "CANCELLED", "PAUSED"].includes(run.status)) return;
  await prisma.campaignRun.update({
    where: { id: runId },
    data: { status: "DONE", finishedAt: new Date(), waitUntil: null, waitReason: null },
  });
  await prisma.campaign.update({ where: { id: run.campaignId }, data: { status: "DONE", lastRunAt: new Date() } });
  mediaByRun.delete(runId);
  variationsByRun.delete(runId);
}

async function mediaUrlForRun(runId: string, base64: string | null, mime: string | null): Promise<string | null> {
  if (mediaByRun.has(runId)) return mediaByRun.get(runId) ?? null;
  let url: string | null = null;
  if (base64) {
    try {
      url = await saveMedia(base64, mime || "image/jpeg");
    } catch (e) {
      log("media_save_failed", { runId, err: String(e) });
    }
  }
  mediaByRun.set(runId, url);
  return url;
}

async function handleJob(job: CampaignSendJobV1): Promise<Outcome> {
  const { campaignContactId: id, runId, attempt, correlationId: cid } = {
    ...job.payload,
    correlationId: job.correlationId,
  };
  const now = new Date();

  // Claim idempotente com lease: processa se está pending, OU se está sending mas
  // o lease expirou (worker anterior morreu). providerId != null => já enviou, nunca reenvia.
  const leaseCutoff = new Date(Date.now() - LEASE_MS);
  const claim = await prisma.campaignContact.updateMany({
    where: {
      id,
      providerId: null,
      OR: [
        { status: "pending" },
        { status: "sending", processingAt: { lt: leaseCutoff } },
      ],
    },
    data: { status: "sending", processingAt: now, attemptCount: attempt + 1, lastAttemptAt: now },
  });
  if (claim.count === 0) {
    // Não conseguiu clamar: ou já é terminal (ack), ou está sendo processado por
    // outro worker dentro do lease (reprograma — NUNCA ack, senão perde a entrega).
    const cur = await prisma.campaignContact.findUnique({
      where: { id },
      select: { status: true, providerId: true },
    });
    const terminal = !cur || cur.providerId != null ||
      ["sent", "delivered", "read", "failed", "skipped"].includes(cur.status);
    if (terminal) {
      log("skip_terminal", { cid, runId, contactId: id, attempt });
      return { type: "ack" };
    }
    log("lease_contention", { cid, runId, contactId: id, attempt });
    return { type: "retry", queue: retryQueueFor(attempt, LEASE_MS), attempt };
  }

  const contact = await prisma.campaignContact.findUnique({
    where: { id },
    include: { run: { include: { campaign: true } } },
  });
  if (!contact) return { type: "ack" };
  const run = contact.run;
  const campaign = run.campaign;
  const profile = safeProfile(campaign.profile);

  // Run não está mais rodando (pause/cancel): não envia. Devolve a pending e
  // LIMPA os marcadores de fila — a mensagem sai da fila (ack), então o resume
  // precisa poder republicá-la (publisher filtra por queuedAt null).
  if (run.status !== "RUNNING") {
    await prisma.campaignContact.update({
      where: { id },
      data: { status: "pending", processingAt: null, queuedAt: null, queueJobId: null },
    });
    log("run_not_running", { cid, runId, status: run.status });
    return { type: "ack" };
  }

  // Janela horária (8h–19h Brasília): republica sem contar como falha.
  const quiet = msUntilCampaignWindow();
  if (quiet > 0) {
    await setPending(id, new Date(Date.now() + quiet));
    return { type: "retry", queue: retryQueueFor(attempt, quiet), attempt };
  }

  // Opt-out revalidado imediatamente antes de enviar.
  if (await isSuppressed(campaign.organizationId, contact.phone)) {
    await markSkipped(id, run.id, "opt_out", "Lista de não contato");
    return { type: "ack" };
  }

  // Instância elegível.
  const pool = await prisma.instance.findMany({
    where: { organizationId: campaign.organizationId, status: "CONNECTED" },
  });
  const picked = pickRandomInstance(pool, profile);
  if (!picked) {
    const info = poolBlockInfo(pool, profile);
    const waitMs = info?.waitMs ?? 60_000;
    await setPending(id, new Date(Date.now() + waitMs));
    log("no_instance", { cid, runId, waitMs, reason: info?.reason });
    return { type: "retry", queue: retryQueueFor(attempt, waitMs), attempt };
  }

  // Número existe no WhatsApp?
  const exists = await evolutionNumberExists(contact.phone, {
    instanceName: picked.instanceName,
    token: picked.token || undefined,
  });
  if (exists === false) {
    await markSkipped(id, run.id, "invalid_number", "Sem WhatsApp — descartado.");
    return { type: "ack" };
  }
  if (exists !== true) {
    await setPending(id);
    return { type: "retry", queue: retryQueueFor(attempt, 15_000), attempt };
  }

  // Envio.
  const text = personalizeCampaignMessage(await pickMessage(run.id, campaign.aiVariation, campaign.message), contact.name);
  const typing = composingDelayMs(text);
  let inboxId: string | null = null;
  try {
    const mediaUrl = await mediaUrlForRun(run.id, campaign.mediaBase64, campaign.mediaMimeType);
    const inbox = await prepareMassOutbound({
      organizationId: campaign.organizationId,
      phone: contact.phone,
      name: contact.name,
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
        number: contact.phone,
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
        number: contact.phone,
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
      where: { id },
      data: { status: "sent", providerId, sentAt: new Date() },
    });
    await prisma.campaignRun.update({
      where: { id: run.id },
      data: { sent: { increment: 1 }, consecutiveFailures: 0 },
    });
    await maybeFinalizeRun(run.id);
    log("sent", { cid, runId: run.id, contactId: id, instanceId: picked.id, attempt });
    return { type: "ack" };
  } catch (error) {
    if (inboxId) await revertMassOutbound(inboxId).catch(() => {});
    const errMsg = error instanceof Error ? error.message : "Erro desconhecido";
    const kind = classifySendError(errMsg);

    if (kind === "invalid_number") {
      await markSkipped(id, run.id, "invalid_number", "Sem WhatsApp — descartado.");
      return { type: "ack" };
    }

    await recordSendFailure(picked.id, errMsg);
    const nextAttempt = attempt + 1;
    const permanentStop = kind === "blocked" || /connection closed|restricted|banned|forbidden/i.test(errMsg);

    if (permanentStop || nextAttempt >= MAX_ATTEMPTS) {
      await prisma.campaignContact.update({
        where: { id },
        data: { status: "failed", errorKind: kind, errorMsg: formatSendError(errMsg), lastQueueError: errMsg.slice(0, 500), processingAt: null },
      });
      await prisma.campaignRun.update({ where: { id: run.id }, data: { failed: { increment: 1 } } });
      await maybeFinalizeRun(run.id);
      log("failed_dead", { cid, runId: run.id, contactId: id, kind, attempt: nextAttempt });
      return { type: "dead" };
    }

    // Transitório: volta a pending e reprograma na retry queue.
    await prisma.campaignContact.update({
      where: { id },
      data: { status: "pending", processingAt: null, lastQueueError: errMsg.slice(0, 500) },
    });
    log("retry", { cid, runId: run.id, contactId: id, kind, attempt: nextAttempt });
    return { type: "retry", queue: retryQueueFor(attempt), attempt: nextAttempt };
  }
}

async function onMessage(msg: ConsumeMessage | null) {
  if (!msg) return;
  const ch = await getConfirmChannel();

  let job: CampaignSendJobV1;
  try {
    job = CampaignSendJobV1.parse(JSON.parse(msg.content.toString()));
  } catch (e) {
    log("invalid_job", { err: String(e) });
    ch.nack(msg, false, false); // → DLX → DLQ
    return;
  }

  try {
    const outcome = await handleJob(job);
    if (outcome.type === "ack") {
      ch.ack(msg);
      return;
    }
    if (outcome.type === "dead") {
      ch.nack(msg, false, false); // → DLX → DLQ
      return;
    }
    // retry: republica na fila de atraso e confirma a original
    if (!outcome.queue) {
      ch.nack(msg, false, false);
      return;
    }
    const next: CampaignSendJobV1 = { ...job, payload: { ...job.payload, attempt: outcome.attempt } };
    await sendToQueueConfirm(outcome.queue, next, {
      messageId: job.payload.jobId,
      correlationId: job.correlationId,
      type: CAMPAIGN_SEND_EVENT,
      attempt: outcome.attempt,
    });
    ch.ack(msg);
  } catch (e) {
    log("handler_error", { cid: job.correlationId, err: String(e) });
    // erro inesperado → não perde a mensagem: manda pra DLQ p/ inspeção
    ch.nack(msg, false, false);
  }
}

async function main() {
  const ch = await getConfirmChannel();
  await ch.prefetch(Number(process.env.RABBITMQ_PREFETCH || 1));
  await ch.consume(MAIN_QUEUE, onMessage, { noAck: false });
  log("ready", { queue: MAIN_QUEUE, maxAttempts: MAX_ATTEMPTS });

  const shutdown = async (sig: string) => {
    log("shutdown", { sig });
    const timer = setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT);
    try {
      await closeRabbit();
      await prisma.$disconnect();
    } finally {
      clearTimeout(timer);
      process.exit(0);
    }
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((e) => {
  log("fatal", { err: String(e) });
  process.exit(1);
});
