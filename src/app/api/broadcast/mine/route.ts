/**
 * Fila de disparo do usuário logado.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pauseCampaignRun, resumeCampaignRun, startCampaignWorker, stopCampaignRun } from "@/lib/campaign-worker";
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
        status: { in: ["DONE", "CANCELLED"] },
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

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.organizationId || !session.user.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  if (!["pause", "stop", "resume"].includes(action)) {
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  }

  const runs = await prisma.campaignRun.findMany({
    where: {
      createdByUserId: session.user.id,
      status: { in: ["RUNNING", "PAUSED"] },
      campaign: { organizationId: session.user.organizationId },
    },
    select: { id: true, status: true },
  });
  if (!runs.length) {
    return NextResponse.json({ error: "Nenhum disparo ativo na sua fila" }, { status: 400 });
  }

  try {
    if (action === "pause") {
      for (const r of runs) {
        if (r.status === "RUNNING") await pauseCampaignRun(r.id);
      }
    } else if (action === "stop") {
      for (const r of runs) await stopCampaignRun(r.id);
    } else {
      for (const r of runs) {
        if (r.status === "PAUSED") await resumeCampaignRun(r.id);
      }
    }
    return NextResponse.json({ ok: true, action });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Não foi possível alterar o disparo";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
