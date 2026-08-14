/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Gráfico de novos leads por dia (últimos 30 dias) + leads por status.
 * Usa Recharts para renderização.
 */

"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";

interface DailyData {
  date: string;
  label: string;
  leads: number;
  mensagens: number;
}

interface StatusData {
  status: string;
  label: string;
  count: number;
  color: string;
}

interface DashboardChartProps {
  dailyData: DailyData[];
  statusData: StatusData[];
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 px-3 py-2 text-xs">
      <p className="font-medium text-gray-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-gray-600">
          <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: p.color }} />
          {p.name === "leads" ? "Leads" : "Mensagens"}: <span className="font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

function StatusTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: StatusData; value: number }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 px-3 py-2 text-xs">
      <p className="font-medium text-gray-700">{d.label}: <span className="font-semibold">{d.count}</span></p>
    </div>
  );
}

export function DashboardChart({ dailyData, statusData }: DashboardChartProps) {
  const totalLeads30d = dailyData.reduce((sum, d) => sum + d.leads, 0);
  const totalMsgs30d = dailyData.reduce((sum, d) => sum + d.mensagens, 0);

  return (
    <div className="space-y-6">
      {/* Resumo rápido */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-gradient-to-r from-[#001A5E] to-[#F9A825]" />
          <span className="text-xs text-gray-600">
            <span className="font-semibold text-gray-800">{totalLeads30d}</span> novos leads (30d)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-gradient-to-r from-violet-500 to-purple-400" />
          <span className="text-xs text-gray-600">
            <span className="font-semibold text-gray-800">{totalMsgs30d.toLocaleString("pt-BR")}</span> mensagens (30d)
          </span>
        </div>
      </div>

      {/* Gráfico de área — leads e mensagens por dia */}
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={dailyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradLeads" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#001A5E" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#001A5E" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradMsgs" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#9CA3AF" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#9CA3AF" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="mensagens"
              name="mensagens"
              stroke="#8B5CF6"
              strokeWidth={2}
              fill="url(#gradMsgs)"
            />
            <Area
              type="monotone"
              dataKey="leads"
              name="leads"
              stroke="#001A5E"
              strokeWidth={2}
              fill="url(#gradLeads)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Gráfico de barras — leads por status */}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
          Leads por status
        </p>
        <div className="h-[120px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={statusData} margin={{ top: 0, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: "#9CA3AF" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#9CA3AF" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<StatusTooltip />} />
              Feedback submitted
              <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={28}>
                {statusData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
