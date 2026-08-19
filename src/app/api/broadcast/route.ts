/**
 * Inicia disparo em background a partir de uma campanha.
 * Destinatários: JSON { contacts } ou planilha (multipart).
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { executeCampaignRun, prepareCampaignRun, type CampaignTarget } from "@/lib/campaigns";
import { normalizeImportPhone, parseContactWorkbook } from "@/lib/contact-import";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function toTargets(list: Array<{ phone?: string; name?: string | null }>): CampaignTarget[] {
  return list
    .map((c) => ({
      phone: normalizeImportPhone(String(c.phone || "")) || "",
      name: c.name?.trim() || null,
    }))
    .filter((c) => c.phone.length >= 12);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const orgId = session.user.organizationId;
    const contentType = req.headers.get("content-type") || "";
    let campaignId = "";
    let contacts: CampaignTarget[] = [];

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      campaignId = String(form.get("campaignId") || "");
      const source = String(form.get("source") || "selected");
      const file = form.get("file");
      if (source === "sheet" && file instanceof File) {
        const rows = parseContactWorkbook(Buffer.from(await file.arrayBuffer()));
        contacts = toTargets(rows.map((r) => ({ phone: r.phone, name: r.name })));
      } else {
        const raw = String(form.get("contacts") || "[]");
        contacts = toTargets(JSON.parse(raw) as Array<{ phone: string; name?: string }>);
      }
    } else {
      const body = await req.json().catch(() => ({}));
      campaignId = String(body.campaignId || "");
      contacts = toTargets(body.contacts || []);
    }

    if (!campaignId) {
      return NextResponse.json({ error: "Escolha uma campanha para disparar." }, { status: 400 });
    }
    if (!contacts.length) {
      return NextResponse.json({ error: "Nenhum destinatário válido (nome/telefone)." }, { status: 400 });
    }

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId: orgId },
    });
    if (!campaign) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });

    const prepared = await prepareCampaignRun(campaignId, { contacts, skipSchedule: true });
    executeCampaignRun(prepared.runId);

    return NextResponse.json({
      ok: true,
      runId: prepared.runId,
      campaignId,
      campaignName: campaign.name,
      total: prepared.total,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro ao iniciar disparo";
    const status = msg.includes("já está em execução") ? 409 : 500;
    console.error("[Broadcast]", error);
    return NextResponse.json({ error: msg }, { status });
  }
}
