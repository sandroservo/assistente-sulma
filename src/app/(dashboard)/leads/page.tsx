/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

import { prisma } from "@/lib/prisma";
import { Heart } from "lucide-react";
import { LeadsKanbanWrapper } from "./ui/LeadsKanbanWrapper";

export const dynamic = "force-dynamic";

const INITIAL_TAKE = 20;

export default async function LeadsPage() {
  const leadsData = await prisma.lead.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      tags: true,
      conversations: {
        take: 1,
        orderBy: { lastMessageAt: "desc" },
        select: { id: true },
      },
    },
    take: INITIAL_TAKE + 1,
  });

  const hasMore = leadsData.length > INITIAL_TAKE;
  const leadsDataPage = leadsData.slice(0, INITIAL_TAKE);

  const leads = leadsDataPage.map((lead: typeof leadsDataPage[number]) => ({
    id: lead.id,
    name: lead.name,
    pushName: (lead as { pushName?: string | null }).pushName ?? null,
    phone: lead.phone,
    status: lead.status,
    ownerType: lead.ownerType,
    category: lead.category || "geral",
    summary: lead.summary,
    priority: lead.priority || "low",
    source: lead.source || "whatsapp",
    leadScore: (lead as any).leadScore ?? 0,
    updatedAt: lead.updatedAt.toISOString(),
    createdAt: lead.createdAt.toISOString(),
    conversationId: lead.conversations[0]?.id ?? null,
    tags: lead.tags.map(t => ({ id: t.id, name: t.name, color: t.color })),
    responsible: null,
  }));

  return (
    <div className="p-4 pt-14 md:p-6 md:pt-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-4 md:mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-[#001A5E] to-[#003080] rounded-lg flex items-center justify-center shrink-0">
            <Heart className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-800">Kanban de Leads</h1>
            <p className="text-gray-500 text-sm">
              Novo → Entender → Orientar → Qualificar → Registrar → Matrícula
            </p>
          </div>
        </div>
      </div>

      {/* Kanban com scroll infinito */}
      <LeadsKanbanWrapper initialLeads={leads} initialHasMore={hasMore} />
    </div>
  );
}
