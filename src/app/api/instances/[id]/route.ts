/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getEvolutionCredentials, evolutionApiRoot } from "@/lib/evolution-credentials";

export async function PATCH(
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

    const body = await req.json();
    const data: { name?: string; dailyLimit?: number; hourlyLimit?: number; pausedUntil?: Date | null } = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (Number(body.dailyLimit) > 0) data.dailyLimit = Number(body.dailyLimit);
    if (Number(body.hourlyLimit) > 0) data.hourlyLimit = Number(body.hourlyLimit);
    if (body.resume === true) data.pausedUntil = null;

    const updated = await prisma.instance.update({ where: { id }, data });
    return NextResponse.json({ instance: updated });
  } catch (error) {
    console.error("Erro ao atualizar instância:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

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
      await fetch(`${root}/instance/delete/${instance.instanceName}`, {
        method: "DELETE",
        headers: { apikey: creds.token },
      }).catch(() => {});
    }

    await prisma.instance.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir instância:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
