/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * API para lista de exceção: números para a Sulma NÃO responder (ex.: pessoas da empresa).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(-11) || phone;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }

    const list = await prisma.excludedContact.findMany({
      where: { organizationId: session.user.organizationId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, list });
  } catch (error) {
    console.error("Erro ao listar exceções:", error);
    return NextResponse.json(
      { ok: false, error: "Erro ao listar exceções" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const rawPhone = body?.phone?.trim();
    const name = body?.name?.trim() || null;

    if (!rawPhone) {
      return NextResponse.json(
        { ok: false, error: "Informe o número (telefone)" },
        { status: 400 }
      );
    }

    const phone = normalizePhone(rawPhone);
    if (!phone) {
      return NextResponse.json(
        { ok: false, error: "Número inválido" },
        { status: 400 }
      );
    }

    const existing = await prisma.excludedContact.findUnique({
      where: {
        organizationId_phone: {
          organizationId: session.user.organizationId,
          phone,
        },
      },
    });
    if (existing) {
      return NextResponse.json(
        { ok: false, error: "Este número já está na lista de exceção" },
        { status: 409 }
      );
    }

    const contact = await prisma.excludedContact.create({
      data: {
        organizationId: session.user.organizationId,
        phone,
        name,
      },
    });

    return NextResponse.json({ ok: true, contact });
  } catch (error) {
    console.error("Erro ao adicionar exceção:", error);
    return NextResponse.json(
      { ok: false, error: "Erro ao adicionar exceção" },
      { status: 500 }
    );
  }
}
