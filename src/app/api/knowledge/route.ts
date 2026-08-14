/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 * 
 * API para gerenciar base de conhecimento da Sulma
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getAllKnowledge,
  searchKnowledge,
  createKnowledge,
  KNOWLEDGE_CATEGORIES,
} from "@/lib/knowledge";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const category = searchParams.get("category");
    const organizationId = session.user.organizationId;

    let knowledge;
    if (query) {
      knowledge = await searchKnowledge(query, category || undefined, 20, organizationId);
    } else {
      knowledge = await getAllKnowledge(category || undefined, 50, organizationId);
    }

    return NextResponse.json({
      ok: true,
      knowledge,
      categories: KNOWLEDGE_CATEGORIES,
    });
  } catch (error) {
    console.error("Erro ao buscar conhecimentos:", error);
    return NextResponse.json(
      { ok: false, error: "Erro ao buscar conhecimentos" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { ok: false, error: "Não autorizado" },
        { status: 401 }
      );
    }

    const body = await request.json();

    if (!body.category || !body.title || !body.content) {
      return NextResponse.json(
        { ok: false, error: "Categoria, título e conteúdo são obrigatórios" },
        { status: 400 }
      );
    }

    const knowledge = await createKnowledge({
      organizationId: session.user.organizationId,
      category: body.category,
      title: body.title,
      content: body.content,
      keywords: body.keywords,
      priority: body.priority,
    });

    return NextResponse.json({ ok: true, knowledge });
  } catch (error) {
    console.error("Erro ao criar conhecimento:", error);
    return NextResponse.json(
      { ok: false, error: "Erro ao criar conhecimento" },
      { status: 500 }
    );
  }
}
