/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Setores/filas de atendimento. GET lista da org; POST cria (OWNER/ADMIN).
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const sectors = await prisma.sector.findMany({
    where: { organizationId: session.user.organizationId, active: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ sectors });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!["OWNER", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  const { name, color } = await req.json().catch(() => ({}));
  if (!name?.trim()) {
    return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  }
  const sector = await prisma.sector.create({
    data: {
      organizationId: session.user.organizationId,
      name: name.trim(),
      color: color || "#001A5E",
    },
  });
  return NextResponse.json({ sector });
}
