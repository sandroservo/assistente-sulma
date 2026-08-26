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
    </div>
  );
}
