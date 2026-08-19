/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Fluxo individual: GET, PATCH (nome/ativo/grafo), DELETE.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const flow = await prisma.flow.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });
  if (!flow) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true, flow });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await prisma.flow.findFirst({
    where: { id, organizationId: session.user.organizationId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.active === "boolean") data.active = body.active;
  if (body.graph && typeof body.graph === "object") data.graph = body.graph;

  const flow = await prisma.flow.update({ where: { id }, data });
  return NextResponse.json({ ok: true, flow });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await prisma.flow.findFirst({
    where: { id, organizationId: session.user.organizationId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  await prisma.flow.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
