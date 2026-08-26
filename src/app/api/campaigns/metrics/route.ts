/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Métricas operacionais de campanhas (SPEC-07): contadores agregados do funil
 * por status, escopados na organização. Base do painel.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const orgId = session.user.organizationId;
  const where = { run: { campaign: { organizationId: orgId } } };

  const [byStatus, queued, retry] = await Promise.all([
    prisma.campaignContact.groupBy({ by: ["status"], where, _count: true }),
    prisma.campaignContact.count({ where: { ...where, status: "pending", queuedAt: { not: null } } }),
    prisma.campaignContact.count({ where: { ...where, status: "pending", attemptCount: { gt: 0 } } }),
  ]);

  const count = (s: string) => byStatus.find((r) => r.status === s)?._count ?? 0;

  return NextResponse.json({
    ok: true,
    metrics: {
      queued,                                        // pending já enfileirado no broker
      pending: count("pending"),                     // total pending (inclui não enfileirado)
      processing: count("sending"),                  // em envio
      sent: count("sent") + count("delivered") + count("read"),
      delivered: count("delivered") + count("read"),
      read: count("read"),
      failed: count("failed"),
      skipped: count("skipped"),
      retry,                                          // pending que já tentou ao menos 1x
      total: byStatus.reduce((a, r) => a + r._count, 0),
    },
  });
}
