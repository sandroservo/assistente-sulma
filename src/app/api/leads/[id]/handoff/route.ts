/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { evolutionSendText } from "@/lib/evolution";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await auth();
    const agentName = session?.user?.name || "um atendente";

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: { conversations: { take: 1, orderBy: { createdAt: "desc" } } },
    });

    if (!lead) {
      return NextResponse.json(
        { ok: false, error: "lead not found" },
        { status: 404 }
      );
    }

    await prisma.lead.update({
      where: { id },
      data: { ownerType: "human", status: "HUMANO_EM_ATENDIMENTO" },
    });

    // Envia mensagem ao cliente avisando quem vai atendê-lo
    const leadName = lead.name || lead.pushName || "";
    const greeting = leadName ? `Olá, ${leadName}!` : "Olá!";
    const handoffMessage = `${greeting} A partir de agora você será atendido(a) por *${agentName}*. Em que posso ajudar?`;

    await evolutionSendText({ number: lead.phone, text: handoffMessage }).catch((err) => {
      console.error("[Handoff] Erro ao enviar mensagem de aviso:", err);
    });

    // Salva a mensagem no banco para aparecer no chat
    if (lead.conversations[0]) {
      await prisma.message.create({
        data: {
          conversationId: lead.conversations[0].id,
          direction: "out",
          type: "text",
          body: handoffMessage,
          sentByUserId: session?.user?.id || null,
          sentAt: new Date(),
        },
      });

      await prisma.handoff.create({
        data: {
          leadId: id,
          conversationId: lead.conversations[0].id,
          requestedBy: "human",
          reason: "Atendente assumiu o lead",
        },
      });
    }

    return NextResponse.json({ ok: true, lead });
  } catch (error) {
    console.error("Handoff error:", error);
    return NextResponse.json(
      { ok: false, error: "internal error" },
      { status: 500 }
    );
  }
}
