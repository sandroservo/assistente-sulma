/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const instances = await prisma.instance.findMany({
      where: { organizationId: session.user.organizationId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ instances });
  } catch (error) {
    console.error("Erro ao buscar instâncias:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { name, instanceName } = await req.json();

    if (!name || !instanceName) {
      return NextResponse.json(
        { error: "Nome e nome técnico são obrigatórios" },
        { status: 400 }
      );
    }

    // Verifica limite de instâncias
    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { maxInstances: true },
    });

    const count = await prisma.instance.count({
      where: { organizationId: session.user.organizationId },
    });

    if (count >= (org?.maxInstances || 1)) {
      return NextResponse.json(
        { error: "Limite de instâncias atingido" },
        { status: 400 }
      );
    }

    // Verifica se instanceName já existe na organização
    const existing = await prisma.instance.findFirst({
      where: {
        organizationId: session.user.organizationId,
        instanceName,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Nome técnico já existe" },
        { status: 400 }
      );
    }

    const instance = await prisma.instance.create({
      data: {
        organizationId: session.user.organizationId,
        name,
        instanceName,
        isDefault: count === 0, // Primeira instância é a padrão
      },
    });

    return NextResponse.json({ instance });
  } catch (error) {
    console.error("Erro ao criar instância:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
