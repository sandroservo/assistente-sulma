/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { MessageSquare, Users, Clock, TrendingUp } from "lucide-react";
import { DashboardChart } from "@/components/DashboardChart";

export const dynamic = "force-dynamic";

function getStatusBadge(status: string, ownerType: string) {
  if (ownerType === "human") {
    return { label: "Humano", className: "bg-indigo-100 text-indigo-700" };
  }
  const statusMap: Record<string, { label: string; className: string }> = {
    NOVO: { label: "Novo", className: "bg-[#E8EDF8] text-[#001A5E]" },
    EM_ATENDIMENTO: { label: "Lead", className: "bg-violet-100 text-violet-700" },
    QUALIFICADO: { label: "Qualificado", className: "bg-green-100 text-green-700" },
    PROPOSTA_ENVIADA: { label: "Proposta", className: "bg-purple-100 text-purple-700" },
    FECHADO: { label: "Fechado", className: "bg-emerald-100 text-emerald-700" },
    HUMANO_SOLICITADO: { label: "Aguardando", className: "bg-orange-100 text-orange-700" },
    HUMANO_EM_ATENDIMENTO: { label: "Humano", className: "bg-indigo-100 text-indigo-700" },
  };
  return statusMap[status] || { label: status, className: "bg-gray-100 text-gray-700" };
}

function getStatusSubtitle(status: string, ownerType: string): string {
  if (ownerType === "human") return "Atendimento humano";
  if (status === "NOVO") return "Aguardando atendimento";
  if (status === "EM_ATENDIMENTO") return "Em atendimento";
  if (status === "QUALIFICADO") return "Qualificado";
  if (status === "HUMANO_SOLICITADO") return "Aguardando atendente";
  return "Em atendimento";
}

