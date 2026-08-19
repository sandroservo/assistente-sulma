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
import { evolutionSendText, evolutionSendMedia, evolutionSendPresence } from "@/lib/evolution";
import {
  pickRandomInstance,
  computeDelay,
  recordSendSuccess,
  recordSendFailure,
  classifySendError,
  type AntiBlockProfile,
} from "@/lib/anti-block";
import type { Campaign } from "@prisma/client";

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

/**
 * Executa uma campanha inteira (bloqueante, com delays anti-bloqueio).
 * Cria um CampaignRun, envia contato a contato e agenda a próxima ocorrência.
 * Retorna o resumo do run.
 */
export async function runCampaign(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error("Campanha não encontrada");
  if (campaign.status === "RUNNING") throw new Error("Campanha já está em execução");

  const profile = safeProfile(campaign.profile);
  const targets = await resolveTargets(campaign);

  const where = {
    organizationId: campaign.organizationId,
    status: "CONNECTED" as const,
    ...(campaign.instanceIds.length ? { id: { in: campaign.instanceIds } } : {}),
  };

  await prisma.campaign.update({ where: { id: campaignId }, data: { status: "RUNNING" } });

  const run = await prisma.campaignRun.create({
    data: {
      campaignId,
      status: "RUNNING",
      total: targets.length,
      contacts: {
        create: targets.map((t) => ({ phone: t.phone, name: t.name })),
      },
    },
    include: { contacts: true },
  });

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < run.contacts.length; i++) {
    const c = run.contacts[i];
    let pool = await prisma.instance.findMany({ where });
    let picked = pickRandomInstance(pool, profile);

    if (!picked) {
      // Todas no limite/pausa — espera uma vez e tenta de novo
      await sleep(60_000);
      pool = await prisma.instance.findMany({ where });
      picked = pickRandomInstance(pool, profile);
    }

    if (!picked) {
      failed++;
      await prisma.campaignContact.update({
        where: { id: c.id },
        data: { status: "failed", errorKind: "transient", errorMsg: "Sem instância disponível (anti-bloqueio)" },
      });
      continue;
    }

    try {
      await evolutionSendPresence(c.phone, "composing", {
        instanceName: picked.instanceName,
        token: picked.token || undefined,
      }).catch(() => {});
      await sleep(800 + Math.random() * 1800);

      let result: { key?: { id?: string } };
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

      await recordSendSuccess(picked.id);
      sent++;
      await prisma.campaignContact.update({
        where: { id: c.id },
        data: { status: "sent", providerId: result?.key?.id ?? null, sentAt: new Date() },
      });
    } catch (error) {
      failed++;
      const errMsg = error instanceof Error ? error.message : "Erro desconhecido";
      await recordSendFailure(picked.id, errMsg);
      await prisma.campaignContact.update({
        where: { id: c.id },
        data: { status: "failed", errorKind: classifySendError(errMsg), errorMsg: errMsg.slice(0, 500) },
      });
    }

    await prisma.campaignRun.update({ where: { id: run.id }, data: { sent, failed } });

    if (i < run.contacts.length - 1) {
      await sleep(computeDelay(i, profile));
    }
  }

  await prisma.campaignRun.update({
    where: { id: run.id },
    data: { status: "DONE", finishedAt: new Date() },
  });

  // Recorrência: reagenda ou encerra
  const next = nextSchedule(new Date(), campaign.recurrence);
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      lastRunAt: new Date(),
      scheduledAt: next,
      status: next ? "SCHEDULED" : "DONE",
    },
  });

  return { runId: run.id, total: run.contacts.length, sent, failed, next };
}
