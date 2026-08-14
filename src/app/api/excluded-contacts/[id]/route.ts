/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Remove um contato da lista de exceção.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }

    const { id } = await params;

    const contact = await prisma.excludedContact.findUnique({
      where: { id },
    });

    if (!contact || contact.organizationId !== session.user.organizationId) {
      return NextResponse.json(
        { ok: false, error: "Contato não encontrado" },
        { status: 404 }
      );
    }

    await prisma.excludedContact.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Erro ao remover exceção:", error);
    return NextResponse.json(
      { ok: false, error: "Erro ao remover exceção" },
      { status: 500 }
    );
  }
}
