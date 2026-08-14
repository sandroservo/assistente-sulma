/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * API para enviar mídia (imagem, PDF, documento) via WhatsApp (Evolution API)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evolutionSendMedia } from "@/lib/evolution";
import { auth } from "@/lib/auth";
import { saveMedia } from "@/lib/media-storage";

export async function POST(req: Request) {
  try {
    const { conversationId, base64, mimeType, fileName, caption } =
      await req.json();

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

    // Determina o tipo de mídia com base no mimeType
    let mediatype: "image" | "document" | "video" = "document";
    const mime = (mimeType || "").toLowerCase();
    if (mime.startsWith("image/")) mediatype = "image";
    else if (mime.startsWith("video/")) mediatype = "video";

    try {
      await evolutionSendMedia({
        number: convo.lead.phone,
        mediatype,
        media: base64,
        mimetype: mimeType || "application/octet-stream",
        caption: caption || undefined,
        fileName: fileName || undefined,
      });
    } catch (evolutionError) {
      console.error("[Send Media] Evolution API error:", evolutionError);
      const errorMessage =
        evolutionError instanceof Error
          ? evolutionError.message
          : "Erro desconhecido";
      return NextResponse.json(
        { ok: false, error: `Erro ao enviar mídia: ${errorMessage}` },
        { status: 500 }
      );
    }

    // Identifica o atendente logado
    const session = await auth();
    const sentByUserId = session?.user?.id || null;

    // Texto descritivo para o histórico
    const bodyText =
      mediatype === "image"
        ? `[Imagem enviada${caption ? `: ${caption}` : ""}]`
        : mediatype === "video"
          ? `[Vídeo enviado${caption ? `: ${caption}` : ""}]`
          : `[Documento enviado: ${fileName || "arquivo"}]`;

    let mediaUrlSaved: string | null = null;
    try { mediaUrlSaved = await saveMedia(base64, mimeType || "application/octet-stream"); } catch (e) { console.error("Erro ao salvar mídia:", e); }

    const msg = await prisma.message.create({
      data: {
        conversationId,
        direction: "out",
        type: mediatype,
        body: bodyText,
        mediaUrl: mediaUrlSaved,
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
    console.error("[Send Media] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro interno ao enviar mídia" },
      { status: 500 }
    );
  }
}
