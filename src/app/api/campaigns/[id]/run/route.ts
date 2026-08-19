/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Dispara a campanha agora (manual). Fire-and-forget: o envio roda em background
 * no processo do `next start` (self-hosted). Retorna imediatamente.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { executeCampaignRun, prepareCampaignRun } from "@/lib/campaigns";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const campaign = await prisma.campaign.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });
  if (!campaign) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });
  if (campaign.status === "RUNNING") {
    return NextResponse.json({ error: "Campanha já está em execução" }, { status: 409 });
  }

  try {
    const prepared = await prepareCampaignRun(id);
    executeCampaignRun(prepared.runId, { previousStatus: prepared.previousStatus }).catch((err) =>
      console.error("[Campaign] executeCampaignRun falhou:", err)
    );
    return NextResponse.json({ ok: true, runId: prepared.runId, total: prepared.total, message: "Campanha iniciada." });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro ao iniciar campanha";
    const status = msg.includes("já está em execução") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
