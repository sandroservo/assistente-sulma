/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * CRUD de campanhas. GET lista (com resumo do último run), POST cria.
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

  const campaigns = await prisma.campaign.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: { createdAt: "desc" },
    include: {
      runs: {
        orderBy: { startedAt: "desc" },
        take: 1,
        select: { id: true, status: true, total: true, sent: true, failed: true, skipped: true, pauseReason: true, startedAt: true },
      },
      _count: { select: { runs: true } },
    },
  });

  return NextResponse.json({ ok: true, campaigns });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.name?.trim() || !body?.message?.trim()) {
    return NextResponse.json({ error: "Nome e mensagem são obrigatórios" }, { status: 400 });
  }

  const campaign = await prisma.campaign.create({
    data: {
      organizationId: session.user.organizationId,
      name: body.name.trim(),
      message: body.message.trim(),
      mediaBase64: body.mediaBase64 || null,
      mediaMimeType: body.mediaMimeType || null,
      profile: ["conservative", "balanced", "aggressive"].includes(body.profile) ? body.profile : "conservative",
      instanceIds: [],
      recurrence: "NONE",
      scheduledAt: null,
      status: "DRAFT",
    },
  });

  return NextResponse.json({ ok: true, campaign });
}
