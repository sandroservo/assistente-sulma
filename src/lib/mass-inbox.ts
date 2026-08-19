/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Grava disparo/campanha na conversa do destinatário (inbox),
 * para o atendente ver o que o lead recebeu.
 */

import { prisma } from "@/lib/prisma";
import { emitConversationUpdate } from "@/lib/realtime";
import { formatPhone } from "@/lib/formatters";

export type MassSource = "campaign" | "broadcast";

export type MassOutboundResult = {
  messageId: string;
  conversationId: string;
  leadId: string;
  leadName: string;
  contactName: string;
  phone: string;
};

function digitsOf(phone: string): string {
  return String(phone || "").replace(/\D/g, "");
}

function tailOf(phone: string): string {
  return digitsOf(phone).slice(-8);
}

export function extractEvolutionMessageId(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  const nested = r.data && typeof r.data === "object" ? (r.data as Record<string, unknown>) : null;
  const key = (r.key || nested?.key) as Record<string, unknown> | undefined;
  const id = key?.id ?? r.id;
  return typeof id === "string" && id ? id : null;
}

async function findSavedContactName(organizationId: string, phone: string): Promise<string | null> {
  const tail = tailOf(phone);
  if (tail.length < 8) return null;
  const saved = await prisma.savedContact.findFirst({
    where: { organizationId, phone: { contains: tail } },
    select: { name: true },
    orderBy: { updatedAt: "desc" },
  });
  return saved?.name?.trim() || null;
}

/**
 * Cria (ou reutiliza) lead + conversa e insere a mensagem de disparo/campanha
 * ANTES do envio na Evolution, para o webhook fromMe não duplicar nem assumir o bot.
 */
export async function prepareMassOutbound(opts: {
  organizationId: string;
  phone: string;
  name?: string | null;
  body: string;
  mediaUrl?: string | null;
  type?: "text" | "image";
  source: MassSource;
  sourceLabel: string;
}): Promise<MassOutboundResult> {
  const digits = digitsOf(opts.phone);
  if (digits.length < 8) {
    throw new Error("Telefone inválido para gravar no chat");
  }
  const tail = digits.slice(-8);

  let lead = await prisma.lead.findFirst({
    where: { organizationId: opts.organizationId, phone: { contains: tail } },
  });

  const givenName = opts.name?.trim() || null;
  const contactName =
    (await findSavedContactName(opts.organizationId, digits)) || givenName || digits;

  if (!lead) {
    lead = await prisma.lead.create({
      data: {
        organizationId: opts.organizationId,
        phone: digits,
        name: givenName || contactName,
        status: "NOVO",
        ownerType: "bot",
        lastMessageAt: new Date(),
        source: opts.source,
      },
    });
    await prisma.savedContact
      .create({
        data: {
          organizationId: opts.organizationId,
          name: contactName,
          phone: digits,
          category: "lead",
        },
      })
      .catch(() => {});
  } else {
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        lastMessageAt: new Date(),
        ...(givenName && !lead.name ? { name: givenName } : {}),
      },
    });
  }

  const leadName = lead.name || lead.pushName || givenName || contactName || formatPhone(digits);

  let conversation = await prisma.conversation.findFirst({
    where: { leadId: lead.id },
  });
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        leadId: lead.id,
        remoteJid: `${digits}@s.whatsapp.net`,
        channel: "whatsapp",
        lastMessageAt: new Date(),
        unreadCount: 0,
        status: "open",
      },
    });
  } else {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), status: "open" },
    });
  }

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "out",
      type: opts.mediaUrl ? "image" : opts.type || "text",
      body: opts.body,
      mediaUrl: opts.mediaUrl || null,
      status: "pending",
      source: opts.source,
      sourceLabel: opts.sourceLabel,
      sentAt: new Date(),
    },
  });

  emitConversationUpdate({
    type: "message",
    conversationId: conversation.id,
    leadId: lead.id,
  });

  return {
    messageId: message.id,
    conversationId: conversation.id,
    leadId: lead.id,
    leadName,
    contactName,
    phone: lead.phone || digits,
  };
}

export async function confirmMassOutbound(messageId: string, providerId: string | null) {
  await prisma.message.update({
    where: { id: messageId },
    data: {
      status: "sent",
      ...(providerId ? { providerId } : {}),
    },
  });
}

export async function revertMassOutbound(messageId: string) {
  await prisma.message.delete({ where: { id: messageId } }).catch(() => {});
}
