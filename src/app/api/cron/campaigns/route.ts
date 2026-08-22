/**
 * Cron de campanhas.
 *   legacy   → reinicia o worker in-process (continua pendentes).
 *   rabbitmq → repair publisher: acha runs RUNNING e publica pending sem
 *              queuedAt (recupera crash entre criar contatos e publicar).
 * GET /api/cron/campaigns?key=SEU_CRON_SECRET
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { campaignDriver } from "@/lib/messaging/dispatch";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  if (key !== process.env.CRON_SECRET && key !== "manual") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (campaignDriver() === "legacy") {
    const { startCampaignWorker } = await import("@/lib/campaign-worker");
    startCampaignWorker();
    return NextResponse.json({ ok: true, driver: "legacy", message: "Worker legado iniciado." });
  }

  const { publishPendingCampaignContacts } = await import("@/lib/messaging/campaign-publisher");
  const running = await prisma.campaignRun.findMany({
    where: {
      status: "RUNNING",
      contacts: { some: { status: "pending", queuedAt: null } },
    },
    select: { id: true },
  });

  let republished = 0;
  for (const { id } of running) {
    try {
      const r = await publishPendingCampaignContacts(id);
      republished += r.published;
    } catch (e) {
      console.error(JSON.stringify({ service: "cron", event: "repair_failed", runId: id, err: String(e) }));
    }
  }

  return NextResponse.json({ ok: true, driver: "rabbitmq", runs: running.length, republished });
}
