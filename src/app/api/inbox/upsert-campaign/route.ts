/**
 * Upsert de lead de campanha SEM criar mensagem (usado no backfill dos já cadastrados).
 * Cria/acha o lead pelos últimos 8 dígitos, define nome (prioridade) e conecta a tag.
 * Auth: Bearer == AMOVIDAS_AGENT_TOKEN.
 * POST /api/leads/upsert-campaign { phone, name?, tag?, source? }
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || token !== process.env.AMOVIDAS_AGENT_TOKEN) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { phone, name, tag, source } = await req.json().catch(() => ({}));
    const digits = String(phone || "").replace(/\D/g, "");
    if (digits.length < 8) return NextResponse.json({ error: "phone inválido" }, { status: 400 });
    const tail = digits.slice(-8);

    const org = await prisma.organization.findFirst({ orderBy: { name: "asc" } });
    if (!org) return NextResponse.json({ error: "Sem organização" }, { status: 500 });

    let tagId: string | null = null;
    const tagName = typeof tag === "string" ? tag.trim().slice(0, 60) : "";
    if (tagName) {
      try {
        const t = await prisma.tag.upsert({
          where: { organizationId_name: { organizationId: org.id, name: tagName } },
          update: {},
          create: { organizationId: org.id, name: tagName },
        });
        tagId = t.id;
      } catch {
        const t = await prisma.tag.findUnique({ where: { organizationId_name: { organizationId: org.id, name: tagName } } });
        tagId = t?.id ?? null;
      }
    }

    const existing = await prisma.lead.findFirst({ where: { organizationId: org.id, phone: { contains: tail } } });
    let created = false;
    if (!existing) {
      await prisma.lead.create({
        data: {
          organizationId: org.id, phone: digits, name: name || null,
          status: "NOVO", ownerType: "bot", lastMessageAt: new Date(),
          ...(source ? { source: String(source).slice(0, 40) } : {}),
          ...(tagId ? { tags: { connect: { id: tagId } } } : {}),
        },
      });
      created = true;
    } else {
      await prisma.lead.update({
        where: { id: existing.id },
        data: {
          ...(name ? { name } : {}),
          ...(tagId ? { tags: { connect: { id: tagId } } } : {}),
        },
      });
    }
    return NextResponse.json({ ok: true, created });
  } catch (error) {
    console.error("[leads/upsert-campaign]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
