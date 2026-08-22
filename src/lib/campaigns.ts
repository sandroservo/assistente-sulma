/**
 * Preparação de disparo: cria o run e os jobs (um por destinatário).
 * Cada atendente tem a própria fila; o envio é o worker em campaign-worker.ts.
 */

import { prisma } from "@/lib/prisma";
import { syncCampaignStatus } from "@/lib/campaign-worker";
import { dispatchCampaignRun } from "@/lib/messaging/dispatch";
import { isSuppressed } from "@/lib/suppression";

export type CampaignTarget = { phone: string; name: string | null };

export type RunCampaignOpts = {
  contacts: CampaignTarget[];
  skipSchedule?: boolean;
  userId?: string | null;
};

function uniqueTargets(contacts: CampaignTarget[]): CampaignTarget[] {
  const seen = new Set<string>();
  const targets: CampaignTarget[] = [];
  for (const t of contacts) {
    const phone = (t.phone || "").replace(/\D/g, "");
    if (phone.length < 10) continue;
    const key = phone.slice(-8);
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push({ phone, name: t.name || null });
  }
  return targets;
}

export async function runCampaign(campaignId: string, opts: RunCampaignOpts) {
  const prepared = await prepareCampaignRun(campaignId, opts);
  await dispatchCampaignRun(prepared.runId);
  return prepared;
}

export async function prepareCampaignRun(campaignId: string, opts: RunCampaignOpts) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error("Campanha não encontrada");
  if (!opts.contacts?.length) {
    throw new Error("Informe os destinatários no disparo em massa");
  }

  const targets = uniqueTargets(opts.contacts);
  if (!targets.length) throw new Error("Nenhum destinatário válido para disparar");

  const userId = opts.userId || null;

  if (userId) {
    const existing = await prisma.campaignRun.findFirst({
      where: {
        campaignId,
        createdByUserId: userId,
        status: { in: ["RUNNING", "PAUSED"] },
      },
      include: { contacts: { select: { phone: true } } },
      orderBy: { startedAt: "desc" },
    });
    if (existing) {
      const already = new Set(existing.contacts.map((c) => c.phone.replace(/\D/g, "").slice(-8)));
      const fresh = targets.filter((t) => !already.has(t.phone.slice(-8)));
      if (!fresh.length) {
        return {
          runId: existing.id,
          campaignId,
          total: existing.total,
          added: 0,
          appended: true,
          previousStatus: campaign.status,
        };
      }

      const suppressedFlags = await Promise.all(
        fresh.map((t) => isSuppressed(campaign.organizationId, t.phone))
      );
      const skippedAdd = suppressedFlags.filter(Boolean).length;
      const pendingAdd = fresh.length - skippedAdd;

      await prisma.campaignContact.createMany({
        data: fresh.map((t, i) =>
          suppressedFlags[i]
            ? {
                runId: existing.id,
                phone: t.phone,
                name: t.name,
                status: "skipped",
                errorKind: "opt_out",
                errorMsg: "Lista de não contato",
              }
            : { runId: existing.id, phone: t.phone, name: t.name },
        ),
      });
      await prisma.campaignRun.update({
        where: { id: existing.id },
        data: {
          total: { increment: fresh.length },
          skipped: { increment: skippedAdd },
          ...(existing.status === "PAUSED" && pendingAdd > 0
            ? { status: "RUNNING", pauseReason: null }
            : {}),
        },
      });
      await syncCampaignStatus(campaignId);
      return {
        runId: existing.id,
        campaignId,
        total: existing.total + fresh.length,
        added: fresh.length,
        appended: true,
        previousStatus: campaign.status,
      };
    }
  }

  const suppressedFlags = await Promise.all(
    targets.map((t) => isSuppressed(campaign.organizationId, t.phone))
  );
  const skippedCount = suppressedFlags.filter(Boolean).length;
  const pendingCount = targets.length - skippedCount;

  const run = await prisma.campaignRun.create({
    data: {
      campaignId,
      createdByUserId: userId,
      status: pendingCount > 0 ? "RUNNING" : "DONE",
      total: targets.length,
      skipped: skippedCount,
      finishedAt: pendingCount > 0 ? null : new Date(),
      contacts: {
        create: targets.map((t, i) =>
          suppressedFlags[i]
            ? {
                phone: t.phone,
                name: t.name,
                status: "skipped",
                errorKind: "opt_out",
                errorMsg: "Lista de não contato",
              }
            : { phone: t.phone, name: t.name },
        ),
      },
    },
  });

  await syncCampaignStatus(campaignId);
  return {
    runId: run.id,
    campaignId,
    total: targets.length,
    added: targets.length,
    appended: false,
    previousStatus: campaign.status,
  };
}

/** Dispara o run (jobs já persistidos) pelo driver ativo (legacy|rabbitmq). */
export async function executeCampaignRun(runId: string) {
  await dispatchCampaignRun(runId);
}
