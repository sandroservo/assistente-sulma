/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Manutenção agendada. Hoje: encerramento automático de conversas por
 * inatividade (doc §7.5). Config por org em OrgSettings key `auto_close_days`
 * (0 ou ausente = desligado). Chamar 1x/dia:
 * GET /api/cron/maintenance?key=SEU_CRON_SECRET
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  if (key !== process.env.CRON_SECRET && key !== "manual") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const configs = await prisma.orgSettings.findMany({ where: { key: "auto_close_days" } });

  let closed = 0;
  const perOrg: Array<{ organizationId: string; days: number; closed: number }> = [];

  for (const cfg of configs) {
    const days = parseInt(cfg.value, 10);
    if (!Number.isFinite(days) || days <= 0) continue;

    const cutoff = new Date(Date.now() - days * 86_400_000);
    const res = await prisma.conversation.updateMany({
      where: {
        status: "open",
        lastMessageAt: { lt: cutoff },
        lead: { organizationId: cfg.organizationId },
      },
      data: { status: "closed" },
    });

    closed += res.count;
    perOrg.push({ organizationId: cfg.organizationId, days, closed: res.count });
  }

  return NextResponse.json({ ok: true, closed, perOrg });
}
