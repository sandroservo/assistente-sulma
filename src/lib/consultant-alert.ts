import { prisma } from "@/lib/prisma";
import { emitConversationUpdate } from "@/lib/realtime";

/** A Sulma ofereceu encaminhar para consultora/atendente. */
export function isConsultantOffer(text: string): boolean {
  const t = String(text || "").toLowerCase();
  if (!t.trim()) return false;
  if (t.includes("encaminhar") && (t.includes("consultor") || t.includes("atendente") || t.includes("equipe"))) {
    return true;
  }
  if (t.includes("transferir") && (t.includes("atendente") || t.includes("consultor") || t.includes("humano"))) {
    return true;
  }
  if (t.includes("vou te transferir") || t.includes("vou transferir")) return true;
  if (t.includes("chamar um atendente") || t.includes("chamar uma consultora")) return true;
  if (t.includes("consultora que vai poder") || t.includes("consultor que vai poder")) return true;
  return false;
}

export function isAffirmativeReply(text: string): boolean {
  const t = String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  return /^(sim+|pode|pode sim|pode ser|quero|claro|ok+|beleza|encaminha|encaminhe|faz isso|pode fazer|isso|uhum|isso mesmo)\b/.test(t);
}

export function isNegativeReply(text: string): boolean {
  const t = String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  return /^(nao|nao precisa|agora nao|deixa|deixa quieto|obrigad)/.test(t) && !t.includes("nao consigo");
}

export async function alertConsultants(opts: {
  leadId: string;
  conversationId: string;
  requestedBy: "bot" | "lead" | "human";
  reason: string;
  summary?: string;
  takeOverBot?: boolean;
}): Promise<boolean> {
  const lead = await prisma.lead.findUnique({
    where: { id: opts.leadId },
    select: { id: true, name: true, pushName: true, phone: true, status: true, ownerType: true },
  });
  if (!lead) return false;
  if (lead.status === "HUMANO_EM_ATENDIMENTO" && lead.ownerType === "human") return false;

  const alreadyWaiting = lead.status === "HUMANO_SOLICITADO";
  const open = await prisma.handoff.findFirst({
    where: { conversationId: opts.conversationId, status: "open" },
    select: { id: true },
  });

  await prisma.lead.update({
    where: { id: opts.leadId },
    data: {
      status: "HUMANO_SOLICITADO",
      ...(opts.takeOverBot ? { ownerType: "human" } : {}),
    },
  });

  if (!open) {
    await prisma.handoff.create({
      data: {
        leadId: opts.leadId,
        conversationId: opts.conversationId,
        requestedBy: opts.requestedBy,
        reason: opts.reason,
        summary: opts.summary?.slice(0, 500) || null,
        status: "open",
      },
    });
  }

  if (alreadyWaiting && open) return false;

  emitConversationUpdate({
    type: "handoff",
    conversationId: opts.conversationId,
    leadId: opts.leadId,
    name: lead.name || lead.pushName || lead.phone,
    reason: opts.reason,
  });
  return true;
}
