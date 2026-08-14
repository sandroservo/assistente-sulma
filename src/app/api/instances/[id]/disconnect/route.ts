/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getEvolutionCredentials, evolutionApiRoot } from "@/lib/evolution-credentials";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id } = await params;

    const instance = await prisma.instance.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });

    if (!instance) {
      return NextResponse.json({ error: "Instância não encontrada" }, { status: 404 });
    }

    const creds = await getEvolutionCredentials(session.user.organizationId, instance.token);
    if (creds.baseUrl && creds.token) {
      const root = evolutionApiRoot(creds.baseUrl);
      await fetch(`${root}/instance/logout/${instance.instanceName}`, {
        method: "DELETE",
        headers: { apikey: creds.token },
      }).catch(() => {});
    }

    await prisma.instance.update({
      where: { id },
      data: { status: "DISCONNECTED", qrcode: null, phone: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao desconectar instância:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
