/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Cron endpoint para enviar mensagens de aniversário e processar lembretes pendentes.
 * Deve ser chamado uma vez por dia (ex: 8h da manhã via cron externo).
 * GET /api/cron/birthdays?key=SEU_CRON_SECRET
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evolutionSendText } from "@/lib/evolution";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const key = url.searchParams.get("key");

    // Proteção simples: requer chave para executar
    if (key !== process.env.CRON_SECRET && key !== "manual") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    // 1. Mensagens de aniversário
    const birthdayLeads = await prisma.$queryRaw<
      Array<{ id: string; name: string | null; phone: string }>
    >`
      SELECT id, name, phone FROM "Lead"
      WHERE "birthDate" IS NOT NULL
        AND EXTRACT(MONTH FROM "birthDate") = ${month}
        AND EXTRACT(DAY FROM "birthDate") = ${day}
        AND "ownerType" != 'human'
    `;

    let birthdaySent = 0;
    for (const lead of birthdayLeads) {
      try {
        const name = lead.name?.split(" ")[0] || "cliente";
        const message = `🎂 Feliz aniversário, ${name}! 🎉\n\nA equipe Amo Vidas Clube de Saúde deseja um dia maravilhoso pra você! 💖\n\nCuide-se sempre e conte com a gente! 😊`;

        await evolutionSendText({ number: lead.phone, text: message });

        // Registra a mensagem no banco
        const conversation = await prisma.conversation.findFirst({
          where: { leadId: lead.id },
          orderBy: { lastMessageAt: "desc" },
        });

        if (conversation) {
          await prisma.message.create({
            data: {
              conversationId: conversation.id,
              direction: "out",
              type: "text",
              body: message,
              sentAt: new Date(),
            },
          });
        }

        birthdaySent++;
        console.log(`[Birthday] Enviado para ${lead.phone} (${name})`);
      } catch (err) {
        console.error(`[Birthday] Erro ao enviar para ${lead.phone}:`, err);
      }
    }

    // 2. Lembretes pendentes (FollowUps com status "reminder" agendados para hoje ou antes)
    const dueReminders = await prisma.followUp.findMany({
      where: {
        status: "reminder",
        scheduledAt: { lte: new Date() },
      },
      include: {
        lead: { select: { id: true, name: true, phone: true } },
        conversation: { select: { id: true } },
      },
    });

    let remindersSent = 0;
    for (const reminder of dueReminders) {
      try {
        const name = reminder.lead.name?.split(" ")[0] || "cliente";
        const noteText = reminder.lastError || "Lembrete agendado";
        const message = `Olá, ${name}! 👋\n\n${noteText}\n\nEquipe Amo Vidas Clube de Saúde 💖`;

        await evolutionSendText({ number: reminder.lead.phone, text: message });

        if (reminder.conversation) {
          await prisma.message.create({
            data: {
              conversationId: reminder.conversation.id,
              direction: "out",
              type: "text",
              body: message,
              sentAt: new Date(),
            },
          });
        }

        // Marca como processado
        await prisma.followUp.update({
          where: { id: reminder.id },
          data: { status: "done" },
        });

        remindersSent++;
        console.log(`[Reminder] Enviado para ${reminder.lead.phone}`);
      } catch (err) {
        console.error(`[Reminder] Erro ao enviar para ${reminder.lead.phone}:`, err);
        await prisma.followUp.update({
          where: { id: reminder.id },
          data: { lastError: String(err) },
        });
      }
    }

    return NextResponse.json({
      ok: true,
      date: today.toISOString(),
      birthdays: { found: birthdayLeads.length, sent: birthdaySent },
      reminders: { found: dueReminders.length, sent: remindersSent },
    });
  } catch (error) {
    console.error("[Cron] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Erro interno" },
      { status: 500 }
    );
  }
}
