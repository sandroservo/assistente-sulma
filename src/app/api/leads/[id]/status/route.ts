/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VALID_LEAD_STATUS = [
  "NOVO",
  "EM_ATENDIMENTO",
  "CONSCIENTIZADO",
  "QUALIFICADO",
  "LEAD_FRIO",
  "PROPOSTA_ENVIADA",
  "EM_NEGOCIACAO",
  "AGUARDANDO_RESPOSTA",
  "FECHADO",
  "PERDIDO",
  "HUMANO_SOLICITADO",
  "HUMANO_EM_ATENDIMENTO",
] as const;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { status } = await req.json();

    if (!status || !VALID_LEAD_STATUS.includes(status)) {
      return NextResponse.json(
        { ok: false, error: "invalid status" },
        { status: 400 }
      );
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({ ok: true, lead });
  } catch (error) {
    console.error("Update lead status error:", error);
    return NextResponse.json(
      { ok: false, error: "internal error" },
      { status: 500 }
    );
  }
}
