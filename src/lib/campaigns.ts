/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Motor de campanhas recorrentes. Reusa o anti-bloqueio e o envio da Evolution
 * (mesma lógica do broadcast), mas persiste cada execução como CampaignRun com
 * status por contato — permitindo drill-down do motivo de erro (doc #5) e
 * recorrência via cron (doc #1).
 */

import { prisma } from "@/lib/prisma";
import { evolutionSendText, evolutionSendMedia } from "@/lib/evolution";
import {
  pickRandomInstance,
  computeDelay,
  recordSendSuccess,
  recordSendFailure,
  classifySendError,
  type AntiBlockProfile,
} from "@/lib/anti-block";
import { saveMedia } from "@/lib/media-storage";
import {
  confirmMassOutbound,
  extractEvolutionMessageId,
  prepareMassOutbound,
  revertMassOutbound,
} from "@/lib/mass-inbox";
import type { Campaign, CampaignStatus } from "@prisma/client";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeProfile(p: string): AntiBlockProfile {
  return (["conservative", "balanced", "aggressive"] as const).includes(p as AntiBlockProfile)
    ? (p as AntiBlockProfile)
    : "balanced";
}

/** Avança scheduledAt conforme a recorrência. NONE => null (campanha encerra). */
export function nextSchedule(from: Date, recurrence: string): Date | null {
  const d = new Date(from);
  switch (recurrence) {
    case "DAILY":
      d.setDate(d.getDate() + 1);
      return d;
    case "WEEKLY":
      d.setDate(d.getDate() + 7);
      return d;
    case "MONTHLY":
      d.setMonth(d.getMonth() + 1);
      return d;
    default:
      return null;
  }
}

/** Resolve os leads-alvo da campanha a partir do targetFilter ({ category?, status? }). */
async function resolveTargets(campaign: Campaign): Promise<Array<{ phone: string; name: string | null }>> {
  const filter = (campaign.targetFilter ?? {}) as { category?: string; status?: string };
  const leads = await prisma.lead.findMany({
    where: {
      organizationId: campaign.organizationId,
      ownerType: { not: "human" }, // não dispara sobre atendimento humano em curso
      ...(filter.category ? { category: filter.category } : {}),
      ...(filter.status ? { status: filter.status as never } : {}),
    },
    select: { phone: true, name: true },
  });
  return leads;
}

export type CampaignTarget = { phone: string; name: string | null };

export type RunCampaignOpts = {
  /** Se informado, dispara só nesta lista (Contatos / planilha). Senão usa o filtro da campanha. */
  contacts?: CampaignTarget[];
  /** Disparo avulso: não mexe em agendamento/recorrência da campanha. */
  skipSchedule?: boolean;
};

/**
 * Executa uma campanha inteira (bloqueante, com delays anti-bloqueio).
 * Cria um CampaignRun, envia contato a contato e agenda a próxima ocorrência.
 */
export async function runCampaign(campaignId: string, opts: RunCampaignOpts = {}) {
  const prepared = await prepareCampaignRun(campaignId, opts);
  return executeCampaignRun(prepared.runId, {
    skipSchedule: opts.skipSchedule,
    previousStatus: prepared.previousStatus,
  });
}

/**
 * Cria o run (status RUNNING, contatos pending) e devolve o id para o painel
 * acompanhar em background.
 */
export async function prepareCampaignRun(campaignId: string, opts: RunCampaignOpts = {}) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error("Campanha não encontrada");
  if (campaign.status === "RUNNING") throw new Error("Campanha já está em execução");

  const rawTargets = opts.contacts?.length ? opts.contacts : await resolveTargets(campaign);
  const seen = new Set<string>();
  const targets: CampaignTarget[] = [];
  for (const t of rawTargets) {
    const phone = (t.phone || "").replace(/\D/g, "");
    if (phone.length < 10) continue;
    const key = phone.slice(-8);
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push({ phone, name: t.name || null });
  }
  if (!targets.length) throw new Error("Nenhum destinatário válido para disparar");

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "RUNNING" },
  });

  const run = await prisma.campaignRun.create({
    data: {
      campaignId,
      status: "RUNNING",
      total: targets.length,
      contacts: {
        create: targets.map((t) => ({ phone: t.phone, name: t.name })),
      },
    },
  });

  return { runId: run.id, campaignId, total: targets.length, previousStatus: campaign.status };
}

