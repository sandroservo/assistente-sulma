/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

"use client";

import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  MessageSquare,
  CheckCircle2,
  Clock,
  TrendingUp,
  UserCheck,
  MessageCircle,
  Headphones,
  Layers,
  MessageSquareOff,
  Eye,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS } from "@/lib/lead-funnel";

interface UserStat {
  id: string;
  name: string;
  email: string;
  role: string;
  totalHandoffs: number;
  completedHandoffs: number;
  pendingHandoffs: number;
  messagesSent: number;
  avgResponseTimeSec: number;
  leadsQualified: number;
  leadsClosed: number;
  activeConversations: number;
}

interface LeadByStatus {
  status: string;
  count: number;
}

interface SectorDist {
  name: string;
  color: string;
  count: number;
}

interface Stats {
  totalLeads: number;
  leadsByStatus: LeadByStatus[];
  messagesIn: number;
  messagesOut: number;
  messagesRead: number;
  totalHandoffs: number;
  completedHandoffs: number;
  conversationsOpen: number;
  conversationsClosed: number;
  sectorsDistribution: SectorDist[];
}

interface OrgSla {
  tmeSeconds: number;
  tmaSeconds: number;
  tmrSeconds: number;
}

interface ReportsViewProps {
  userStats: UserStat[];
  stats: Stats;
  days: number;
  sla?: OrgSla;
}

function fmtDuration(sec: number): string {
  if (!sec || sec <= 0) return "—";
  if (sec < 60) return `${Math.round(sec)}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}min`;
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return m ? `${h}h ${m}min` : `${h}h`;
}

const STATUS_LABELS = LEAD_STATUS_LABELS;
const STATUS_COLORS = LEAD_STATUS_COLORS;

