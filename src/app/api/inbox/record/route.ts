/**
 * Registra na inbox da Sulma uma mensagem enviada por OUTRO sistema (ex.: cobrança
 * do sistema Amo Vidas), pro atendente ver a conversa completa no chat.
 * Auth: Bearer == AMOVIDAS_AGENT_TOKEN (mesmo secret compartilhado sistema↔Sulma).
 * Dedup por providerId (evita duplicar se o Evolution também ecoar o fromMe).
 * POST /api/inbox/record { phone, text, providerId?, name? }
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emitConversationUpdate } from "@/lib/realtime";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || token !== process.env.AMOVIDAS_AGENT_TOKEN) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { phone, text, providerId, name, tag, source } = await req.json().catch(() => ({}));
    const digits = String(phone || "").replace(/\D/g, "");
    if (digits.length < 8 || !text) {
      return NextResponse.json({ error: "phone/text obrigatórios" }, { status: 400 });
    }
    const tail = digits.slice(-8);

    // Dedup: se já existe mensagem com este providerId, não duplica.
    if (providerId) {
      const existing = await prisma.message.findFirst({ where: { providerId } });
      if (existing) return NextResponse.json({ ok: true, deduped: true });
    }

    const org = await prisma.organization.findFirst({ orderBy: { name: "asc" } });
    if (!org) return NextResponse.json({ error: "Sem organização" }, { status: 500 });

    // Tag opcional (ex.: campanha) — cria se não existir e conecta ao lead.
    let tagId: string | null = null;
    const tagName = typeof tag === "string" ? tag.trim().slice(0, 60) : "";
    if (tagName) {
      // Race-safe: upsert concorrente da MESMA tag pode dar P2002 — cai no findUnique.
      try {
        const t = await prisma.tag.upsert({
          where: { organizationId_name: { organizationId: org.id, name: tagName } },
          update: {},
          create: { organizationId: org.id, name: tagName },
        });
        tagId = t.id;
      } catch {
        const t = await prisma.tag.findUnique({
          where: { organizationId_name: { organizationId: org.id, name: tagName } },
        });
        tagId = t?.id ?? null;
      }
    }

    let lead = await prisma.lead.findFirst({
      where: { organizationId: org.id, phone: { contains: tail } },
    });
    if (!lead) {
      lead = await prisma.lead.create({
        data: {
          organizationId: org.id, phone: digits, name: name || null,
          status: "NOVO", ownerType: "bot", lastMessageAt: new Date(),
          ...(source ? { source: String(source).slice(0, 40) } : {}),
          ...(tagId ? { tags: { connect: { id: tagId } } } : {}),
        },
      });
    } else {
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          lastMessageAt: new Date(),
          // Nome do cadastro da campanha tem prioridade quando fornecido.
          ...(name ? { name } : {}),
          ...(tagId ? { tags: { connect: { id: tagId } } } : {}),
        },
      });
    }

    let conversation = await prisma.conversation.findFirst({ where: { leadId: lead.id } });
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { leadId: lead.id, remoteJid: `${digits}@s.whatsapp.net`, channel: "whatsapp", lastMessageAt: new Date(), unreadCount: 0 },
      });
    } else {
      await prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } });
    }

    await prisma.message.create({
      data: {
        conversationId: conversation.id, direction: "out", type: "text",
        body: String(text), providerId: providerId || null, status: "sent", sentAt: new Date(),
      },
    });

    emitConversationUpdate({ type: "message", conversationId: conversation.id, leadId: lead.id });
    return NextResponse.json({ ok: true, conversationId: conversation.id });
  } catch (error) {
    console.error("[inbox/record]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
