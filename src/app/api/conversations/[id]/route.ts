/**
 * PATCH: encerrar/reabrir, fixar/desafixar, atribuir setor/atendente.
 * Body: { status?, isPinned?, sectorId?: string|null, assignedUserId?: string|null }
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emitConversationUpdate } from "@/lib/realtime";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const data: { status?: string; isPinned?: boolean; sectorId?: string | null; assignedUserId?: string | null } = {};
    if (body.status === "open" || body.status === "closed") data.status = body.status;
    if (typeof body.isPinned === "boolean") data.isPinned = body.isPinned;
    // sectorId / assignedUserId: string atribui, null desatribui.
    if ("sectorId" in body) data.sectorId = body.sectorId || null;
    if ("assignedUserId" in body) data.assignedUserId = body.assignedUserId || null;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
    }

    const conv = await prisma.conversation.update({
      where: { id },
      data,
      select: { id: true, leadId: true, status: true, isPinned: true, sectorId: true, assignedUserId: true },
    });

    emitConversationUpdate({
      type: data.status ? "status" : "conversation_update",
      conversationId: conv.id,
      leadId: conv.leadId,
    });

    return NextResponse.json({ conversation: conv });
  } catch (error) {
    console.error("[conversations PATCH]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
