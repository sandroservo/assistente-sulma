/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ReportsView } from "./ui/ReportsView";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { dias } = await searchParams;
  const days = [7, 30, 90].includes(Number(dias)) ? Number(dias) : 30;

  // Busca usuários da organização
  const users = await prisma.user.findMany({
    where: { 
      organizationId: session.user.organizationId,
      active: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  // Janela do período selecionado
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - days);

  const handoffs = await prisma.handoff.findMany({
    where: {
      lead: {
        organizationId: session.user.organizationId,
      },
      createdAt: { gte: thirtyDaysAgo },
    },
    include: {
      lead: true,
      assignedTo: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // Busca total de leads por status
  const leadsByStatus = await prisma.lead.groupBy({
    by: ["status"],
    where: {
      organizationId: session.user.organizationId,
    },
    _count: true,
  });

  // Busca total de mensagens por direção (últimos 30 dias)
  const messages = await prisma.message.groupBy({
    by: ["direction"],
    where: {
      conversation: {
        lead: {
          organizationId: session.user.organizationId,
        },
      },
      createdAt: { gte: thirtyDaysAgo },
    },
    _count: true,
  });

  // Mensagens enviadas por usuário (30 dias)
  const messagesByUser = await prisma.message.groupBy({
    by: ["sentByUserId"],
    where: {
      sentByUserId: { not: null },
      createdAt: { gte: thirtyDaysAgo },
      direction: "out",
    },
    _count: true,
  });

  // Tempo médio de resposta por usuário (primeira msg humana após handoff)
  const avgResponseTimes = await prisma.$queryRaw<Array<{ user_id: string; avg_seconds: number }>>`
    SELECT 
      m."sentByUserId" as user_id,
      AVG(EXTRACT(EPOCH FROM (m."createdAt" - h."updatedAt"))) as avg_seconds
    FROM "Message" m
    JOIN "Handoff" h ON h."conversationId" = m."conversationId" AND h."assignedToId" = m."sentByUserId"
    WHERE m."sentByUserId" IS NOT NULL
      AND m.direction = 'out'
      AND m."createdAt" >= ${thirtyDaysAgo}
      AND m."createdAt" > h."updatedAt"
      AND EXTRACT(EPOCH FROM (m."createdAt" - h."updatedAt")) > 0
      AND EXTRACT(EPOCH FROM (m."createdAt" - h."updatedAt")) < 86400
    GROUP BY m."sentByUserId"
  `;

  // Leads qualificados/fechados onde o usuário foi o último atendente
  const conversionsPerUser = await prisma.$queryRaw<Array<{ user_id: string; qualified: bigint; closed: bigint }>>`
    SELECT 
      h."assignedToId" as user_id,
      COUNT(DISTINCT CASE WHEN l.status IN ('QUALIFICADO', 'EM_NEGOCIACAO', 'PROPOSTA_ENVIADA') THEN l.id END) as qualified,
      COUNT(DISTINCT CASE WHEN l.status = 'FECHADO' THEN l.id END) as closed
    FROM "Handoff" h
    JOIN "Lead" l ON l.id = h."leadId"
    WHERE h."assignedToId" IS NOT NULL
      AND h."createdAt" >= ${thirtyDaysAgo}
    GROUP BY h."assignedToId"
  `;

  // Conversas: abertas x encerradas (snapshot atual da org)
  const orgLeadFilter = { lead: { organizationId: session.user.organizationId } };
  const [conversationsOpen, conversationsClosed] = await Promise.all([
    prisma.conversation.count({ where: { ...orgLeadFilter, status: "open" } }),
    prisma.conversation.count({ where: { ...orgLeadFilter, status: "closed" } }),
  ]);

  // Distribuição de conversas por setor
  const sectors = await prisma.sector.findMany({
    where: { organizationId: session.user.organizationId },
    select: { id: true, name: true, color: true },
  });
  const bySector = await prisma.conversation.groupBy({
    by: ["sectorId"],
    where: { ...orgLeadFilter, sectorId: { not: null } },
    _count: true,
  });
  const sectorCountMap = new Map(bySector.map((s) => [s.sectorId, s._count]));
  const sectorsDistribution = sectors
    .map((s) => ({ name: s.name, color: s.color, count: sectorCountMap.get(s.id) || 0 }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);

  // Conversas ativas (abertas) atribuídas por atendente
  const activeByUser = await prisma.conversation.groupBy({
    by: ["assignedUserId"],
    where: { ...orgLeadFilter, status: "open", assignedUserId: { not: null } },
    _count: true,
  });
  const activeMap = new Map(activeByUser.map((a) => [a.assignedUserId, a._count]));

  // Calcula estatísticas por usuário
  const msgMap = new Map(messagesByUser.map(m => [m.sentByUserId, m._count]));
  const respTimeMap = new Map(avgResponseTimes.map(r => [r.user_id, Math.round(r.avg_seconds)]));
  const convMap = new Map(conversionsPerUser.map(c => [c.user_id, { qualified: Number(c.qualified), closed: Number(c.closed) }]));

  const userStats = users.map((user: typeof users[number]) => {
    const userHandoffs = handoffs.filter((h: typeof handoffs[number]) => h.assignedToId === user.id);
    const completed = userHandoffs.filter((h: typeof handoffs[number]) => h.status === "closed").length;
    const conv = convMap.get(user.id) || { qualified: 0, closed: 0 };
    
    return {
      ...user,
      totalHandoffs: userHandoffs.length,
      completedHandoffs: completed,
      pendingHandoffs: userHandoffs.length - completed,
      messagesSent: msgMap.get(user.id) || 0,
      avgResponseTimeSec: respTimeMap.get(user.id) || 0,
      leadsQualified: conv.qualified,
      leadsClosed: conv.closed,
      activeConversations: activeMap.get(user.id) || 0,
    };
  });

  const stats = {
    totalLeads: leadsByStatus.reduce((acc: number, curr: typeof leadsByStatus[number]) => acc + curr._count, 0),
    leadsByStatus: leadsByStatus.map((l: typeof leadsByStatus[number]) => ({
      status: l.status,
      count: l._count,
    })),
    messagesIn: messages.find((m: typeof messages[number]) => m.direction === "in")?._count || 0,
    messagesOut: messages.find((m: typeof messages[number]) => m.direction === "out")?._count || 0,
    totalHandoffs: handoffs.length,
    completedHandoffs: handoffs.filter((h: typeof handoffs[number]) => h.status === "closed").length,
    conversationsOpen,
    conversationsClosed,
    sectorsDistribution,
  };

  return (
    <div className="p-4 pt-14 md:p-6 md:pt-6">
      <ReportsView
        userStats={userStats}
        stats={stats}
        days={days}
      />
    </div>
  );
}
