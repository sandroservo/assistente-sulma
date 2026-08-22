/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Ponto único de disparo de um run. Feature flag CAMPAIGN_QUEUE_DRIVER decide:
 *   legacy   → worker in-process (Postgres queue) — comportamento atual
 *   rabbitmq → publica jobs, worker standalone consome
 * Import dinâmico mantém amqplib fora do bundle no modo legacy.
 * Rollback = trocar ENV e reiniciar.
 */

export function campaignDriver(): "legacy" | "rabbitmq" {
  return process.env.CAMPAIGN_QUEUE_DRIVER === "rabbitmq" ? "rabbitmq" : "legacy";
}

export async function dispatchCampaignRun(runId: string): Promise<void> {
  if (campaignDriver() === "rabbitmq") {
    const { publishPendingCampaignContacts } = await import("./campaign-publisher");
    await publishPendingCampaignContacts(runId);
    return;
  }
  const { startCampaignWorker } = await import("@/lib/campaign-worker");
  startCampaignWorker();
}
