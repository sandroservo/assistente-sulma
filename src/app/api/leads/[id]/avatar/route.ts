/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Re-busca o avatar do lead na Evolution API e atualiza no banco.
 * URLs de avatar do WhatsApp expiram após algumas horas.
 * GET /api/leads/:id/avatar
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evolutionGetProfilePicture } from "@/lib/evolution";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const lead = await prisma.lead.findUnique({
      where: { id },
      select: { phone: true, avatarUrl: true },
    });

    if (!lead) {
      return NextResponse.json({ ok: false, error: "Lead não encontrado" }, { status: 404 });
    }

    const freshUrl = await evolutionGetProfilePicture(lead.phone);

    if (freshUrl && freshUrl !== lead.avatarUrl) {
      await prisma.lead.update({
        where: { id },
        data: { avatarUrl: freshUrl },
      });
    }

    return NextResponse.json({
      ok: true,
      avatarUrl: freshUrl || null,
    });
  } catch (error) {
    console.error("[Avatar Refresh] Error:", error);
    return NextResponse.json({ ok: true, avatarUrl: null });
  }
}