export async function executeCampaignRun(
  runId: string,
  opts: { skipSchedule?: boolean; previousStatus?: string } = {}
) {
  const run = await prisma.campaignRun.findUnique({
    where: { id: runId },
    include: { contacts: true, campaign: true },
  });
  if (!run) throw new Error("Execução não encontrada");
  const campaign = run.campaign;
  const previousStatus = opts.previousStatus || "DONE";
  const profile = safeProfile(campaign.profile);

  const where = {
    organizationId: campaign.organizationId,
    status: "CONNECTED" as const,
    ...(campaign.instanceIds.length ? { id: { in: campaign.instanceIds } } : {}),
  };

  const restoreCampaign = async () => {
    if (opts.skipSchedule) {
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          lastRunAt: new Date(),
          status: (["DRAFT", "SCHEDULED", "DONE", "CANCELLED"].includes(previousStatus)
            ? previousStatus
            : "DONE") as CampaignStatus,
        },
      });
      return;
    }
    const next = nextSchedule(new Date(), campaign.recurrence);
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        lastRunAt: new Date(),
        scheduledAt: next,
        status: next ? "SCHEDULED" : "DONE",
      },
    });
  };

  try {
    let sharedMediaUrl: string | null = null;
    if (campaign.mediaBase64) {
      try {
        sharedMediaUrl = await saveMedia(
          campaign.mediaBase64,
          campaign.mediaMimeType || "image/jpeg"
        );
      } catch (e) {
        console.error("[Campaign] falha ao salvar mídia no inbox:", e);
      }
    }

    const pool0 = await prisma.instance.findMany({ where });
    const concurrency = Math.max(1, Math.min(pool0.length || 1, 4));
    const buckets: (typeof run.contacts)[] = Array.from({ length: concurrency }, () => []);
    run.contacts.forEach((c, i) => buckets[i % concurrency].push(c));

    await Promise.all(
      buckets.map((bucket, bucketIndex) =>
        sendBucket({
          bucket,
          bucketIndex,
          campaign,
          runId: run.id,
          profile,
          where,
          sharedMediaUrl,
          skipExtraDelay: Boolean(opts.skipSchedule),
        })
      )
    );

    const fresh = await prisma.campaignRun.findUnique({ where: { id: run.id } });
    await prisma.campaignRun.update({
      where: { id: run.id },
      data: { status: "DONE", finishedAt: new Date() },
    });
    await restoreCampaign();

    return {
      runId: run.id,
      total: run.contacts.length,
      sent: fresh?.sent ?? 0,
      failed: fresh?.failed ?? 0,
    };
  } catch (err) {
    await prisma.campaignContact.updateMany({
      where: { runId: run.id, status: { in: ["pending", "sending"] } },
      data: { status: "failed", errorKind: "transient", errorMsg: "Execução interrompida" },
    });
    await prisma.campaignRun.update({
      where: { id: run.id },
      data: { status: "DONE", finishedAt: new Date() },
    });
    await restoreCampaign().catch(() => undefined);
    throw err;
  }
}

async function sendBucket({
  bucket,
  bucketIndex,
  campaign,
  runId,
  profile,
  where,
  sharedMediaUrl,
  skipExtraDelay,
}: {
  bucket: Array<{ id: string; phone: string; name: string | null }>;
  bucketIndex: number;
  campaign: Campaign;
  runId: string;
  profile: AntiBlockProfile;
  where: { organizationId: string; status: "CONNECTED"; id?: { in: string[] } };
  sharedMediaUrl: string | null;
  skipExtraDelay: boolean;
}) {
  for (let i = 0; i < bucket.length; i++) {
    const c = bucket[i];
    let pool = await prisma.instance.findMany({ where });
    let picked = pickRandomInstance(pool, profile);

    if (!picked) {
      await sleep(8_000);
      pool = await prisma.instance.findMany({ where });
      picked = pickRandomInstance(pool, profile);
    }

    if (!picked) {
      await prisma.campaignContact.update({
        where: { id: c.id },
        data: { status: "failed", errorKind: "transient", errorMsg: "Sem instância disponível (anti-bloqueio)" },
      });
      await prisma.campaignRun.update({ where: { id: runId }, data: { failed: { increment: 1 } } });
      continue;
    }

    let inboxId: string | null = null;
    try {
      await prisma.campaignContact.update({
        where: { id: c.id },
        data: { status: "sending" },
      });
      const inbox = await prepareMassOutbound({
        organizationId: campaign.organizationId,
        phone: c.phone,
        name: c.name,
        body: campaign.message,
        mediaUrl: sharedMediaUrl,
        type: sharedMediaUrl ? "image" : "text",
        source: "campaign",
        sourceLabel: campaign.name,
      });
      inboxId = inbox.messageId;

      let result: unknown;
      if (campaign.mediaBase64) {
        result = await evolutionSendMedia({
          number: c.phone,
          mediatype: "image",
          media: campaign.mediaBase64,
          mimetype: campaign.mediaMimeType || "image/jpeg",
          caption: campaign.message,
          instanceName: picked.instanceName,
          instanceToken: picked.token || undefined,
        });
      } else {
        result = await evolutionSendText({
          number: c.phone,
          text: campaign.message,
          instanceName: picked.instanceName,
          instanceToken: picked.token || undefined,
        });
      }

      const providerId = extractEvolutionMessageId(result);
      await confirmMassOutbound(inboxId, providerId);
      await recordSendSuccess(picked.id);
      await prisma.campaignContact.update({
        where: { id: c.id },
        data: { status: "sent", providerId, sentAt: new Date() },
      });
      await prisma.campaignRun.update({ where: { id: runId }, data: { sent: { increment: 1 } } });
    } catch (error) {
      if (inboxId) await revertMassOutbound(inboxId);
      const errMsg = error instanceof Error ? error.message : "Erro desconhecido";
      await recordSendFailure(picked.id, errMsg);
      await prisma.campaignContact.update({
        where: { id: c.id },
        data: { status: "failed", errorKind: classifySendError(errMsg), errorMsg: errMsg.slice(0, 500) },
      });
      await prisma.campaignRun.update({ where: { id: runId }, data: { failed: { increment: 1 } } });
    }

    if (i < bucket.length - 1) {
      await sleep(computeDelay(bucketIndex * bucket.length + i, profile, { skipExtra: skipExtraDelay }));
    }
  }
}
