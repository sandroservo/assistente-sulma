/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Edita uma mensagem já enviada no WhatsApp e no banco
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evolutionUpdateMessage } from "@/lib/evolution";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { text } = await req.json();

    if (!text?.trim()) {
      return NextResponse.json(
        { ok: false, error: "Texto obrigatório" },
        { status: 400 }
      );
    }

    const message = await prisma.message.findUnique({
      where: { id },
      include: { conversation: true },
    });

    if (!message) {
      return NextResponse.json(
        { ok: false, error: "Mensagem não encontrada" },
        { status: 404 }
      );
    }

    if (message.direction !== "out") {
      return NextResponse.json(
        { ok: false, error: "Só é possível editar mensagens enviadas" },
        { status: 403 }
      );
    }

    // Verifica se a mensagem tem providerId (necessário para editar no WhatsApp)
    if (message.providerId) {
      try {
        await evolutionUpdateMessage({
          remoteJid: message.conversation.remoteJid,
          messageId: message.providerId,
          text: text.trim(),
        });
      } catch (error) {
        console.error("[Edit Message] Evolution error:", error);
        // Continua atualizando no banco mesmo se falhar no WhatsApp
      }
    }

    const updated = await prisma.message.update({
      where: { id },
      data: {
        body: text.trim(),
        editedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, message: updated });
  } catch (error) {
    console.error("[Edit Message] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro interno" },
      { status: 500 }
    );
  }
}
