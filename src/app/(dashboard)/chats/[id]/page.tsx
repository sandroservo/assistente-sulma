/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Página de conversa individual — layout WhatsApp com header, chat e sidebar
 */

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import ChatPageClient from "./ui/ChatPageClient";

export const dynamic = "force-dynamic";

export default async function ChatDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const convo = await prisma.conversation.findUnique({
    where: { id },
    include: {
      lead: {
        include: {
          tags: { select: { id: true, name: true, color: true } },
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 200,
        include: { sentByUser: { select: { id: true, name: true } } },
      },
    },
  });

  if (!convo) return notFound();

  // Marca como lida
  await prisma.conversation.update({
    where: { id },
    data: { unreadCount: 0 },
  });

  const lead = {
    id: convo.lead.id,
    organizationId: convo.lead.organizationId,
    name: convo.lead.name,
    pushName: convo.lead.pushName,
    avatarUrl: convo.lead.avatarUrl,
    phone: convo.lead.phone,
    email: convo.lead.email,
    city: convo.lead.city,
    status: convo.lead.status as string,
    ownerType: convo.lead.ownerType as string,
    leadScore: (convo.lead as any).leadScore ?? 0,
    summary: convo.lead.summary,
    notes: convo.lead.notes,
    tags: convo.lead.tags,
  };

  const messages = (convo.messages as any[]).map((m) => ({
    id: m.id,
    body: m.body ?? "",
    type: m.type ?? "text",
    mediaUrl: m.mediaUrl ?? null,
    transcription: m.transcription ?? null,
    direction: m.direction,
    createdAt: m.createdAt,
    sentByUserName: m.sentByUser?.name ?? null,
    providerId: m.providerId ?? null,
    quotedMessageId: m.quotedMessageId ?? null,
    status: m.status ?? null,
    editedAt: m.editedAt ? m.editedAt.toISOString() : null,
  }));

  return (
    <ChatPageClient
      conversationId={convo.id}
      convStatus={(convo as { status?: string }).status ?? "open"}
      sectorId={(convo as { sectorId?: string | null }).sectorId ?? null}
      assignedUserId={(convo as { assignedUserId?: string | null }).assignedUserId ?? null}
      currentUserId={session?.user?.id ?? null}
      lead={lead}
      initialMessages={messages}
    />
  );
}