export function ReportsView({ userStats, stats, days, sla }: ReportsViewProps) {
  const router = useRouter();
  const totalConv = stats.conversationsOpen + stats.conversationsClosed;
  const closeRate = totalConv > 0 ? Math.round((stats.conversationsClosed / totalConv) * 100) : 0;
  const maxSector = Math.max(1, ...stats.sectorsDistribution.map((s) => s.count));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Relatórios</h1>
          <p className="text-gray-500">Visão geral dos atendimentos (últimos {days} dias)</p>
        </div>
        {/* Seletor de período */}
        <div className="flex gap-1.5">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => router.push(`/reports?dias=${d}`)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                days === d ? "bg-[#001A5E] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {d} dias
            </button>
          ))}
        </div>
      </div>

      {/* Cards de conversas: abertas / encerradas / taxa */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Conversas Abertas</p>
              <p className="text-2xl font-bold text-gray-800">{stats.conversationsOpen}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center">
              <MessageSquareOff className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Conversas Encerradas</p>
              <p className="text-2xl font-bold text-gray-800">{stats.conversationsClosed}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Taxa de Encerramento</p>
              <p className="text-2xl font-bold text-gray-800">{closeRate}%</p>
            </div>
          </div>
        </Card>
      </div>

      {/* SLA: TME / TMA / TMR (doc §5.2) */}
      {sla && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5">
            <p className="text-sm text-gray-500">Tempo Médio de Espera (TME)</p>
            <p className="text-2xl font-bold text-gray-800">{fmtDuration(sla.tmeSeconds)}</p>
            <p className="text-[11px] text-gray-400">fila → primeiro atendimento</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-gray-500">Tempo Médio de Atendimento (TMA)</p>
            <p className="text-2xl font-bold text-gray-800">{fmtDuration(sla.tmaSeconds)}</p>
            <p className="text-[11px] text-gray-400">início → encerramento</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-gray-500">Tempo Médio de Resposta (TMR)</p>
            <p className="text-2xl font-bold text-gray-800">{fmtDuration(sla.tmrSeconds)}</p>
            <p className="text-[11px] text-gray-400">contato → resposta do agente</p>
          </Card>
        </div>
      )}

      {/* Conversas por setor */}
      {stats.sectorsDistribution.length > 0 && (
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#001A5E]" />
            Conversas por Setor
          </h2>
          <div className="space-y-3">
            {stats.sectorsDistribution.map((s) => (
              <div key={s.name} className="flex items-center gap-3">
                <span className="flex items-center gap-2 w-32 shrink-0 text-sm text-gray-700">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="truncate">{s.name}</span>
                </span>
                <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(s.count / maxSector) * 100}%`, backgroundColor: s.color }}
                  />
                </div>
                <span className="text-sm font-bold text-gray-700 min-w-[32px] text-right">{s.count}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Cards de métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#001A5E] to-[#003080] flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total de Leads</p>
              <p className="text-2xl font-bold text-gray-800">{stats.totalLeads}</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Mensagens Recebidas</p>
              <p className="text-2xl font-bold text-gray-800">{stats.messagesIn}</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Mensagens Enviadas</p>
              <p className="text-2xl font-bold text-gray-800">{stats.messagesOut}</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center">
              <Eye className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Mensagens Visualizadas</p>
              <p className="text-2xl font-bold text-gray-800">{stats.messagesRead}</p>
              <p className="text-xs text-gray-400">
                {stats.messagesOut > 0
                  ? `${Math.round((stats.messagesRead / stats.messagesOut) * 100)}% das enviadas`
                  : "enviadas com visto"}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
              <Headphones className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Transferências</p>
              <p className="text-2xl font-bold text-gray-800">
                {stats.completedHandoffs}/{stats.totalHandoffs}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Leads por status */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#001A5E]" />
          Leads por Status
        </h2>
        <div className="flex flex-wrap gap-3">
          {stats.leadsByStatus.map((item) => (
            <div 
              key={item.status}
              className="flex items-center gap-2 bg-gray-50 rounded-lg px-4 py-2"
            >
              <Badge className={cn("text-xs", STATUS_COLORS[item.status])}>
                {STATUS_LABELS[item.status] || item.status}
              </Badge>
              <span className="text-lg font-bold text-gray-800">{item.count}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Desempenho por usuário */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold text-gray-800 mb-5 flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-[#001A5E]" />
          Desempenho por Usuário
        </h2>

        {userStats.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Nenhum usuário encontrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {userStats.map((user) => {
              const completionRate = user.totalHandoffs > 0 
                ? Math.round((user.completedHandoffs / user.totalHandoffs) * 100)
                : 0;

              const roleLabel = user.role === "OWNER" ? "Proprietário"
                : user.role === "ADMIN" ? "Administrador"
                : user.role === "AGENT" ? "Atendente"
                : "Visualizador";

              const responseTime = user.avgResponseTimeSec > 0
                ? user.avgResponseTimeSec >= 3600
                  ? `${Math.round(user.avgResponseTimeSec / 3600)}h ${Math.round((user.avgResponseTimeSec % 3600) / 60)}min`
                  : user.avgResponseTimeSec >= 60
                    ? `${Math.round(user.avgResponseTimeSec / 60)}min`
                    : `${user.avgResponseTimeSec}s`
                : "—";

              const responseColor = user.avgResponseTimeSec === 0 ? "text-gray-400"
                : user.avgResponseTimeSec <= 300 ? "text-green-600"
                : user.avgResponseTimeSec <= 900 ? "text-yellow-600"
                : "text-red-600";

              return (
                <div
                  key={user.id}
                  className="border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow bg-white"
                >
                  {/* Header do card */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#001A5E] to-[#003080] flex items-center justify-center text-white text-sm font-bold shrink-0">
                      {user.name?.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 truncate">{user.name}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 truncate">{user.email}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                          {roleLabel}
                        </Badge>
                        {user.activeConversations > 0 && (
                          <Badge className="text-[10px] px-1.5 py-0 shrink-0 bg-emerald-100 text-emerald-700">
                            {user.activeConversations} ativa{user.activeConversations !== 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Métricas principais */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <div className="bg-blue-50 rounded-lg p-2.5 text-center">
                      <MessageSquare className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                      <p className="text-lg font-bold text-blue-700">{user.messagesSent}</p>
                      <p className="text-[10px] text-blue-500 leading-tight">Msgs enviadas</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-2.5 text-center">
                      <Clock className={cn("w-4 h-4 mx-auto mb-1", responseColor)} />
                      <p className={cn("text-lg font-bold", responseColor)}>{responseTime}</p>
                      <p className="text-[10px] text-purple-500 leading-tight">Tempo resposta</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-2.5 text-center">
                      <TrendingUp className="w-4 h-4 text-green-500 mx-auto mb-1" />
                      <p className="text-lg font-bold text-green-700">{user.leadsQualified}</p>
                      <p className="text-[10px] text-green-500 leading-tight">Qualificados</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-2.5 text-center">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                      <p className="text-lg font-bold text-emerald-700">{user.leadsClosed}</p>
                      <p className="text-[10px] text-emerald-500 leading-tight">Matrículas</p>
                    </div>
                  </div>

                  {/* Handoffs + barra de progresso */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Headphones className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-xs font-medium text-gray-600">Atendimentos</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-gray-500">{user.totalHandoffs} total</span>
                        <span className="inline-flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="w-3 h-3" />
                          {user.completedHandoffs}
                        </span>
                        <span className="inline-flex items-center gap-1 text-orange-500">
                          <Clock className="w-3 h-3" />
                          {user.pendingHandoffs}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            completionRate >= 70 ? "bg-green-500" :
                            completionRate >= 40 ? "bg-yellow-500" : "bg-red-400"
                          )}
                          style={{ width: `${completionRate}%` }}
                        />
                      </div>
                      <span className={cn(
                        "text-xs font-bold min-w-[36px] text-right",
                        completionRate >= 70 ? "text-green-600" :
                        completionRate >= 40 ? "text-yellow-600" : "text-red-500"
                      )}>
                        {completionRate}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
