/**
 * POST /api/contacts/import — importa Excel/CSV para Lead + SavedContact.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeImportPhone, parseContactWorkbook } from "@/lib/contact-import";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 2000;
const TAG_COLORS = ["#8BC34A", "#9C27B0", "#E91E63", "#FF7043", "#26A69A", "#42A5F5", "#FFB300", "#EC407A"];

type RowError = { row: number; name?: string; phone?: string; error: string };

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Envie um arquivo Excel (.xlsx) ou CSV." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Arquivo muito grande (máx. 5 MB)." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let rows;
    try {
      rows = parseContactWorkbook(buffer);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Planilha inválida.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    if (!rows.length) {
      return NextResponse.json({ error: "Nenhuma linha preenchida na planilha." }, { status: 400 });
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json({ error: `Limite de ${MAX_ROWS} contatos por importação.` }, { status: 400 });
    }

    const orgId = session.user.organizationId;
    let created = 0;
    let skipped = 0;
    const errors: RowError[] = [];
    const tagCache = new Map<string, string>();

    for (const item of rows) {
      if (!item.name.trim()) {
        errors.push({ row: item.row, phone: item.phone, error: "Nome obrigatório" });
        continue;
      }
      const phone = normalizeImportPhone(item.phone);
      if (!phone) {
        errors.push({ row: item.row, name: item.name, phone: item.phone, error: "Telefone inválido" });
        continue;
      }

      const tail = phone.slice(-8);
      const existing = await prisma.lead.findFirst({
        where: {
          organizationId: orgId,
          OR: [{ phone }, { phone: { endsWith: tail } }],
        },
        select: { id: true },
      });
      if (existing) {
        skipped++;
        continue;
      }

      try {
        const tagIds: string[] = [];
        for (const tagName of item.tags) {
          const key = tagName.toLowerCase();
          let id = tagCache.get(key);
          if (!id) {
            const tag = await prisma.tag.upsert({
              where: { organizationId_name: { organizationId: orgId, name: tagName.slice(0, 60) } },
              update: {},
              create: {
                organizationId: orgId,
                name: tagName.slice(0, 60),
                color: TAG_COLORS[tagCache.size % TAG_COLORS.length],
              },
            });
            id = tag.id;
            tagCache.set(key, id);
          }
          tagIds.push(id);
        }

        await prisma.$transaction(async (tx) => {
          await tx.lead.create({
            data: {
              organizationId: orgId,
              name: item.name.trim(),
              pushName: item.name.trim(),
              phone,
              email: item.email.trim() || null,
              city: item.city.trim() || null,
              category: item.category.trim() || "geral",
              notes: item.notes.trim() || null,
              status: "NOVO",
              ownerType: "bot",
              source: "excel",
              ...(tagIds.length ? { tags: { connect: tagIds.map((id) => ({ id })) } } : {}),
            },
          });

          const saved = await tx.savedContact.findFirst({
            where: { organizationId: orgId, phone: { contains: tail } },
          });
          if (saved) {
            await tx.savedContact.update({
              where: { id: saved.id },
              data: { name: item.name.trim(), email: item.email.trim() || saved.email },
            });
          } else {
            await tx.savedContact.create({
              data: {
                organizationId: orgId,
                name: item.name.trim(),
                phone,
                email: item.email.trim() || null,
                category: item.category.trim() || "geral",
              },
            });
          }
        });
        created++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro ao salvar";
        if (msg.includes("Unique") || msg.includes("unique")) {
          skipped++;
        } else {
          errors.push({ row: item.row, name: item.name, phone, error: "Não foi possível salvar esta linha" });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      created,
      skipped,
      errors,
      total: rows.length,
    });
  } catch (error) {
    console.error("[contacts/import]", error);
    return NextResponse.json({ error: "Erro interno ao importar" }, { status: 500 });
  }
}
