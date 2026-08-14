/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Envia contatos (vCard) via WhatsApp
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evolutionSendContact } from "@/lib/evolution";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { conversationId, contacts } = await req.json();

    if (!conversationId || !contacts?.length) {
      return NextResponse.json(
        { ok: false, error: "conversationId e contacts são obrigatórios" },
        { status: 400 }
      );
    }

    const convo = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { lead: true },
    });

    if (!convo) {
      return NextResponse.json(
        { ok: false, error: "Conversa não encontrada" },
        { status: 404 }
      );
    }

    try {
      await evolutionSendContact({
        number: convo.lead.phone,
        contacts,
      });
    } catch (error) {
      console.error("[Send Contact] Evolution error:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      return NextResponse.json(
        { ok: false, error: `Erro ao enviar contato: ${errorMessage}` },
        { status: 500 }
      );
    }

    const session = await auth();
    const sentByUserId = session?.user?.id || null;

    const contactData = contacts.map((c: { fullName: string; phoneNumber: string; organization?: string }) => ({
      fullName: c.fullName,
      phoneNumber: c.phoneNumber.replace(/\D/g, ""),
      organization: c.organization || null,
    }));

    const msg = await prisma.message.create({
      data: {
        conversationId,
        direction: "out",
        type: "contact",
        body: JSON.stringify(contactData),
        status: "sent",
        sentByUserId,
        sentAt: new Date(),
      },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    return NextResponse.json({ ok: true, message: msg });
  } catch (error) {
    console.error("[Send Contact] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro interno" },
      { status: 500 }
    );
  }
}
