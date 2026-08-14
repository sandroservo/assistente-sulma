/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * CRUD de contatos salvos (clínicas, médicos, etc.)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const search = url.searchParams.get("search") || "";

    const org = await prisma.organization.findFirst({ orderBy: { name: "asc" } });
    if (!org) {
      return NextResponse.json({ ok: true, contacts: [] });
    }

    const contacts = await prisma.$queryRaw<
      Array<{ id: string; name: string; phone: string; organization: string | null; category: string | null }>
    >`
      SELECT id, name, phone, organization, category
      FROM "SavedContact"
      WHERE "organizationId" = ${org.id}
        ${search ? Prisma.sql`AND (
          name ILIKE ${"%" + search + "%"}
          OR phone LIKE ${"%" + search + "%"}
          OR organization ILIKE ${"%" + search + "%"}
        )` : Prisma.empty}
      ORDER BY
        CASE WHEN name ~ '[a-zA-ZÀ-ÿ]' THEN 0 ELSE 1 END,
        name COLLATE "C" ASC
      LIMIT 200
    `;

    return NextResponse.json({ ok: true, contacts });
  } catch (error) {
    console.error("[Saved Contacts] GET error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro interno" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { name, phone, organization, category, email } = await req.json();

    if (!name || !phone) {
      return NextResponse.json(
        { ok: false, error: "Nome e telefone são obrigatórios" },
        { status: 400 }
      );
    }

    const org = await prisma.organization.findFirst({ orderBy: { name: "asc" } });
    if (!org) {
      return NextResponse.json(
        { ok: false, error: "Organização não encontrada" },
        { status: 404 }
      );
    }

    const contact = await prisma.savedContact.create({
      data: {
        organizationId: org.id,
        name,
        phone: phone.replace(/\D/g, ""),
        organization: organization || null,
        category: category || "clinica",
        email: email || null,
      },
    });

    return NextResponse.json({ ok: true, contact });
  } catch (error) {
    console.error("[Saved Contacts] POST error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro interno" },
      { status: 500 }
    );
  }
}
