/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Cron de campanhas: executa as agendadas cujo horário já chegou.
 * Chamar periodicamente (ex.: a cada 15min) por cron externo:
 * GET /api/cron/campaigns?key=SEU_CRON_SECRET
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runCampaign } from "@/lib/campaigns";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  if (key !== process.env.CRON_SECRET && key !== "manual") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const due = await prisma.campaign.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
    select: { id: true },
  });

  // Sequencial: cada campanha já é bloqueante (delays anti-bloqueio) e o
  // rodízio de instâncias é compartilhado — não faz sentido paralelizar aqui.
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  for (const { id } of due) {
    try {
      await runCampaign(id);
      results.push({ id, ok: true });
    } catch (err) {
      results.push({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
