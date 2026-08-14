/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const FOLLOWUP_INTERVALS_HOURS = [24, 48, 72, 120];

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }

    const { leadId, conversationId } = await req.json();

    if (!leadId || !conversationId) {
      return NextResponse.json(
        { ok: false, error: "missing fields" },
        { status: 400 }
      );
    }

    const existingPending = await prisma.followUp.findFirst({
      where: {
        leadId,
        status: "pending",
      },
    });

    if (existingPending) {
      return NextResponse.json({
        ok: true,
        message: "followups already scheduled",
      });
    }

    await prisma.lead.update({
      where: { id: leadId },
      data: { status: "AGUARDANDO_RESPOSTA" },
    });

    const followUps = FOLLOWUP_INTERVALS_HOURS.map((hours, index) => ({
      leadId,
      conversationId,
      stage: index + 1,
      scheduledAt: new Date(Date.now() + hours * 60 * 60 * 1000),
      status: "pending",
    }));

    await prisma.followUp.createMany({
      data: followUps,
    });

    return NextResponse.json({
      ok: true,
      scheduled: followUps.length,
    });
  } catch (error) {
    console.error("Schedule followups error:", error);
    return NextResponse.json(
      { ok: false, error: "internal error" },
      { status: 500 }
    );
  }
}
