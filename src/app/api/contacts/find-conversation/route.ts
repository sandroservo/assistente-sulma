/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Busca a conversa de um contato pelo telefone.
 * Usado pelo card de contato no chat para navegar direto à conversa.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get("phone")?.replace(/\D/g, "") || "";

    if (!phone) {
      return NextResponse.json({ ok: false, error: "Phone obrigatório" }, { status: 400 });
    }

    const lead = await prisma.lead.findFirst({
      where: { phone },
      select: {
        id: true,
        conversations: {
          take: 1,
          orderBy: { lastMessageAt: "desc" },
          select: { id: true },
        },
      },
    });

    if (lead?.conversations[0]) {
      return NextResponse.json({ ok: true, conversationId: lead.conversations[0].id });
    }

    return NextResponse.json({ ok: true, conversationId: null });
  } catch (error) {
    console.error("[Find Conversation] Error:", error);
    return NextResponse.json({ ok: false, error: "Erro interno" }, { status: 500 });
  }
}
