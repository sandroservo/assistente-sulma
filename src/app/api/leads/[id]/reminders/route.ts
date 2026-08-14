/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 * 
 * API para criar lembretes (usando FollowUps)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: leadId } = await params;
        const body = await req.json();
        const { scheduledAt, note } = body;

        if (!scheduledAt) {
            return NextResponse.json(
                { error: "scheduledAt é obrigatório" },
                { status: 400 }
            );
        }

        // Buscar a conversa mais recente do lead
        const conversation = await prisma.conversation.findFirst({
            where: { leadId },
            orderBy: { lastMessageAt: "desc" },
        });

        if (!conversation) {
            return NextResponse.json(
                { error: "Lead não possui conversa" },
                { status: 404 }
            );
        }

        const reminder = await prisma.followUp.create({
            data: {
                leadId,
                conversationId: conversation.id,
                stage: 0,
                scheduledAt: new Date(scheduledAt),
                status: "reminder",
                lastError: note || null,
            },
        });

        return NextResponse.json({ reminder }, { status: 201 });
    } catch (error) {
        console.error("Erro ao criar lembrete:", error);
        return NextResponse.json(
            { error: "Erro ao criar lembrete" },
            { status: 500 }
        );
    }
}

// GET - Lista lembretes do lead
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: leadId } = await params;

        const reminders = await prisma.followUp.findMany({
            where: { leadId, status: "reminder" },
            orderBy: { scheduledAt: "asc" },
        });

        return NextResponse.json({ reminders });
    } catch (error) {
        console.error("Erro ao buscar lembretes:", error);
        return NextResponse.json({ reminders: [] }, { status: 500 });
    }
}

// DELETE - Exclui um lembrete
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: leadId } = await params;
        const { reminderId } = await req.json();

        if (!reminderId) {
            return NextResponse.json(
                { error: "reminderId é obrigatório" },
                { status: 400 }
            );
        }

        await prisma.followUp.delete({
            where: { id: reminderId, leadId, status: "reminder" },
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Erro ao excluir lembrete:", error);
        return NextResponse.json(
            { error: "Erro ao excluir lembrete" },
            { status: 500 }
        );
    }
}

// PATCH - Edita um lembrete (data e/ou nota)
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: leadId } = await params;
        const { reminderId, scheduledAt, note } = await req.json();

        if (!reminderId) {
            return NextResponse.json(
                { error: "reminderId é obrigatório" },
                { status: 400 }
            );
        }

        const updateData: Record<string, unknown> = {};
        if (scheduledAt) updateData.scheduledAt = new Date(scheduledAt);
        if (note !== undefined) updateData.lastError = note || null;

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json(
                { error: "Nenhum campo para atualizar" },
                { status: 400 }
            );
        }

        const reminder = await prisma.followUp.update({
            where: { id: reminderId, leadId, status: "reminder" },
            data: updateData,
        });

        return NextResponse.json({ ok: true, reminder });
    } catch (error) {
        console.error("Erro ao editar lembrete:", error);
        return NextResponse.json(
            { error: "Erro ao editar lembrete" },
            { status: 500 }
        );
    }
}
