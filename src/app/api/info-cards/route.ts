/**
 * Lista e cadastra cards informativos.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listInfoCards, saveInfoCardFile } from "@/lib/info-cards";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 8 * 1024 * 1024;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    const cards = await listInfoCards(session.user.organizationId);
    return NextResponse.json({ ok: true, cards });
  } catch (error) {
    console.error("[info-cards] GET", error);
    return NextResponse.json({ ok: false, error: "Erro ao listar cards" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }

    const form = await req.formData();
    const title = String(form.get("title") || "").trim();
    const file = form.get("file");
    if (!title) {
      return NextResponse.json({ ok: false, error: "Informe o nome do card" }, { status: 400 });
    }
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ ok: false, error: "Envie uma imagem" }, { status: 400 });
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ ok: false, error: "Use JPG, PNG, WEBP ou GIF" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "Imagem maior que 8 MB" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = await saveInfoCardFile(buffer.toString("base64"), file.type);
    const card = await prisma.infoCard.create({
      data: {
        organizationId: session.user.organizationId,
        title,
        filename,
        mimeType: file.type,
      },
    });

    return NextResponse.json({
      ok: true,
      card: {
        id: card.id,
        title: card.title,
        filename: card.filename,
        mimeType: card.mimeType,
        imageUrl: `/api/info-cards/file/${encodeURIComponent(card.filename)}`,
        createdAt: card.createdAt,
      },
    });
  } catch (error) {
    console.error("[info-cards] POST", error);
    return NextResponse.json({ ok: false, error: "Erro ao cadastrar card" }, { status: 500 });
  }
}
