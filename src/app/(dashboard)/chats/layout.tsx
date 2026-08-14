/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Layout do Chats — estrutura WhatsApp-like com sidebar de conversas persistente
 */

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import ConversationSidebar from "./ui/ConversationSidebar";

export const dynamic = "force-dynamic";

export default async function ChatsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const [convos, sectors, users] = await Promise.all([
    prisma.conversation.findMany({
      orderBy: { lastMessageAt: "desc" },
      include: {
        lead: { include: { tags: { select: { id: true, name: true, color: true } } } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { body: true, type: true, direction: true },
        },
      },
      take: 200,
    }),
    prisma.sector.findMany({ where: { active: true }, select: { id: true, name: true, color: true } }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);
  const sectorMap = new Map(sectors.map((s) => [s.id, s]));
  const userMap = new Map(users.map((u) => [u.id, u.name]));

  // Uma conversa por lead (evita duplicata)
  const byLeadId = new Map<string, (typeof convos)[number]>();
  for (const c of convos) {
    if (!byLeadId.has(c.leadId)) byLeadId.set(c.leadId, c);
  }
  const uniqueConvos = Array.from(byLeadId.values()).sort(
    (a, b) =>
      (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0)
  );

  const conversations = uniqueConvos.map((c) => {
    const lastMsg = (c as any).messages?.[0] ?? null;
    const sec = (c as any).sectorId ? sectorMap.get((c as any).sectorId) : null;
    return {
      id: c.id,
      leadId: c.leadId,
      name: c.lead.name,
      pushName: c.lead.pushName,
      avatarUrl: c.lead.avatarUrl,
      phone: c.lead.phone,
      status: c.lead.status as string,
      convStatus: (c as any).status ?? "open",
      isPinned: (c as any).isPinned ?? false,
      sectorId: (c as any).sectorId ?? null,
      sectorName: sec?.name ?? null,
      sectorColor: sec?.color ?? null,
      assignedUserId: (c as any).assignedUserId ?? null,
      assignedUserName: (c as any).assignedUserId ? userMap.get((c as any).assignedUserId) ?? null : null,
      ownerType: c.lead.ownerType as string,
      leadScore: (c.lead as any).leadScore ?? 0,
      unreadCount: c.unreadCount,
      lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
      lastMessageBody: lastMsg?.body ?? null,
      lastMessageType: lastMsg?.type ?? "text",
      lastMessageDirection: lastMsg?.direction ?? "in",
      tags: ((c.lead as any).tags ?? []) as { id: string; name: string; color: string }[],
    };
  });

  return (
    <div className="flex h-full overflow-hidden">
      <ConversationSidebar
        initialConversations={conversations}
        currentUserId={session?.user?.id ?? null}
        sectors={sectors}
      />
      <div className="flex-1 min-w-0 h-full">{children}</div>
    </div>
  );
}
