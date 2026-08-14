/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id } = await params;

    // Verifica se a instância pertence à organização
    const instance = await prisma.instance.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!instance) {
      return NextResponse.json({ error: "Instância não encontrada" }, { status: 404 });
    }

    await prisma.instance.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir instância:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
