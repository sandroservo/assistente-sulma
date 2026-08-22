/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Publisher de jobs de campanha. Um job por CampaignContact pending. Marca
 * queuedAt/queueJobId SOMENTE após publisher confirm — crash antes disso deixa
 * o contato pending e o repair (cron) republica. Roda rápido no Next.js
 * (só publica; o envio longo é do worker).
 *
 * ponytail: MVP usa fila única FIFO. Isso regride a justiça entre consultores
 * do worker legado (um blast grande de um usuário fica na frente do outro).
 * Upgrade path documentado no pacote: routing por instanceId + multi-consumer,
 * ou prioridade por usuário. Não implementar antes de escala real exigir.
 */

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { publishConfirm } from "./rabbit";
import { MAIN_EXCHANGE, ROUTING_SEND } from "./topology";
import { buildCampaignSendJob, CAMPAIGN_SEND_EVENT } from "./contracts";

export interface PublishResult {
  runId: string;
  published: number;
  failed: number;
}

/**
 * Publica todos os contatos pending (ainda não enfileirados) de um run.
 * Idempotente: contatos com queuedAt já setado são ignorados.
 */
export async function publishPendingCampaignContacts(runId: string): Promise<PublishResult> {
  const run = await prisma.campaignRun.findUnique({
    where: { id: runId },
    include: { campaign: { select: { id: true, organizationId: true } } },
  });
  if (!run) throw new Error("Run não encontrado");
  if (run.status !== "RUNNING") {
    // Só publica de runs ativos. PAUSED/CANCELLED/DONE não enfileira.
    return { runId, published: 0, failed: 0 };
  }

  const pending = await prisma.campaignContact.findMany({
    where: { runId, status: "pending", queuedAt: null },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  let published = 0;
  let failed = 0;

  for (const { id: contactId } of pending) {
    const jobId = randomUUID();
    const job = buildCampaignSendJob({
      jobId,
      campaignId: run.campaign.id,
      runId,
      campaignContactId: contactId,
      organizationId: run.campaign.organizationId,
      correlationId: runId,
      requestedByUserId: run.createdByUserId ?? null,
      attempt: 0,
      occurredAt: new Date().toISOString(),
    });

    try {
      await publishConfirm(MAIN_EXCHANGE, ROUTING_SEND, job, {
        messageId: jobId,
        correlationId: runId,
        type: CAMPAIGN_SEND_EVENT,
        attempt: 0,
      });
      // Só após o confirm do broker marcamos como enfileirado.
      await prisma.campaignContact.update({
        where: { id: contactId },
        data: { queueJobId: jobId, queuedAt: new Date(), attemptCount: 0, lastQueueError: null },
      });
      published++;
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      console.error(JSON.stringify({ service: "publisher", event: "publish_failed", runId, contactId, err: msg }));
      await prisma.campaignContact.update({
        where: { id: contactId },
        data: { lastQueueError: msg.slice(0, 500) },
      }).catch(() => {});
    }
  }

  console.log(JSON.stringify({ service: "publisher", event: "run_published", runId, published, failed, correlationId: runId }));
  return { runId, published, failed };
}
