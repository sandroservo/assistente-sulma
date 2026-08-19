/**
 * Preparação de disparo: cria o run e os jobs (um por destinatário).
 * O envio é o worker em src/lib/campaign-worker.ts.
 */

import { prisma } from "@/lib/prisma";
import { isSuppressed } from "@/lib/suppression";
import { startCampaignWorker } from "@/lib/campaign-worker";

export type CampaignTarget = { phone: string; name: string | null };

export type RunCampaignOpts = {
  contacts: CampaignTarget[];
  skipSchedule?: boolean;
};

export async function runCampaign(campaignId: string, opts: RunCampaignOpts) {
  const prepared = await prepareCampaignRun(campaignId, opts);
  startCampaignWorker();
  return prepared;
}

export async function prepareCampaignRun(campaignId: string, opts: RunCampaignOpts) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error("Campanha não encontrada");
  if (campaign.status === "RUNNING") throw new Error("Campanha já está em execução");
  if (campaign.status === "PAUSED") {
    throw new Error("Campanha pausada. Retome o disparo no painel para continuar.");
  }
  if (!opts.contacts?.length) {
    throw new Error("Informe os destinatários no disparo em massa");
  }

  const seen = new Set<string>();
  const targets: CampaignTarget[] = [];
  for (const t of opts.contacts) {
    const phone = (t.phone || "").replace(/\D/g, "");
    if (phone.length < 10) continue;
    const key = phone.slice(-8);
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push({ phone, name: t.name || null });
  }
  if (!targets.length) throw new Error("Nenhum destinatário válido para disparar");

  const suppressedFlags = await Promise.all(
    targets.map((t) => isSuppressed(campaign.organizationId, t.phone))
  );
  const skippedCount = suppressedFlags.filter(Boolean).length;
  const pendingCount = targets.length - skippedCount;

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: pendingCount > 0 ? "RUNNING" : "DRAFT" },
  });

  const run = await prisma.campaignRun.create({
    data: {
      campaignId,
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

  return { runId: run.id, campaignId, total: targets.length, previousStatus: campaign.status };
}

/** Inicia o worker (jobs já persistidos). */
export function executeCampaignRun(_runId?: string) {
  startCampaignWorker();
}
