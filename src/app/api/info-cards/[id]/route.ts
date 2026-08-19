import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteInfoCardFile } from "@/lib/info-cards";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const card = await prisma.infoCard.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });
    if (!card) {
      return NextResponse.json({ ok: false, error: "Card não encontrado" }, { status: 404 });
    }

    await deleteInfoCardFile(card.filename);
    await prisma.infoCard.delete({ where: { id: card.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[info-cards] DELETE", error);
    return NextResponse.json({ ok: false, error: "Erro ao excluir card" }, { status: 500 });
  }
}
