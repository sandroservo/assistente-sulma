/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * API para editar (renomear/cor) e remover uma etiqueta (tag/lista).
 * Remover apaga a etiqueta da organização; o Prisma limpa os vínculos com leads (M2N).
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// PATCH - Renomeia / troca cor da etiqueta
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const data: { name?: string; color?: string } = {};
        if (body?.name !== undefined) {
            const name = String(body.name).trim().slice(0, 60);
            if (!name) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
            data.name = name;
        }
        if (body?.color !== undefined) data.color = String(body.color);
        if (!data.name && !data.color) return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });

        const tag = await prisma.tag.update({ where: { id }, data });
        return NextResponse.json({ tag });
    } catch (error) {
        console.error("Erro ao editar etiqueta:", error);
        return NextResponse.json({ error: "Erro ao editar etiqueta" }, { status: 500 });
    }
}

// DELETE - Remove a etiqueta da organização
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        await prisma.tag.delete({ where: { id } });
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Erro ao remover etiqueta:", error);
        return NextResponse.json({ error: "Erro ao remover etiqueta" }, { status: 500 });
    }
}
