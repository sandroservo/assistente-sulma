/**
 * Progresso de um disparo (polling do painel).
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startCampaignWorker } from "@/lib/campaign-worker";
import { presentBroadcastRun } from "@/lib/broadcast-view";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ runId: string }> }) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { runId } = await params;
  const isAdmin = session.user.role === "OWNER" || session.user.role === "ADMIN";
  const run = await prisma.campaignRun.findFirst({
    where: {
      id: runId,
      campaign: { organizationId: session.user.organizationId },
      ...(!isAdmin && session.user.id ? { createdByUserId: session.user.id } : {}),
    },
    include: {
      campaign: { select: { id: true, name: true, message: true } },
      createdByUser: { select: { name: true } },
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
  if (run.status === "RUNNING" || run.status === "PAUSED") startCampaignWorker();

  return NextResponse.json({
    ok: true,
    run: presentBroadcastRun(run, { ownerName: run.createdByUser?.name }),
  });
}