export default async function DashboardPage() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [leadsCount, conversationsCount, pendingCount, conversationsInAttendance] =
    await Promise.all([
      prisma.lead.count(),
      prisma.conversation.count(),
      prisma.lead.count({ where: { status: "NOVO" } }),
      prisma.conversation.findMany({
        orderBy: { lastMessageAt: "desc" },
        take: 8,
        include: { lead: true },
      }),
    ]);

  // Dados para gráficos
  const [leadsByDay, messagesByDay, leadsByStatus] = await Promise.all([
    prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
      SELECT DATE("createdAt") as day, COUNT(*) as count
      FROM "Lead"
      WHERE "createdAt" >= ${thirtyDaysAgo}
      GROUP BY DATE("createdAt")
      ORDER BY day
    `,
    prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
      SELECT DATE("createdAt") as day, COUNT(*) as count
      FROM "Message"
      WHERE "createdAt" >= ${thirtyDaysAgo}
      GROUP BY DATE("createdAt")
      ORDER BY day
    `,
    prisma.$queryRaw<Array<{ status: string; count: bigint }>>`
      SELECT status, COUNT(*) as count
      FROM "Lead"
      GROUP BY status
      ORDER BY count DESC
    `,
  ]);

  // Montar série de 30 dias
  const leadsMap = new Map(leadsByDay.map(r => [new Date(r.day).toISOString().slice(0, 10), Number(r.count)]));
  const msgsMap = new Map(messagesByDay.map(r => [new Date(r.day).toISOString().slice(0, 10), Number(r.count)]));

  const dailyData = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 29 + i);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    return {
      date: key,
      label,
      leads: leadsMap.get(key) || 0,
      mensagens: msgsMap.get(key) || 0,
    };
  });

  const statusLabels: Record<string, { label: string; color: string }> = {
    NOVO: { label: "Novo", color: "#F472B6" },
    EM_ATENDIMENTO: { label: "Atendimento", color: "#A78BFA" },
    CONSCIENTIZADO: { label: "Conscient.", color: "#60A5FA" },
    QUALIFICADO: { label: "Qualificado", color: "#34D399" },
    EM_NEGOCIACAO: { label: "Negociação", color: "#FBBF24" },
    PROPOSTA_ENVIADA: { label: "Proposta", color: "#C084FC" },
    FECHADO: { label: "Fechado", color: "#10B981" },
    HUMANO_SOLICITADO: { label: "Humano", color: "#FB923C" },
    HUMANO_EM_ATENDIMENTO: { label: "Hum. Atend.", color: "#818CF8" },
    PERDIDO: { label: "Perdido", color: "#9CA3AF" },
  };

  const statusData = leadsByStatus.map(r => {
    const info = statusLabels[r.status] || { label: r.status, color: "#9CA3AF" };
    return {
      status: r.status,
      label: info.label,
      count: Number(r.count),
      color: info.color,
    };
  });

  const stats = [
    {
      title: "Total de Leads",
      value: leadsCount,
      icon: Users,
      gradient: "from-blue-500 to-cyan-400",
      shadow: "shadow-blue-500/25",
    },
    {
      title: "Conversas",
      value: conversationsCount,
      icon: MessageSquare,
      gradient: "from-emerald-500 to-teal-400",
      shadow: "shadow-emerald-500/25",
    },
    {
      title: "Novos Leads",
      value: pendingCount,
      icon: Clock,
      gradient: "from-amber-500 to-orange-400",
      shadow: "shadow-amber-500/25",
    },
    {
      title: "Taxa de Conversão",
      value: leadsCount > 0 ? `${Math.round((conversationsCount / leadsCount) * 100)}%` : "0%",
      icon: TrendingUp,
      gradient: "from-[#001A5E] to-[#F9A825]",
      shadow: "shadow-[#001A5E]/25",
    },
  ];

  return (
    <div className="p-4 pt-14 md:p-6 md:pt-6 space-y-4 md:space-y-6 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Home &gt; Dashboard</p>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
        {stats.slice(0, 3).map((stat: typeof stats[number]) => (
          <div key={stat.title} className="bg-white rounded-xl p-5 border border-gray-100">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.gradient}`}>
                <stat.icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500">{stat.title}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-800">Clientes ativos</h2>
            <Link
              href="/chats"
              className="px-4 py-2 bg-[#001A5E] text-white text-sm font-medium rounded-lg hover:bg-[#003080] transition-colors"
            >
              Ver conversas
            </Link>
          </div>
          <DashboardChart dailyData={dailyData} statusData={statusData} />
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Atendimento</h2>
            <span className="text-sm text-gray-500">
              {conversationsInAttendance.length} conversa(s)
            </span>
          </div>
          <div className="space-y-3 max-h-[280px] overflow-y-auto">
            {conversationsInAttendance.length === 0 ? (
              <div className="py-8 text-center text-gray-500 text-sm">
                Nenhuma conversa ainda. As conversas do WhatsApp aparecerão aqui.
              </div>
            ) : (
              conversationsInAttendance.map((conv) => {
                const lead = conv.lead;
                const displayName =
                  lead.name || lead.pushName || lead.phone || "Sem nome";
                const badge = getStatusBadge(lead.status, lead.ownerType);
                const subtitle = getStatusSubtitle(lead.status, lead.ownerType);
                return (
                  <Link
                    key={conv.id}
                    href={`/chats/${conv.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                      {lead.avatarUrl ? (
                        <img
                          src={lead.avatarUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Users className="h-5 w-5 text-gray-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {displayName}
                      </p>
                      <p className="text-xs text-gray-500">{subtitle}</p>
                    </div>
                    {conv.unreadCount > 0 && (
                      <span className="shrink-0 w-5 h-5 rounded-full bg-[#001A5E] text-white text-xs flex items-center justify-center font-medium">
                        {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                      </span>
                    )}
                    <span
                      className={`shrink-0 px-2 py-1 text-xs font-medium rounded-full ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
          <Link
            href="/chats"
            className="block w-full mt-4 py-3 text-sm font-medium text-center text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Ir para atendimento
          </Link>
        </div>
      </div>
    </div>
  );
}
