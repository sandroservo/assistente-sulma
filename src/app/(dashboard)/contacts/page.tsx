/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Página de Contatos — lista todos os leads com disparo em massa
 */

import { prisma } from "@/lib/prisma";
import { ContactsPageClient } from "./ui/ContactsPageClient";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const leads = await prisma.lead.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      pushName: true,
      phone: true,
      avatarUrl: true,
      status: true,
      category: true,
      leadScore: true,
      tags: { select: { id: true, name: true, color: true } },
      lastMessageAt: true,
      updatedAt: true,
    },
  });

  const contacts = leads.map((lead) => ({
    id: lead.id,
    name: lead.name || lead.pushName || "",
    phone: lead.phone,
    avatarUrl: lead.avatarUrl,
    status: lead.status,
    category: lead.category || "geral",
    leadScore: lead.leadScore ?? 0,
    tags: lead.tags,
    lastMessageAt: lead.lastMessageAt?.toISOString() ?? null,
  }));

  return <ContactsPageClient contacts={contacts} />;
}
