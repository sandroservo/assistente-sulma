/**
 * Suppression list: opt-out permanente e números que não devem receber disparo.
 */

import { prisma } from "@/lib/prisma";

const OPT_OUT_RE =
  /^(pare|parar|sair|stop|cancelar|cancela|descadastrar|unsubscribe|nao receber|não receber|remover)$/i;

export function normalizeSuppressionPhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(-11);
}

export function isOptOutText(text: string | null | undefined): boolean {
  const t = String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return false;
  return OPT_OUT_RE.test(t);
}

export async function isSuppressed(organizationId: string, phone: string): Promise<boolean> {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return false;
  const candidates = [...new Set([digits, digits.slice(-11), digits.slice(-8)].filter((p) => p.length >= 8))];
  const found = await prisma.excludedContact.findFirst({
    where: { organizationId, phone: { in: candidates } },
    select: { id: true },
  });
  return Boolean(found);
}

export async function suppressPhone(opts: {
  organizationId: string;
  phone: string;
  name?: string | null;
  reason: "manual" | "staff" | "opt_out";
}): Promise<{ created: boolean }> {
  const phone = normalizeSuppressionPhone(opts.phone);
  if (phone.length < 8) return { created: false };
  const existing = await prisma.excludedContact.findUnique({
    where: { organizationId_phone: { organizationId: opts.organizationId, phone } },
  });
  if (existing) {
    if (existing.reason !== opts.reason) {
      await prisma.excludedContact.update({
        where: { id: existing.id },
        data: { reason: opts.reason, name: opts.name || existing.name },
      });
    }
    return { created: false };
  }
  await prisma.excludedContact.create({
    data: {
      organizationId: opts.organizationId,
      phone,
      name: opts.name || null,
      reason: opts.reason,
    },
  });
  return { created: true };
}

/** Marca pendentes deste telefone como skipped em runs ainda abertos. */
export async function skipPendingCampaignsForPhone(organizationId: string, phone: string) {
  const tail = phone.replace(/\D/g, "").slice(-8);
  if (tail.length < 8) return;
  const pending = await prisma.campaignContact.findMany({
    where: {
      status: { in: ["pending", "sending"] },
      phone: { contains: tail },
      run: {
        status: { in: ["RUNNING", "PAUSED"] },
        campaign: { organizationId },
      },
    },
    select: { id: true, runId: true },
  });
  if (!pending.length) return;
  const byRun = new Map<string, string[]>();
  for (const row of pending) {
    const list = byRun.get(row.runId) || [];
    list.push(row.id);
    byRun.set(row.runId, list);
  }
  await prisma.campaignContact.updateMany({
    where: { id: { in: pending.map((p) => p.id) } },
    data: { status: "skipped", errorKind: "opt_out", errorMsg: "Opt-out" },
  });
  for (const [runId, ids] of byRun) {
    await prisma.campaignRun.update({
      where: { id: runId },
      data: { skipped: { increment: ids.length } },
    });
  }
}
