/**
 * Retoma um disparo pausado pelo circuit breaker.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resumeCampaignRun } from "@/lib/campaign-worker";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ runId: string }> }) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { runId } = await params;
  const run = await prisma.campaignRun.findFirst({
    where: { id: runId, campaign: { organizationId: session.user.organizationId } },
    select: { id: true },
  });
  if (!run) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  try {
    await resumeCampaignRun(runId);
    return NextResponse.json({ ok: true, runId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Não foi possível retomar";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
