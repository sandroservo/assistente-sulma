/**
 * Progresso de um disparo/execução de campanha (polling do painel).
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ runId: string }> }) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { runId } = await params;
  const run = await prisma.campaignRun.findFirst({
    where: {
      id: runId,
      campaign: { organizationId: session.user.organizationId },
    },
    include: {
      campaign: { select: { id: true, name: true, message: true } },
      contacts: {
        orderBy: { sentAt: "desc" },
        select: {
          id: true,
          phone: true,
          name: true,
          status: true,
          errorMsg: true,
          sentAt: true,
        },
      },
    },
  });
  if (!run) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const pendingFirst = [...run.contacts].sort((a, b) => {
    const rank = (s: string) => {
      if (s === "sent" || s === "delivered" || s === "read") return 0;
      if (s === "sending") return 1;
      if (s === "pending") return 2;
      return 3;
    };
    const r = rank(a.status) - rank(b.status);
    if (r !== 0) return r;
    const at = a.sentAt ? new Date(a.sentAt).getTime() : 0;
    const bt = b.sentAt ? new Date(b.sentAt).getTime() : 0;
    return bt - at;
  });

  const processed = run.sent + run.failed;
  const remaining = Math.max(0, run.total - processed);
  let etaSeconds: number | null = null;
  if (processed > 0 && remaining > 0) {
    const elapsed = Date.now() - new Date(run.startedAt).getTime();
    etaSeconds = Math.round((remaining * (elapsed / processed)) / 1000);
  }

  return NextResponse.json({
    ok: true,
    run: {
      id: run.id,
      status: run.status,
      total: run.total,
      sent: run.sent,
      failed: run.failed,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      campaignId: run.campaign.id,
      campaignName: run.campaign.name,
      messagePreview: run.campaign.message.slice(0, 140),
      etaSeconds,
      contacts: pendingFirst,
    },
  });
}
