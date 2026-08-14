/**
 * Abre (ou cria) a conversa da Sulma com um cliente a partir do telefone.
 * Usado pelo menu Cobrança para "Conversar" com o cliente.
 * POST /api/cobranca/open-chat  { phone, name? }
 * Retorna { ok, conversationId } para navegar até /chats/[conversationId].
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-13) || digits;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
  }
  const organizationId = session.user.organizationId;

  const body = await req.json().catch(() => ({}));
  const { phone, name } = body;

  if (!phone || !String(phone).trim()) {
    return NextResponse.json({ ok: false, error: "Telefone do cliente ausente" }, { status: 400 });
  }

  const cleanPhone = normalizePhone(String(phone));
  if (cleanPhone.length < 10) {
    return NextResponse.json({ ok: false, error: "Telefone inválido" }, { status: 400 });
  }

  try {
    // Lead (telefone único por organização)
    let lead = await prisma.lead.findUnique({
      where: { organizationId_phone: { organizationId, phone: cleanPhone } },
    });

    if (!lead) {
      lead = await prisma.lead.create({
        data: {
          organizationId,
          phone: cleanPhone,
          name: name?.trim() || null,
          pushName: name?.trim() || null,
          status: "NOVO",
          ownerType: "human", // contato iniciado pela equipe; bot não assume
          source: "cobranca",
          category: "cobranca",
        },
      });
    }

    // Single-tenant: uma conversa por lead
    let conversation = await prisma.conversation.findFirst({
      where: { leadId: lead.id },
      orderBy: { lastMessageAt: "desc" },
    });

    if (!conversation) {
      const instance = await prisma.instance.findFirst({
        where: { organizationId },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      });

      conversation = await prisma.conversation.create({
        data: {
          leadId: lead.id,
          instanceId: instance?.id ?? null,
          remoteJid: `${cleanPhone}@s.whatsapp.net`,
          channel: "whatsapp",
          lastMessageAt: new Date(),
          unreadCount: 0,
        },
      });
    }

    return NextResponse.json({ ok: true, conversationId: conversation.id });
  } catch (error) {
    console.error("[Cobrança open-chat] erro:", error);
    return NextResponse.json(
      { ok: false, error: "Erro ao abrir conversa" },
      { status: 500 }
    );
  }
}
