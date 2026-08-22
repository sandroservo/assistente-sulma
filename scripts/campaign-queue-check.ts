/**
 * Self-check da lógica pura da fila (sem RabbitMQ/DB).
 * Roda: npx tsx scripts/campaign-queue-check.ts
 * Cobre: mapeamento de retry por tentativa/waitMs e validação do contrato.
 */
import assert from "assert";
import { retryQueueFor, RETRY_QUEUES } from "../src/lib/messaging/topology";
import { CampaignSendJobV1, buildCampaignSendJob } from "../src/lib/messaging/contracts";

// Retry por tentativa (0-based): 0->5s, 1->30s, 2->2m, 3->10m, 4+ -> DLQ (null)
assert.strictEqual(retryQueueFor(0), "wa.campaign.retry.5s.v1", "attempt0 -> 5s");
assert.strictEqual(retryQueueFor(1), "wa.campaign.retry.30s.v1", "attempt1 -> 30s");
assert.strictEqual(retryQueueFor(3), "wa.campaign.retry.10m.v1", "attempt3 -> 10m");
assert.strictEqual(retryQueueFor(4), null, "attempt4 -> DLQ");

// Espera por capacidade: escolhe o menor bucket >= waitMs
assert.strictEqual(retryQueueFor(0, 3_000), "wa.campaign.retry.5s.v1", "3s -> 5s bucket");
assert.strictEqual(retryQueueFor(0, 90_000), "wa.campaign.retry.2m.v1", "90s -> 2m bucket");
assert.strictEqual(retryQueueFor(0, 9_999_999), RETRY_QUEUES[RETRY_QUEUES.length - 1].queue, "gigante -> maior bucket");

// Contrato válido
const job = buildCampaignSendJob({
  jobId: "j1", campaignId: "c1", runId: "r1", campaignContactId: "cc1",
  organizationId: "org1", correlationId: "r1", occurredAt: new Date().toISOString(),
});
assert.doesNotThrow(() => CampaignSendJobV1.parse(job), "job montado é válido");

// Contrato inválido (falta payload.jobId) rejeita
assert.throws(() => CampaignSendJobV1.parse({ ...job, payload: { ...job.payload, jobId: "" } }), "jobId vazio rejeitado");
assert.throws(() => CampaignSendJobV1.parse({ ...job, eventType: "outro" }), "eventType errado rejeitado");

console.log("OK — campaign-queue self-check passou");
