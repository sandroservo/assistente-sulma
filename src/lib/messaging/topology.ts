/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Topologia RabbitMQ das campanhas (doc messaging_ai_pack/docs/RABBITMQ.md).
 * Exchange direct + fila principal com DLX, filas de retry por TTL que
 * devolvem à principal ao expirar, e DLQ. Declaração idempotente no boot.
 */

import type { ConfirmChannel } from "amqplib";

export const MAIN_EXCHANGE = "wa.campaign.direct";
export const DLX = "wa.campaign.dlx";
export const MAIN_QUEUE = "wa.campaign.send.v1";
export const DLQ = "wa.campaign.dead.v1";
export const ROUTING_SEND = "campaign.send";
export const ROUTING_DEAD = "campaign.dead";

// attempt (0-based) → fila de retry. Índice = attempt já feito. Último → DLQ.
export const RETRY_QUEUES = [
  { queue: "wa.campaign.retry.5s.v1", ttl: 5_000 },
  { queue: "wa.campaign.retry.30s.v1", ttl: 30_000 },
  { queue: "wa.campaign.retry.2m.v1", ttl: 120_000 },
  { queue: "wa.campaign.retry.10m.v1", ttl: 600_000 },
] as const;

export async function assertCampaignTopology(ch: ConfirmChannel): Promise<void> {
  await ch.assertExchange(MAIN_EXCHANGE, "direct", { durable: true });
  await ch.assertExchange(DLX, "direct", { durable: true });

  await ch.assertQueue(MAIN_QUEUE, {
    durable: true,
    deadLetterExchange: DLX,
    deadLetterRoutingKey: ROUTING_DEAD,
  });
  await ch.bindQueue(MAIN_QUEUE, MAIN_EXCHANGE, ROUTING_SEND);

  for (const { queue, ttl } of RETRY_QUEUES) {
    await ch.assertQueue(queue, {
      durable: true,
      messageTtl: ttl,
      deadLetterExchange: MAIN_EXCHANGE,
      deadLetterRoutingKey: ROUTING_SEND,
    });
  }

  await ch.assertQueue(DLQ, { durable: true });
  await ch.bindQueue(DLQ, DLX, ROUTING_DEAD);
}

/**
 * Escolhe a fila de retry pela tentativa já realizada (attempt).
 * Retorna null quando estourou o teto → vai pra DLQ.
 * Se waitMs for informado (espera de capacidade/janela), escolhe o menor
 * bucket >= waitMs, ou o maior disponível (rechecagem no consumo).
 */
export function retryQueueFor(attempt: number, waitMs?: number): string | null {
  if (typeof waitMs === "number" && waitMs > 0) {
    const bucket = RETRY_QUEUES.find((r) => r.ttl >= waitMs) ?? RETRY_QUEUES[RETRY_QUEUES.length - 1];
    return bucket.queue;
  }
  if (attempt >= RETRY_QUEUES.length) return null;
  return RETRY_QUEUES[attempt].queue;
}
