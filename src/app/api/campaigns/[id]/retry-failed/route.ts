/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Reprocessamento administrativo (SPEC-04 SULMA-RTY-008): reenfileira os
 * contatos "failed" de uma campanha. Reseta failed -> pending, limpa marcadores
 * de fila, reabre os runs e dispara pelo driver ativo (legacy|rabbitmq).
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dispatchCampaignRun } from "@/lib/messaging/dispatch";
import { syncCampaignStatus } from "@/lib/campaign-worker";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id } = await params;

  const campaign = await prisma.campaign.findFirst({
    where: { id, organizationId: session.user.organizationId },
    select: { id: true },
  });
  if (!campaign) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });

  // Runs com contatos falhados
  const runs = await prisma.campaignRun.findMany({
    where: { campaignId: id, contacts: { some: { status: "failed" } } },
    select: { id: true },
  });
  if (runs.length === 0) {
    return NextResponse.json({ ok: true, requeued: 0, message: "Nenhum contato falhado." });
  }

  let requeued = 0;
  for (const run of runs) {
    const reset = await prisma.campaignContact.updateMany({
      where: { runId: run.id, status: "failed" },
      data: {
        status: "pending",
        queueJobId: null,
        queuedAt: null,
        processingAt: null,
        attemptCount: 0,
        errorKind: null,
        errorMsg: null,
        lastQueueError: null,
      },
    });
    requeued += reset.count;
    // reabre o run p/ o publisher enfileirar de novo
    await prisma.campaignRun.update({
      where: { id: run.id },
      data: { status: "RUNNING", finishedAt: null, failed: { decrement: reset.count } },
    });
    await dispatchCampaignRun(run.id);
  }

  await syncCampaignStatus(id);
  return NextResponse.json({ ok: true, requeued, runs: runs.length });
}
