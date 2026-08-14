/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Cria um contato (lead) manualmente e também um SavedContact.
 * POST /api/contacts/create
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { name, phone, email, category, notes } = await req.json();

    if (!name?.trim() || !phone?.trim()) {
      return NextResponse.json(
        { ok: false, error: "Nome e telefone são obrigatórios" },
        { status: 400 }
      );
    }

    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      return NextResponse.json(
        { ok: false, error: "Telefone inválido" },
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

    // Verifica se já existe um lead com este telefone
    const existingLead = await prisma.lead.findUnique({
      where: { organizationId_phone: { organizationId: org.id, phone: cleanPhone } },
    });

    if (existingLead) {
      return NextResponse.json(
        { ok: false, error: "Já existe um contato com este telefone" },
        { status: 409 }
      );
    }

    // Cria o lead e o SavedContact em uma transação
    const result = await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.create({
        data: {
          organizationId: org.id,
          name: name.trim(),
          pushName: name.trim(),
          phone: cleanPhone,
          email: email?.trim() || null,
          category: category?.trim() || "geral",
          notes: notes?.trim() || null,
          status: "NOVO",
          ownerType: "bot",
          source: "manual",
        },
      });

      const existingSaved = await tx.savedContact.findFirst({
        where: { organizationId: org.id, phone: cleanPhone },
      });

      if (existingSaved) {
        await tx.savedContact.update({
          where: { id: existingSaved.id },
          data: { name: name.trim() },
        });
      } else {
        await tx.savedContact.create({
          data: {
            organizationId: org.id,
            name: name.trim(),
            phone: cleanPhone,
            category: category?.trim() || "geral",
          },
        });
      }

      return lead;
    });

    return NextResponse.json({ ok: true, lead: result });
  } catch (error) {
    console.error("[Create Contact] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro interno ao criar contato" },
      { status: 500 }
    );
  }
}
