/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evolutionSendText, evolutionSendTextWithQuote } from "@/lib/evolution";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { conversationId, text, quotedMessageId } = await req.json();

    console.log("[Send Message] Request:", { conversationId, textLength: text?.length, quotedMessageId });

    if (!conversationId || !text) {
      return NextResponse.json(
        { ok: false, error: "missing fields" },
        { status: 400 }
      );
    }

    const convo = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { lead: true },
    });

    if (!convo) {
      console.error("[Send Message] Conversation not found:", conversationId);
      return NextResponse.json(
        { ok: false, error: "conversation not found" },
        { status: 404 }
      );
    }

    // Identifica o atendente logado
    const session = await auth();
    const sentByUserId = session?.user?.id || null;
    const userName = session?.user?.name || null;

    // Prefixa nome do atendente no texto enviado ao WhatsApp
    const whatsappText = userName ? `*[${userName}]:*\n${text}` : text;

    // Busca providerId da mensagem citada (se houver reply)
    let quotedProviderId: string | null = null;
    if (quotedMessageId) {
      const quotedMsg = await prisma.message.findUnique({
        where: { id: quotedMessageId },
        select: { providerId: true },
      });
      quotedProviderId = quotedMsg?.providerId || null;
    }

    console.log("[Send Message] Sending to:", convo.lead.phone);

    try {
      if (quotedProviderId) {
        await evolutionSendTextWithQuote({
          number: convo.lead.phone,
          text: whatsappText,
          quotedId: quotedProviderId,
          remoteJid: convo.remoteJid,
        });
      } else {
        await evolutionSendText({ number: convo.lead.phone, text: whatsappText });
      }
      console.log("[Send Message] Message sent successfully");
    } catch (evolutionError) {
      console.error("[Send Message] Evolution API error:", evolutionError);
      const errorMessage = evolutionError instanceof Error ? evolutionError.message : "Erro desconhecido";
      return NextResponse.json(
        { ok: false, error: `Erro ao enviar mensagem: ${errorMessage}` },
        { status: 500 }
      );
    }

    const msg = await prisma.message.create({
      data: {
        conversationId,
        direction: "out",
        type: "text",
        body: text,
        quotedMessageId: quotedMessageId || null,
        quotedProviderId,
        status: "sent",
        sentByUserId,
        sentAt: new Date(),
      },
    });

    // Auto-reivindica: quem responde primeiro vira o atendente (evita conflito).
    const claim = !convo.assignedUserId && sentByUserId ? { assignedUserId: sentByUserId } : {};
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date(), ...claim },
    });

    await prisma.lead.update({
      where: { id: convo.leadId },
      data: { lastMessageAt: new Date() },
    });

    const { emitConversationUpdate } = await import("@/lib/realtime");
    emitConversationUpdate({ type: "message", conversationId, leadId: convo.leadId });

    return NextResponse.json({ ok: true, message: msg });
  } catch (error) {
    console.error("Send message error:", error);
    return NextResponse.json(
      { ok: false, error: "internal error" },
      { status: 500 }
    );
  }
}
