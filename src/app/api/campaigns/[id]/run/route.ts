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
import { runCampaign } from "@/lib/campaigns";

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

  // ponytail: fire-and-forget confia no processo único do next start; se um dia
  // escalar pra serverless/multi-instância, mover pra fila (Redis/Horizon-like).
  runCampaign(id).catch((err) => console.error("[Campaign] runCampaign falhou:", err));

  return NextResponse.json({ ok: true, message: "Campanha iniciada." });
}
