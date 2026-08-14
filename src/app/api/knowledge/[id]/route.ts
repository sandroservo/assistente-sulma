/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 * 
 * API para gerenciar conhecimento individual
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getKnowledgeById,
  updateKnowledge,
  deleteKnowledge,
} from "@/lib/knowledge";

function checkOrg(knowledge: { organizationId: string } | null, organizationId: string) {
  if (!knowledge || knowledge.organizationId !== organizationId) {
    return NextResponse.json(
      { ok: false, error: "Conhecimento não encontrado" },
      { status: 404 }
    );
  }
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const knowledge = await getKnowledgeById(id);
    const orgError = checkOrg(knowledge, session.user.organizationId);
    if (orgError) return orgError;

    return NextResponse.json({ ok: true, knowledge });
  } catch (error) {
    console.error("Erro ao buscar conhecimento:", error);
    return NextResponse.json(
      { ok: false, error: "Erro ao buscar conhecimento" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const existing = await getKnowledgeById(id);
    const orgError = checkOrg(existing, session.user.organizationId);
    if (orgError) return orgError;

    const body = await request.json();
    const knowledge = await updateKnowledge(id, {
      category: body.category,
      title: body.title,
      content: body.content,
      keywords: body.keywords,
      priority: body.priority,
      active: body.active,
    });

    return NextResponse.json({ ok: true, knowledge });
  } catch (error) {
    console.error("Erro ao atualizar conhecimento:", error);
    return NextResponse.json(
      { ok: false, error: "Erro ao atualizar conhecimento" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const existing = await getKnowledgeById(id);
    const orgError = checkOrg(existing, session.user.organizationId);
    if (orgError) return orgError;

    await deleteKnowledge(id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Erro ao deletar conhecimento:", error);
    return NextResponse.json(
      { ok: false, error: "Erro ao deletar conhecimento" },
      { status: 500 }
    );
  }
}
