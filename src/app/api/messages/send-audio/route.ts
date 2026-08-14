/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * API para enviar áudio gravado pelo atendente via WhatsApp (Evolution API)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evolutionSendAudio, evolutionSendPresence } from "@/lib/evolution";
import { auth } from "@/lib/auth";
import { saveMedia } from "@/lib/media-storage";

export async function POST(req: Request) {
  try {
    const { conversationId, base64, mimeType } = await req.json();

    if (!conversationId || !base64) {
      return NextResponse.json(
        { ok: false, error: "conversationId e base64 são obrigatórios" },
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

    // Envia presença "gravando áudio" antes de enviar
    await evolutionSendPresence(convo.lead.phone, "recording").catch(() => {});

    try {
      await evolutionSendAudio({
        number: convo.lead.phone,
        base64,
        mimeType: mimeType || "audio/ogg",
      });
    } catch (evolutionError) {
      console.error("[Send Audio] Evolution API error:", evolutionError);
      const errorMessage = evolutionError instanceof Error ? evolutionError.message : "Erro desconhecido";
      return NextResponse.json(
        { ok: false, error: `Erro ao enviar áudio: ${errorMessage}` },
        { status: 500 }
      );
    }

    // Identifica o atendente logado
    const session = await auth();
    const sentByUserId = session?.user?.id || null;

    let mediaUrl: string | null = null;
    try { mediaUrl = await saveMedia(base64, mimeType || "audio/ogg"); } catch (e) { console.error("Erro ao salvar áudio:", e); }

    const msg = await prisma.message.create({
      data: {
        conversationId,
        direction: "out",
        type: "audio",
        body: "[Áudio enviado]",
        mediaUrl,
        sentByUserId,
        sentAt: new Date(),
      },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    await prisma.lead.update({
      where: { id: convo.leadId },
      data: { lastMessageAt: new Date() },
    });

    return NextResponse.json({ ok: true, message: msg });
  } catch (error) {
    console.error("[Send Audio] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro interno ao enviar áudio" },
      { status: 500 }
    );
  }
}
