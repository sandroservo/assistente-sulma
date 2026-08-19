/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Fluxos: GET lista, POST cria (vazio).
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const flows = await prisma.flow.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, active: true, updatedAt: true },
  });
  return NextResponse.json({ ok: true, flows });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const name = (body?.name as string)?.trim() || "Novo fluxo";

  const flow = await prisma.flow.create({
    data: {
      organizationId: session.user.organizationId,
      name,
      graph: {
        nodes: [{ id: "start", type: "start", position: { x: 250, y: 40 }, data: {} }],
        edges: [],
      },
    },
    select: { id: true, name: true },
  });
  return NextResponse.json({ ok: true, flow });
}
