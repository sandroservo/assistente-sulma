/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 * 
 * Webhook para receber mensagens do WhatsApp via Evolution API (single-tenant).
 */

import { NextResponse } from "next/server";
import { prisma, LeadStatus } from "@/lib/prisma";
import { evolutionSendText, evolutionSendTextHumanized, evolutionSendMedia, evolutionGetProfilePicture, evolutionGetMediaBase64 } from "@/lib/evolution";
import { readFile } from "fs/promises";
import path from "path";
import { transcribeAudio, describeImage } from "@/lib/media";
import { saveMedia } from "@/lib/media-storage";
import { generateAIResponse, shouldTransferToHuman, detectLeadStatus, generateConversationSummary } from "@/lib/ai";
import { updateLeadScore, getStatusFromScore } from "@/lib/lead-score";
import {
  collectWebhookMessages,
  parseIncomingMessage,
  isAckOnlyEvent,
} from "@/lib/evolution-webhook";

export async function GET() {
  return NextResponse.json({ ok: true, service: "evolution-webhook" });
}

export async function POST(req: Request) {
  try {
    const payload = await req.json().catch(() => null);
    if (!payload) {
      return NextResponse.json(
        { ok: false, error: "invalid json" },
        { status: 400 }
      );
    }

    const knownInstance = payload?.instance
      ? await prisma.instance.findFirst({
          where: { instanceName: String(payload.instance) },
        })
      : null;
    if (payload?.instance && !knownInstance) {
      console.log("[Evolution webhook] ignorada (não é instância do painel):", payload.instance);
      return NextResponse.json({
        ok: true,
        action: "ignored_foreign_instance",
        instance: payload.instance,
      });
    }

    // Processa eventos de atualização de status (read receipts)
    const event = payload?.event;
    const eventName = String(event || "").toLowerCase();

    if (
      eventName === "connection.update" ||
      eventName === "connection_update" ||
      eventName.includes("qrcode")
    ) {
      const instName = payload?.instance as string | undefined;
      if (instName) {
        const data = payload?.data || {};
        const state = String(data.state || data.status || "").toLowerCase();
        const qrRaw =
          data.qrcode?.base64 || data.qrcode?.code || data.base64 || data.qrcode;
        const qr =
          typeof qrRaw === "string"
            ? qrRaw.startsWith("data:")
              ? qrRaw
              : `data:image/png;base64,${qrRaw}`
            : null;

        const existing = await prisma.instance.findFirst({
          where: { instanceName: instName },
        });
        if (existing) {
          const update: {
            status?: "CONNECTED" | "CONNECTING" | "QRCODE" | "DISCONNECTED";
            qrcode?: string | null;
            phone?: string | null;
            warmupStartedAt?: Date;
          } = {};
          if (state === "open") {
            update.status = "CONNECTED";
            update.qrcode = null;
            const owner = data.wuid || data.ownerJid || data.instance?.ownerJid;
            if (typeof owner === "string") update.phone = owner.split("@")[0];
            if (!existing.warmupStartedAt) update.warmupStartedAt = new Date();
          } else if (state === "connecting") {
            update.status = "CONNECTING";
          } else if (state === "close" || state === "closed") {
            update.status = qr ? "QRCODE" : "DISCONNECTED";
          }
          if (qr && update.status !== "CONNECTED") {
            update.status = "QRCODE";
            update.qrcode = qr;
          }
          if (Object.keys(update).length) {
            await prisma.instance.update({ where: { id: existing.id }, data: update });
          }
        }
      }
      return NextResponse.json({ ok: true, event: eventName });
    }

    if (isAckOnlyEvent(eventName, payload)) {
      const updates = Array.isArray(payload?.data) ? payload.data : [payload?.data];
      for (const upd of updates) {
        const msgId = upd?.key?.id || upd?.id;
        const ack = upd?.update?.ack ?? upd?.ack ?? upd?.update?.status;
        if (msgId && ack != null) {
          const statusMap: Record<number, string> = {
            1: "sent",
            2: "delivered",
            3: "read",
            4: "read",
          };
          const newStatus = typeof ack === "number" ? statusMap[ack] : String(ack).toLowerCase();
          if (newStatus) {
            try {
              await prisma.message.updateMany({
                where: { providerId: msgId },
                data: { status: newStatus },
              });
            } catch { /* ignore */ }
          }
        }
      }
      return NextResponse.json({ ok: true, event: "status_update" });
    }

    const items = collectWebhookMessages(payload);
    if (!items.length) {
      console.log("[Evolution webhook] evento sem mensagem", {
        event: eventName,
        instance: payload?.instance,
        dataKeys: payload?.data && typeof payload.data === "object" ? Object.keys(payload.data) : [],
      });
      return NextResponse.json({ ok: true, action: "ignored", event: eventName });
    }

    let lastAction: Record<string, unknown> = { ok: true };
    for (const item of items) {
      lastAction = await ingestWhatsAppMessage(item, payload?.instance);
    }
    return NextResponse.json(lastAction);
  } catch (error) {
    console.error("Webhook Evolution error:", error);
    return NextResponse.json(
      { ok: false, error: "internal error" },
      { status: 500 }
    );
  }
}

