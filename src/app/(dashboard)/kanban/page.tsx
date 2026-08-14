/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { LeadsKanbanWrapper } from "@/app/(dashboard)/leads/ui/LeadsKanbanWrapper";

export default async function KanbanPage() {
  const leadsData = await prisma.lead.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      tags: true,
      conversations: {
        orderBy: { lastMessageAt: "desc" },
        take: 1,
      },
    },
  });

  const leads = leadsData.map((lead: typeof leadsData[number]) => ({
    id: lead.id,
    name: lead.name,
    pushName: lead.pushName,
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
    conversationId: lead.conversations[0]?.id || null,
    tags: lead.tags.map(t => ({ id: t.id, name: t.name, color: t.color })),
    responsible: null,
  }));

  return (
    <div className="p-4 pt-14 md:p-6 md:pt-6 space-y-4 md:space-y-6 h-full">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-800">Tarefas</h1>
        <p className="text-gray-500">
          Gerencie seus leads no formato Kanban
        </p>
      </div>

      <LeadsKanbanWrapper initialLeads={leads} />
    </div>
  );
}
