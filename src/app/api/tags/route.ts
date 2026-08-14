/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 * 
 * API para gerenciar Tags
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Paleta estilo WhatsApp para novas listas.
const LIST_COLORS = ["#8BC34A", "#9C27B0", "#E91E63", "#FF7043", "#26A69A", "#42A5F5", "#FFB300", "#EC407A"];

// GET - Lista todas as tags da organização
export async function GET() {
    try {
        // TODO: Pegar organizationId do session/auth
        const rows = await prisma.tag.findMany({
            orderBy: { name: "asc" },
            include: { _count: { select: { leads: true } } },
        });
        const tags = rows.map(({ _count, ...t }) => ({ ...t, leadCount: _count.leads }));

        return NextResponse.json({ tags });
    } catch (error) {
        console.error("Erro ao buscar tags:", error);
        return NextResponse.json({ tags: [] }, { status: 500 });
    }
}

// POST - Cria uma nova tag
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const name = String(body?.name || "").trim().slice(0, 60);
        let organizationId = body?.organizationId as string | undefined;
        if (!organizationId) {
            const session = await auth();
            organizationId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
        }
        if (!organizationId) {
            const org = await prisma.organization.findFirst({ orderBy: { name: "asc" }, select: { id: true } });
            organizationId = org?.id;
        }
        if (!name || !organizationId) {
            return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
        }

        const color = body?.color || LIST_COLORS[Math.floor(Math.random() * LIST_COLORS.length)];
        const tag = await prisma.tag.upsert({
            where: { organizationId_name: { organizationId, name } },
            update: {},
            create: { name, color, organizationId },
        });

        return NextResponse.json({ tag }, { status: 201 });
    } catch (error) {
        console.error("Erro ao criar tag:", error);
        return NextResponse.json({ error: "Erro ao criar tag" }, { status: 500 });
    }
}