async function ingestWhatsAppMessage(
  item: Record<string, unknown>,
  instanceName: string | undefined
): Promise<Record<string, unknown>> {
  try {
    const parsed = parseIncomingMessage(item);
    if (!parsed) {
      return { ok: true, action: "skipped_jid" };
    }

    const { remoteJid, phone, fromMe, pushName, avatarUrl, messageType } = parsed;
    let { text } = parsed;
    const providerId = parsed.providerId;
    const msg = parsed.message;

    if (providerId) {
      const already = await prisma.message.findFirst({ where: { providerId } });
      if (already) return { ok: true, action: "deduped" };
    }

    console.log("[Evolution webhook] mensagem", {
      instance: instanceName,
      fromMe,
      phone,
      type: messageType,
      hasText: !!text,
    });

    // Só transcreve/descreve mídia em mensagens recebidas (não as enviadas por nós)
    let savedMediaUrl: string | null = null;
    let transcriptionText: string | null = null;

    if (!fromMe) {
      if (messageType === "audio" && instanceName && providerId) {
        const media = await evolutionGetMediaBase64(instanceName, providerId);
        if (media) {
          if (media.base64 && media.mimeType) {
            try { savedMediaUrl = await saveMedia(media.base64, media.mimeType); } catch (e) { console.error("Erro ao salvar áudio:", e); }
          }
          const transcribed = await transcribeAudio(media.base64, media.mimeType);
          if (transcribed) {
            transcriptionText = transcribed;
            text = transcribed;
          }
        }
        if (!text) text = "[Áudio não transcrito]";
      } else if (messageType === "image" && instanceName && providerId) {
        const media = await evolutionGetMediaBase64(instanceName, providerId);
        const caption = String(
          (msg.imageMessage as { caption?: string } | undefined)?.caption ?? ""
        );
        if (media) {
          if (media.base64 && media.mimeType) {
            try { savedMediaUrl = await saveMedia(media.base64, media.mimeType); } catch (e) { console.error("Erro ao salvar imagem:", e); }
          }
          const described = await describeImage(media.base64, media.mimeType, caption || undefined);
          if (described) {
            transcriptionText = described;
            text = caption ? `${described}\n\nLegenda do usuário: ${caption}` : described;
          }
        }
        if (!text) text = caption || "[Imagem sem descrição]";
      }
    }

    // Single-tenant: usa sempre a primeira organização
    let org = await prisma.organization.findFirst({ orderBy: { name: "asc" } });
    if (!org) {
      org = await prisma.organization.create({
        data: { name: "Amo Vidas", slug: "amovidas" },
      });
    }
    const organizationId = org.id;

    // Instância (opcional): para vincular conversa ao canal
    let instance = instanceName
      ? await prisma.instance.findFirst({
          where: { instanceName, organizationId },
          include: { organization: true },
        })
      : null;

    // Busca ou cria lead vinculado à organização
    let lead = await prisma.lead.findFirst({
      where: { 
        organizationId,
        phone,
      },
    });
    if (!lead && phone.length >= 8) {
      const tail = phone.slice(-8);
      lead = await prisma.lead.findFirst({
        where: { organizationId, phone: { endsWith: tail } },
      });
    }

    const profilePicture: string | undefined = avatarUrl;

    // pushName só é confiável em mensagens recebidas (!fromMe)
    // Mensagens enviadas (fromMe) carregam o nome da conta business, não do cliente
    const clientPushName = !fromMe ? pushName : undefined;

    if (lead) {
      lead = await prisma.lead.update({
        where: { id: lead.id },
        data: {
          lastMessageAt: new Date(),
          ...(clientPushName && { pushName: clientPushName }),
          ...(clientPushName && !lead.name && { name: clientPushName }),
          ...(profilePicture && !lead.avatarUrl && { avatarUrl: profilePicture }),
        },
      });
    } else {
      lead = await prisma.lead.create({
        data: {
          organizationId,
          phone,
          name: clientPushName || null,
          pushName: clientPushName || null,
          avatarUrl: profilePicture || null,
          status: "NOVO",
          ownerType: "bot",
          lastMessageAt: new Date(),
        },
      });

      // Adiciona automaticamente como contato salvo para envio via vCard
      await prisma.savedContact.create({
        data: {
          organizationId,
          name: clientPushName || phone,
          phone,
          category: "lead",
        },
      }).catch(() => { /* ignora duplicatas */ });
    }

    // Single-tenant: uma conversa por lead (busca por leadId apenas)
    let conversation = await prisma.conversation.findFirst({
      where: { leadId: lead.id },
    });

    if (conversation) {
      conversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          ...(fromMe ? {} : { unreadCount: { increment: 1 } }),
        },
      });
    } else {
      conversation = await prisma.conversation.create({
        data: {
          leadId: lead.id,
          instanceId: instance?.id ?? null,
          remoteJid,
          channel: "whatsapp",
          lastMessageAt: new Date(),
          unreadCount: fromMe ? 0 : 1,
        },
      });
    }

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: fromMe ? "out" : "in",
        type: messageType,
        body: text ?? null,
        mediaUrl: savedMediaUrl,
        transcription: transcriptionText,
        providerId: providerId ?? null,
        sentAt: new Date(),
      },
    });

    // Realtime: notifica o painel (SSE) da nova mensagem.
    const { emitConversationUpdate } = await import("@/lib/realtime");
    emitConversationUpdate({ type: "message", conversationId: conversation.id, leadId: conversation.leadId });

    if (!lead.avatarUrl) {
      evolutionGetProfilePicture(phone)
        .then(async (picture) => {
          if (!picture) return;
          await prisma.lead.update({
            where: { id: lead.id },
            data: { avatarUrl: picture },
          });
        })
        .catch(() => {});
    }

    // Mensagem enviada pelo atendente (fromMe): humano assumiu a conversa — bot não responde até "Devolver ao Bot"
    if (fromMe) {
      const wasBot = lead.ownerType === "bot";
      await prisma.lead.update({
        where: { id: lead.id },
        data: { ownerType: "human", status: "HUMANO_EM_ATENDIMENTO" },
      });
      if (wasBot) {
        await prisma.handoff.create({
          data: {
            leadId: lead.id,
            conversationId: conversation.id,
            requestedBy: "human",
            reason: "Atendente enviou mensagem pelo WhatsApp",
          },
        });
      }
      return { ok: true, action: "human_sent" };
    }

    if (!text?.trim()) {
      return { ok: true, action: "no_text" };
    }

    // Se lead já está com humano, não responde automaticamente
    if (lead.ownerType === "human") {
      return { ok: true, action: "human_owner" };
    }

    // Lista de exceção: números da empresa etc. — Sulma não responde
    const phoneNormalized = phone.replace(/\D/g, "").slice(-11);
    if (phoneNormalized) {
      const excluded = await prisma.excludedContact.findUnique({
        where: {
          organizationId_phone: {
            organizationId: lead.organizationId,
            phone: phoneNormalized,
          },
        },
      });
      if (excluded) {
        return { ok: true, action: "excluded_contact" };
      }
    }

    // Verifica se pediu transferência para humano
    if (text && shouldTransferToHuman(text)) {
      await prisma.$transaction([
        prisma.lead.update({
          where: { id: lead.id },
          data: { status: "HUMANO_SOLICITADO", ownerType: "human" },
        }),
        prisma.handoff.create({
          data: {
            leadId: lead.id,
            conversationId: conversation.id,
            requestedBy: "lead",
            reason: "Lead solicitou atendente humano",
            summary: text,
          },
        }),
      ]);

      const handoffMessage = `Entendido! 👤 Vou te transferir para um de nossos atendentes. Aguarde um momento que logo alguém vai te atender!`;
      
      await evolutionSendText({
        number: phone,
        text: handoffMessage,
        instanceName: instance?.instanceName,
        instanceToken: instance?.token || undefined,
      });
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: "out",
          type: "text",
          body: handoffMessage,
          sentAt: new Date(),
        },
      });

      return { ok: true, action: "handoff" };
    }

    // Guarda anti-loop: se o número do outro lado também é automação, ele responde
    // sozinho e a Sulma entra em ping-pong infinito. Se a Sulma já enviou muitas respostas
    // nesta conversa numa janela curta, para de responder e passa para humano.
    const LOOP_WINDOW_MS = 5 * 60 * 1000; // 5 min
    const LOOP_MAX_OUT = 6; // respostas da Sulma na janela
    const recentOut = await prisma.message.count({
      where: { conversationId: conversation.id, direction: "out", createdAt: { gte: new Date(Date.now() - LOOP_WINDOW_MS) } },
    });
    if (recentOut >= LOOP_MAX_OUT) {
      await prisma.$transaction([
        prisma.lead.update({ where: { id: lead.id }, data: { ownerType: "human", status: "HUMANO_EM_ATENDIMENTO" } }),
        prisma.handoff.create({
          data: {
            leadId: lead.id,
            conversationId: conversation.id,
            requestedBy: "lead",
            reason: "Possível automação no número (anti-loop) — Sulma pausou respostas",
            summary: text ?? "",
          },
        }),
      ]);
      return { ok: true, action: "loop_guard", recentOut };
    }

    // Busca histórico de mensagens para contexto da IA
    const messageHistory = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: { direction: true, body: true },
    });

    // Gera resposta humanizada com IA (Sulma - Amo Vidas)
    const { response: botResponse, extractedData } = await generateAIResponse(text ?? "", {
      leadId: lead.id,
      organizationId: lead.organizationId,
      leadName: lead.name,
      leadEmail: lead.email,
      leadCity: lead.city,
      leadPhone: lead.phone,
      leadStatus: lead.status,
      messageHistory,
    });
    
    // Cards dos planos disponíveis para envio automático
    const PLAN_CARDS: { keywords: string[]; file: string; caption: string }[] = [
      { keywords: ["plano rotina", "rotina", "r$ 37", "37,90", "37,00"], file: "exame_plano_ rotina.jpeg", caption: "Plano Rotina - Amo Vidas" },
      { keywords: ["plano especializado", "especializado", "r$ 57", "57,90"], file: "exame_plano_ especializado.jpeg", caption: "Plano Especializado - Amo Vidas" },
      { keywords: ["cobertura total", "r$ 97", "97,90"], file: "exame_plano_ cobertura_ total.jpeg", caption: "Plano Cobertura Total - Amo Vidas" },
      { keywords: ["check-up", "checkup", "check up"], file: "checkups.jpeg", caption: "Check-ups - Amo Vidas" },
      { keywords: ["especialidade", "especialidades"], file: "especialidades_dentro_dos_palnos.jpeg", caption: "Especialidades - Amo Vidas" },
      { keywords: ["dependente", "dependentes", "familiar"], file: "planos_e_seu_dependentes.jpeg", caption: "Planos e Dependentes - Amo Vidas" },
    ];

    try {
      // Verifica se é a primeira resposta do bot (nenhuma mensagem "out" anterior)
      const previousBotMessages = await prisma.message.count({
        where: { conversationId: conversation.id, direction: "out" },
      });

      const isFirstBotResponse = previousBotMessages === 0;

      // Na primeira resposta, envia card dos 3 planos ANTES do texto
      // Exceção: se o lead perguntou sobre um plano específico
      if (isFirstBotResponse) {
        const inputLower = (text ?? "").toLowerCase();
        const mentionedSpecificPlan =
          inputLower.includes("rotina") ||
          inputLower.includes("especializado") ||
          inputLower.includes("cobertura total");

        if (!mentionedSpecificPlan) {
          try {
            const planosPath = path.join(process.cwd(), "public", "cards", "planos.jpeg");
            const planosBuffer = await readFile(planosPath);
            const planosBase64 = planosBuffer.toString("base64");

            await evolutionSendMedia({
              number: phone,
              mediatype: "image",
              media: planosBase64,
              mimetype: "image/jpeg",
              caption: "Conheça nossos planos - Amo Vidas Clube de Saúde 💖",
              fileName: "planos.jpeg",
              instanceName: instance?.instanceName,
              instanceToken: instance?.token || undefined,
            });

            await prisma.message.create({
              data: {
                conversationId: conversation.id,
                direction: "out",
                type: "image",
                body: "[Imagem enviada: Planos Amo Vidas]",
                sentAt: new Date(),
              },
            });

            console.log("[Bot] Card dos 3 planos enviado (primeira resposta)");
          } catch (planosErr) {
            console.error("[Bot] Erro ao enviar card dos planos:", planosErr);
          }
        }
      }

      // Envia mensagem de forma humanizada (com "digitando" e pausas)
      await evolutionSendTextHumanized({
        number: phone,
        text: botResponse,
        instanceName: instance?.instanceName,
        instanceToken: instance?.token || undefined,
      });
      
      // Salva a resposta do bot no banco
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: "out",
          type: "text",
          body: botResponse,
          sentAt: new Date(),
        },
      });

      // Detecta se a resposta menciona planos e envia o card correspondente
      const responseLower = botResponse.toLowerCase();
      const cardsToSend = PLAN_CARDS.filter((card) =>
        card.keywords.some((kw) => responseLower.includes(kw))
      ).slice(0, 2); // Máximo 2 cards por resposta

      for (const card of cardsToSend) {
        try {
          const filePath = path.join(process.cwd(), "public", "cards", card.file);
          const fileBuffer = await readFile(filePath);
          const base64 = fileBuffer.toString("base64");

          await evolutionSendMedia({
            number: phone,
            mediatype: "image",
            media: base64,
            mimetype: "image/jpeg",
            caption: card.caption,
            fileName: card.file,
            instanceName: instance?.instanceName,
            instanceToken: instance?.token || undefined,
          });

          await prisma.message.create({
            data: {
              conversationId: conversation.id,
              direction: "out",
              type: "image",
              body: `[Imagem enviada: ${card.caption}]`,
              sentAt: new Date(),
            },
          });

          console.log(`[Bot] Card enviado: ${card.caption}`);
        } catch (cardErr) {
          console.error(`[Bot] Erro ao enviar card ${card.file}:`, cardErr);
        }
      }

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date(), unreadCount: 0 },
      });

      // Calcula e persiste o Lead Score (0–1.000)
      const scoreBreakdown = await updateLeadScore(lead.id, messageHistory, text ?? "");
      console.log(`Lead ${lead.id} score: ${scoreBreakdown.total}/1000 (P:${scoreBreakdown.perfil} N:${scoreBreakdown.necessidade} C:${scoreBreakdown.consciencia} B:${scoreBreakdown.comportamento} D:${scoreBreakdown.decisao})`);

      // Detecta status por keywords (prioridade: PERDIDO > FECHADO > etc.)
      const detectedStatus = detectLeadStatus(
        messageHistory,
        text ?? "",
        lead.status
      );

      // Se keywords detectaram mudança, usa keyword; senão usa score para sugerir
      let newStatus: string | null = detectedStatus;
      if (!newStatus) {
        const scoreStatus = getStatusFromScore(scoreBreakdown.total);
        // Só avança pelo score (não regride), e não sobrescreve status manuais/especiais
        const protectedStatuses = ["FECHADO", "PERDIDO", "HUMANO_SOLICITADO", "HUMANO_EM_ATENDIMENTO", "AGUARDANDO_RESPOSTA", "LEAD_FRIO"];
        if (!protectedStatuses.includes(lead.status) && scoreStatus !== lead.status) {
          // Score só avança: NOVO → EM_ATENDIMENTO → CONSCIENTIZADO → QUALIFICADO → EM_NEGOCIACAO
          const statusOrder = ["NOVO", "EM_ATENDIMENTO", "CONSCIENTIZADO", "QUALIFICADO", "EM_NEGOCIACAO", "HUMANO_SOLICITADO"];
          const currentIdx = statusOrder.indexOf(lead.status);
          const newIdx = statusOrder.indexOf(scoreStatus);
          if (newIdx > currentIdx) {
            newStatus = scoreStatus;
          }
        }
      }
      
      if (newStatus && newStatus !== lead.status) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { status: newStatus as LeadStatus },
        });
        console.log(`Lead ${lead.id} status atualizado: ${lead.status} → ${newStatus} (score: ${scoreBreakdown.total})`);
      }

      // Gera resumo da conversa a cada 5 mensagens do lead (não bloqueia resposta)
      const leadMsgCount = messageHistory.filter((m) => m.direction === "in").length;
      if (leadMsgCount > 0 && leadMsgCount % 5 === 0) {
        generateConversationSummary(messageHistory, lead.name)
          .then(async (summary) => {
            if (summary) {
              await prisma.lead.update({
                where: { id: lead.id },
                data: { summary },
              });
              console.log(`Lead ${lead.id} resumo atualizado`);
            }
          })
          .catch((err) => console.error("Erro ao gerar resumo:", err));
      }
    } catch (sendError) {
      console.error("Erro ao enviar resposta do bot:", sendError);
    }

    return { 
      ok: true, 
      action: "bot_replied",
      extractedData 
    };
  } catch (error) {
    console.error("Webhook Evolution ingest error:", error);
    return { ok: false, error: "internal error" };
  }
}
