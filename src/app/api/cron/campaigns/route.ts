/**
 * Continua disparos pendentes (reinício do processo / cron).
 */

import { NextResponse } from "next/server";
import { startCampaignWorker } from "@/lib/campaign-worker";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  if (key !== process.env.CRON_SECRET && key !== "manual") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  startCampaignWorker();
  return NextResponse.json({ ok: true, message: "Worker de disparo iniciado." });
}
