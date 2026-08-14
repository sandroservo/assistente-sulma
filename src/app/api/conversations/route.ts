/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 * 
 * API para listar conversas
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const convos = await prisma.conversation.findMany({
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
    });

    // Mapas p/ resolver nome de setor + atendente (tabelas pequenas).
    const [sectors, users] = await Promise.all([
      prisma.sector.findMany({ select: { id: true, name: true, color: true } }),
      prisma.user.findMany({ select: { id: true, name: true } }),
    ]);
    const sectorMap = new Map(sectors.map((s) => [s.id, s]));
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    // Uma conversa por lead (evita duplicata)
    const byLeadId = new Map<string, (typeof convos)[number]>();
    for (const c of convos) {
      if (!byLeadId.has(c.leadId)) byLeadId.set(c.leadId, c);
    }
    // Fixadas primeiro, depois por data.
    const uniqueConvos = Array.from(byLeadId.values()).sort((a, b) => {
      const pa = (a as any).isPinned ? 1 : 0;
      const pb = (b as any).isPinned ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0);
    });

    const conversations = uniqueConvos.map((c: (typeof uniqueConvos)[number]) => {
      const lastMsg = (c as any).messages?.[0] ?? null;
      const sec = (c as any).sectorId ? sectorMap.get((c as any).sectorId) : null;
      return {
        id: c.id,
        leadId: c.leadId,
        name: c.lead.name,
        pushName: c.lead.pushName,
        avatarUrl: c.lead.avatarUrl,
        phone: c.lead.phone,
        status: c.lead.status,
        convStatus: (c as any).status ?? "open", // atendimento: open | closed
        isPinned: (c as any).isPinned ?? false,
        sectorId: (c as any).sectorId ?? null,
        sectorName: sec?.name ?? null,
        sectorColor: sec?.color ?? null,
        assignedUserId: (c as any).assignedUserId ?? null,
        assignedUserName: (c as any).assignedUserId ? userMap.get((c as any).assignedUserId) ?? null : null,
        ownerType: c.lead.ownerType,
        leadScore: (c.lead as any).leadScore ?? 0,
        unreadCount: c.unreadCount,
        lastMessageAt: c.lastMessageAt,
        lastMessageBody: lastMsg?.body ?? null,
        lastMessageType: lastMsg?.type ?? "text",
        lastMessageDirection: lastMsg?.direction ?? "in",
        tags: ((c.lead as any).tags ?? []) as { id: string; name: string; color: string }[],
      };
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("Erro ao buscar conversas:", error);
    return NextResponse.json({ chats: [] }, { status: 500 });
  }
}
