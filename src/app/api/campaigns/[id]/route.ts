/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Campanha individual: GET detalhe (runs + contatos p/ drill-down de erro),
 * PATCH (editar/agendar/cancelar), DELETE.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function ownedCampaign(id: string, organizationId: string) {
  const campaign = await prisma.campaign.findFirst({ where: { id, organizationId } });
  return campaign;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const campaign = await prisma.campaign.findFirst({
    where: { id, organizationId: session.user.organizationId },
    include: {
      runs: {
        orderBy: { startedAt: "desc" },
        include: {
          contacts: {
            where: { status: "failed" }, // drill-down foca nos erros (doc #5)
            select: { phone: true, name: true, errorKind: true, errorMsg: true },
          },
        },
      },
    },
  });
  if (!campaign) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });
  return NextResponse.json({ ok: true, campaign });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await ownedCampaign(id, session.user.organizationId);
  if (!existing) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.message === "string" && body.message.trim()) data.message = body.message.trim();
  if (["conservative", "balanced", "aggressive"].includes(body.profile)) data.profile = body.profile;
  if (["NONE", "DAILY", "WEEKLY", "MONTHLY"].includes(body.recurrence)) data.recurrence = body.recurrence;
  if (Array.isArray(body.instanceIds)) data.instanceIds = body.instanceIds;
  if (body.targetFilter !== undefined) data.targetFilter = body.targetFilter;
  if (body.mediaBase64 !== undefined) {
    data.mediaBase64 = body.mediaBase64 || null;
    data.mediaMimeType = body.mediaMimeType || null;
  }
  if (body.action === "cancel") {
    data.status = "CANCELLED";
    data.scheduledAt = null;
  } else if (body.scheduledAt !== undefined) {
    data.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
    data.status = body.scheduledAt ? "SCHEDULED" : "DRAFT";
  }

  const campaign = await prisma.campaign.update({ where: { id }, data });
  return NextResponse.json({ ok: true, campaign });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await ownedCampaign(id, session.user.organizationId);
  if (!existing) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });

  await prisma.campaign.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
