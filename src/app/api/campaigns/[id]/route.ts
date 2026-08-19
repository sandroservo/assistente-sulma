/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Campanha individual: GET detalhe (runs + contatos p/ drill-down de erro),
 * PATCH (editar/agendar/cancelar), DELETE.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function ownedCampaign(id: string, organizationId: string) {
  const campaign = await prisma.campaign.findFirst({ where: { id, organizationId } });
  return campaign;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const campaign = await prisma.campaign.findFirst({
    where: { id, organizationId: session.user.organizationId },
    include: {
      runs: {
        orderBy: { startedAt: "desc" },
        include: {
          contacts: {
            select: {
              phone: true,
              name: true,
              status: true,
              errorKind: true,
              errorMsg: true,
              sentAt: true,
            },
          },
        },
      },
    },
  });
  if (!campaign) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });

  const orgId = session.user.organizationId;
  const allPhones = [...new Set(campaign.runs.flatMap((r) => r.contacts.map((c) => c.phone)))];
  const tails = [...new Set(allPhones.map((p) => p.replace(/\D/g, "").slice(-8)).filter((t) => t.length >= 8))];
  const leadOr = tails.map((t) => ({ phone: { contains: t } }));
  const [leads, saved] = tails.length
    ? await Promise.all([
        prisma.lead.findMany({
          where: { organizationId: orgId, OR: leadOr },
          select: {
            name: true,
            pushName: true,
            phone: true,
            conversations: { take: 1, orderBy: { lastMessageAt: "desc" }, select: { id: true } },
          },
        }),
        prisma.savedContact.findMany({
          where: { organizationId: orgId, OR: leadOr },
          select: { name: true, phone: true },
        }),
      ])
    : [[], []];

  const byTail = (phone: string) => phone.replace(/\D/g, "").slice(-8);
  const leadByTail = new Map(leads.map((l) => [byTail(l.phone), l]));
  const contactByTail = new Map(saved.map((s) => [byTail(s.phone), s]));

  const enriched = {
    ...campaign,
    runs: campaign.runs.map((run) => ({
      ...run,
      contacts: run.contacts.map((c) => {
        const tail = byTail(c.phone);
        const lead = leadByTail.get(tail);
        const contact = contactByTail.get(tail);
        return {
          ...c,
          leadName: lead?.name || lead?.pushName || c.name || null,
          contactName: contact?.name || c.name || null,
          conversationId: lead?.conversations[0]?.id ?? null,
        };
      }),
    })),
  };

  return NextResponse.json({ ok: true, campaign: enriched });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await ownedCampaign(id, session.user.organizationId);
  if (!existing) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.message === "string" && body.message.trim()) data.message = body.message.trim();
  if (["conservative", "balanced", "aggressive"].includes(body.profile)) data.profile = body.profile;
  if (["NONE", "DAILY", "WEEKLY", "MONTHLY"].includes(body.recurrence)) data.recurrence = body.recurrence;
  if (Array.isArray(body.instanceIds)) data.instanceIds = body.instanceIds;
  if (body.targetFilter !== undefined) data.targetFilter = body.targetFilter;
  if (body.mediaBase64 !== undefined) {
    data.mediaBase64 = body.mediaBase64 || null;
    data.mediaMimeType = body.mediaMimeType || null;
  }
  if (body.action === "cancel") {
    data.status = "CANCELLED";
    data.scheduledAt = null;
  } else if (body.scheduledAt !== undefined) {
    data.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
    data.status = body.scheduledAt ? "SCHEDULED" : "DRAFT";
  }

  const campaign = await prisma.campaign.update({ where: { id }, data });
  return NextResponse.json({ ok: true, campaign });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await ownedCampaign(id, session.user.organizationId);
  if (!existing) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });

  await prisma.campaign.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
