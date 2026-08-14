/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 * 
 * API para excluir lead
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// DELETE - Exclui um lead
export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: leadId } = await params;

        await prisma.lead.delete({
            where: { id: leadId },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Erro ao excluir lead:", error);
        return NextResponse.json({ error: "Erro ao excluir lead" }, { status: 500 });
    }
}
