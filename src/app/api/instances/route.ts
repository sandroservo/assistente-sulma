/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { instanceHealth, resetCountersIfNeeded, type AntiBlockProfile } from "@/lib/anti-block";

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || `sulma-${Date.now()}`
  );
}

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

    const profile: AntiBlockProfile = "balanced";
    const payload = instances.map((inst) => {
      const fresh = resetCountersIfNeeded(inst);
      const health = instanceHealth(fresh, profile);
      return { ...fresh, health };
    });

    return NextResponse.json({ instances: payload });
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

    const { name, instanceName, dailyLimit, hourlyLimit } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "Nome amigável é obrigatório" }, { status: 400 });
    }

    const slug = slugify(String(instanceName || name));

    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { maxInstances: true },
    });

    const count = await prisma.instance.count({
      where: { organizationId: session.user.organizationId },
    });

    const maxInstances = Math.max(org?.maxInstances || 20, 20);
    if (count >= maxInstances) {
      return NextResponse.json(
        { error: `Limite de instâncias atingido (${maxInstances})` },
        { status: 400 }
      );
    }

    const existing = await prisma.instance.findFirst({
      where: {
        organizationId: session.user.organizationId,
        instanceName: slug,
      },
    });

    if (existing) {
      return NextResponse.json({ error: "Nome técnico já existe" }, { status: 400 });
    }

    const instance = await prisma.instance.create({
      data: {
        organizationId: session.user.organizationId,
        name: name.trim(),
        instanceName: slug,
        isDefault: count === 0,
        dailyLimit: Number(dailyLimit) > 0 ? Number(dailyLimit) : 80,
        hourlyLimit: Number(hourlyLimit) > 0 ? Number(hourlyLimit) : 12,
      },
    });

    return NextResponse.json({ instance });
  } catch (error) {
    console.error("Erro ao criar instância:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
