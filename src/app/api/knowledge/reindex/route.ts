/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Reindexa (gera embeddings de) toda a base de conhecimento da organização.
 * Rodar uma vez após habilitar o pgvector, e sempre que trocar de modelo.
 * POST /api/knowledge/reindex
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { indexKnowledge } from "@/lib/embeddings";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const items = await prisma.knowledge.findMany({
    where: { organizationId: session.user.organizationId, active: true },
    select: { id: true },
  });

  let indexed = 0;
  for (const { id } of items) {
    await indexKnowledge(id);
    indexed++;
  }

  return NextResponse.json({ ok: true, total: items.length, indexed });
}
