/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 * 
 * Endpoint para buscar mensagens de uma conversa (polling)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const after = url.searchParams.get("after");

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        lead: true,
        messages: {
          where: after
            ? { createdAt: { gt: new Date(after) } }
            : undefined,
          orderBy: { createdAt: "asc" },
          take: 100,
          include: {
            sentByUser: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { ok: false, error: "Conversa não encontrada" },
        { status: 404 }
      );
    }

    // Marca mensagens como lidas
    if (conversation.unreadCount > 0) {
      await prisma.conversation.update({
        where: { id },
        data: { unreadCount: 0 },
      });
    }

    return NextResponse.json({
      ok: true,
      messages: (conversation.messages as any[]).map((m) => ({
        id: m.id,
        body: m.body ?? "",
        type: m.type ?? "text",
        mediaUrl: m.mediaUrl ?? null,
        transcription: m.transcription ?? null,
        direction: m.direction,
        createdAt: m.createdAt.toISOString(),
        sentByUserName: m.sentByUser?.name ?? null,
        providerId: m.providerId ?? null,
        quotedMessageId: m.quotedMessageId ?? null,
        status: m.status ?? null,
        editedAt: m.editedAt ? m.editedAt.toISOString() : null,
      })),
      lead: {
        id: conversation.lead.id,
        name: conversation.lead.name,
        pushName: conversation.lead.pushName,
        avatarUrl: conversation.lead.avatarUrl,
        phone: conversation.lead.phone,
        status: conversation.lead.status,
        ownerType: conversation.lead.ownerType,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar mensagens:", error);
    return NextResponse.json(
      { ok: false, error: "Erro interno" },
      { status: 500 }
    );
  }
}
