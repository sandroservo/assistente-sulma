/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Busca global de leads (nome/pushName/telefone) na org. Retorna conversa p/ navegar.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const q = new URL(req.url).searchParams.get("q")?.trim() || "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const digits = q.replace(/\D/g, "");
  const leads = await prisma.lead.findMany({
    where: {
      organizationId: session.user.organizationId,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { pushName: { contains: q, mode: "insensitive" } },
        ...(digits ? [{ phone: { contains: digits } }] : []),
      ],
    },
    orderBy: { lastMessageAt: "desc" },
    take: 20,
    select: {
      id: true,
      name: true,
      pushName: true,
      phone: true,
      conversations: {
        orderBy: { lastMessageAt: "desc" },
        take: 1,
        select: { id: true },
      },
    },
  });

  const results = leads.map((l) => ({
    leadId: l.id,
    name: l.name || l.pushName || l.phone,
    phone: l.phone,
    conversationId: l.conversations[0]?.id ?? null,
  }));

  return NextResponse.json({ results });
}
