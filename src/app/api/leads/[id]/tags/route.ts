/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 * 
 * API para gerenciar tags de um lead específico
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST - Adiciona tag ao lead
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: leadId } = await params;
        const body = await req.json();
        const { tagId } = body;

        if (!tagId) {
            return NextResponse.json(
                { error: "tagId é obrigatório" },
                { status: 400 }
            );
        }

        const lead = await prisma.lead.update({
            where: { id: leadId },
            data: {
                tags: {
                    connect: { id: tagId },
                },
            },
            include: {
                tags: { select: { id: true, name: true, color: true } },
            },
        });

        return NextResponse.json({ lead });
    } catch (error) {
        console.error("Erro ao adicionar tag:", error);
        return NextResponse.json({ error: "Erro ao adicionar tag" }, { status: 500 });
    }
}

// DELETE - Remove tag do lead
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: leadId } = await params;
        const { searchParams } = new URL(req.url);
        const tagId = searchParams.get("tagId");

        if (!tagId) {
            return NextResponse.json(
                { error: "tagId é obrigatório" },
                { status: 400 }
            );
        }

        const lead = await prisma.lead.update({
            where: { id: leadId },
            data: {
                tags: {
                    disconnect: { id: tagId },
                },
            },
            include: {
                tags: { select: { id: true, name: true, color: true } },
            },
        });

        return NextResponse.json({ lead });
    } catch (error) {
        console.error("Erro ao remover tag:", error);
        return NextResponse.json({ error: "Erro ao remover tag" }, { status: 500 });
    }
}
