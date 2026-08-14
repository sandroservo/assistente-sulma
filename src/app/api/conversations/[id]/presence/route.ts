/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Busca status de presença (online/offline) do cliente.
 * Como a Evolution API v2 não possui endpoint fetchPresence,
 * utiliza heurística baseada na última mensagem recebida do lead:
 * - Última mensagem nos últimos 5 min → "online"
 * - Caso contrário → "offline" + lastSeen
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutos

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const convo = await prisma.conversation.findUnique({
      where: { id },
      select: {
        id: true,
        lead: {
          select: { lastMessageAt: true },
        },
      },
    });

    if (!convo) {
      return NextResponse.json(
        { ok: false, error: "Conversa não encontrada" },
        { status: 404 }
      );
    }

    // Busca a última mensagem recebida (direction: "in") na conversa
    const lastIncomingMessage = await prisma.message.findFirst({
      where: { conversationId: id, direction: "in" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    const lastSeenDate = lastIncomingMessage?.createdAt ?? convo.lead.lastMessageAt;
    const now = Date.now();
    const available = lastSeenDate
      ? now - new Date(lastSeenDate).getTime() < ONLINE_THRESHOLD_MS
      : false;

    return NextResponse.json({
      ok: true,
      available,
      lastSeen: lastSeenDate?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("[Presence] Error:", error);
    return NextResponse.json({ ok: true, available: false, lastSeen: null });
  }
}
