/**
 * Fila de disparo do usuário logado.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startCampaignWorker } from "@/lib/campaign-worker";
import { mergeBroadcastRuns } from "@/lib/broadcast-view";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.organizationId || !session.user.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const userId = session.user.id;
  const orgId = session.user.organizationId;

  const active = await prisma.campaignRun.findMany({
    where: {
      createdByUserId: userId,
      status: { in: ["RUNNING", "PAUSED"] },
      campaign: { organizationId: orgId },
    },
    orderBy: { startedAt: "asc" },
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

  let runs = active;
  if (!runs.length) {
    const recent = await prisma.campaignRun.findFirst({
      where: {
        createdByUserId: userId,
        status: "DONE",
        campaign: { organizationId: orgId },
        finishedAt: { gte: new Date(Date.now() - 30 * 60_000) },
      },
      orderBy: { finishedAt: "desc" },
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
    if (recent) runs = [recent];
  }

  if (runs.some((r) => r.status === "RUNNING" || r.status === "PAUSED")) {
    startCampaignWorker();
  }

  const run = mergeBroadcastRuns(runs, session.user.name);
  return NextResponse.json({
    ok: true,
    run,
    runIds: runs.map((r) => r.id),
  });
}
