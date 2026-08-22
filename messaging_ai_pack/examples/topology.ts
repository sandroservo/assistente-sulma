import type { ConfirmChannel } from "amqplib";

export const MAIN_EXCHANGE = "wa.campaign.direct";
export const DLX = "wa.campaign.dlx";
export const MAIN_QUEUE = "wa.campaign.send.v1";
export const DLQ = "wa.campaign.dead.v1";

const RETRIES = [
  ["wa.campaign.retry.5s.v1", 5_000],
  ["wa.campaign.retry.30s.v1", 30_000],
  ["wa.campaign.retry.2m.v1", 120_000],
  ["wa.campaign.retry.10m.v1", 600_000],
] as const;

export async function assertCampaignTopology(ch: ConfirmChannel) {
  await ch.assertExchange(MAIN_EXCHANGE, "direct", { durable: true });
  await ch.assertExchange(DLX, "direct", { durable: true });

  await ch.assertQueue(MAIN_QUEUE, {
    durable: true,
    deadLetterExchange: DLX,
    deadLetterRoutingKey: "campaign.dead",
  });
  await ch.bindQueue(MAIN_QUEUE, MAIN_EXCHANGE, "campaign.send");

  for (const [queue, ttl] of RETRIES) {
    await ch.assertQueue(queue, {
      durable: true,
      messageTtl: ttl,
      deadLetterExchange: MAIN_EXCHANGE,
      deadLetterRoutingKey: "campaign.send",
    });
  }

  await ch.assertQueue(DLQ, { durable: true });
  await ch.bindQueue(DLQ, DLX, "campaign.dead");
}
