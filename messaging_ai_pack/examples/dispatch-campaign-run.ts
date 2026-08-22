// Esqueleto conceitual; adaptar ao connection manager real.
// Objetivo: substituir chamadas diretas a startCampaignWorker em modo rabbitmq.

export async function dispatchCampaignRun(runId: string) {
  const driver = process.env.CAMPAIGN_QUEUE_DRIVER || "legacy";

  if (driver === "legacy") {
    const { startCampaignWorker } = await import("@/lib/campaign-worker");
    startCampaignWorker();
    return;
  }

  const { publishPendingCampaignContacts } = await import(
    "@/lib/messaging/campaign-publisher"
  );
  await publishPendingCampaignContacts(runId);
}
