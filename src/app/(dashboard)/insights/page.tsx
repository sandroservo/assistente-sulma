/**
 * Insights — disparos por usuário (card por consultor). Só admin.
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Megaphone } from "lucide-react";

export const dynamic = "force-dynamic";

interface UserRow {
  id: string;
  name: string;
  email: string | null;
  enviados: bigint;
  falhas: bigint;
  disparos: bigint;
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
}

export default async function InsightsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const isAdmin = session.user.role === "OWNER" || session.user.role === "ADMIN";
  if (!isAdmin) redirect("/");

  const rows = await prisma.$queryRaw<UserRow[]>`
    SELECT
      u.id, u.name, u.email,
      COUNT(cc.id) FILTER (WHERE cc.status IN ('sent','delivered','read')) AS enviados,
      COUNT(cc.id) FILTER (WHERE cc.status = 'failed') AS falhas,
      COUNT(DISTINCT r.id) AS disparos
    FROM "User" u
    LEFT JOIN "CampaignRun" r ON r."createdByUserId" = u.id
    LEFT JOIN "CampaignContact" cc ON cc."runId" = r.id
    WHERE u."organizationId" = ${session.user.organizationId} AND u.active = true
    GROUP BY u.id, u.name, u.email
    ORDER BY enviados DESC, u.name ASC
  `;

  const totalEnviados = rows.reduce((s, r) => s + Number(r.enviados), 0);

  // Listagem de disparos de todos os consultores (medir campanhas dos outros).
  const runs = await prisma.campaignRun.findMany({
    where: { campaign: { organizationId: session.user.organizationId } },
    orderBy: { startedAt: "desc" },
    take: 60,
    select: {
      id: true,
      status: true,
      total: true,
      sent: true,
      failed: true,
      skipped: true,
      startedAt: true,
      campaign: { select: { name: true } },
      createdByUser: { select: { name: true } },
    },
  });

  const STATUS_LABEL: Record<string, string> = {
    RUNNING: "Enviando", PAUSED: "Pausada", DONE: "Concluída", CANCELLED: "Cancelada", DRAFT: "Rascunho", SCHEDULED: "Agendada",
  };
  const STATUS_CLS: Record<string, string> = {
    RUNNING: "bg-amber-100 text-amber-700", PAUSED: "bg-orange-100 text-orange-800",
    DONE: "bg-green-100 text-green-700", CANCELLED: "bg-red-100 text-red-700",
    DRAFT: "bg-gray-100 text-gray-600", SCHEDULED: "bg-blue-100 text-blue-700",
  };
  const fmt = (d: Date) => new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="p-4 pt-14 md:p-6 md:pt-6 space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Insights</h1>
          <p className="text-gray-500 text-sm">Disparos por consultor.</p>
        </div>
        <p className="text-sm text-gray-500">{totalEnviados} enviados no total</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((u) => (
          <Card key={u.id} className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-[#001A5E] text-white text-sm font-bold flex items-center justify-center shrink-0">
                {initials(u.name)}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-800 truncate">{u.name}</p>
                {u.email && <p className="text-xs text-gray-500 truncate">{u.email}</p>}
              </div>
            </div>
            <div className="flex items-end gap-2">
              <Megaphone className="w-5 h-5 text-[#001A5E] mb-1" />
              <span className="text-3xl font-bold text-gray-800 leading-none">{Number(u.enviados)}</span>
              <span className="text-sm text-gray-500 mb-0.5">enviados</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {Number(u.disparos)} campanha{Number(u.disparos) === 1 ? "" : "s"}
              {Number(u.falhas) > 0 ? ` · ${Number(u.falhas)} falha${Number(u.falhas) === 1 ? "" : "s"}` : ""}
            </p>
          </Card>
        ))}
      </div>

      {/* Listagem de disparos de todos os consultores */}
      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Disparos de todos os consultores</h2>
          <p className="text-xs text-gray-500">Últimos {runs.length} disparos da organização.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="px-4 py-2 font-medium">Consultor</th>
                <th className="px-4 py-2 font-medium">Campanha</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium text-right">Enviados</th>
                <th className="px-4 py-2 font-medium text-right">Falhas</th>
                <th className="px-4 py-2 font-medium text-right">Total</th>
                <th className="px-4 py-2 font-medium">Início</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">Nenhum disparo ainda.</td></tr>
              )}
              {runs.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-800">{r.createdByUser?.name || "—"}</td>
                  <td className="px-4 py-2 text-gray-700 max-w-[220px] truncate">{r.campaign.name}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS_CLS[r.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-green-700 font-medium">{r.sent}</td>
                  <td className="px-4 py-2 text-right text-red-600">{r.failed}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{r.total}</td>
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{fmt(r.startedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
