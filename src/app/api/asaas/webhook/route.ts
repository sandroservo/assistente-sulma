/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Webhook do Asaas para processar notificações de pagamento.
 * Grava todo evento no banco (AsaasWebhookLog) e depois processa.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evolutionSendText } from "@/lib/evolution";

type AsaasEvent =
  | "PAYMENT_CONFIRMED"
  | "PAYMENT_RECEIVED"
  | "PAYMENT_CREATED"
  | "PAYMENT_UPDATED"
  | "PAYMENT_OVERDUE"
  | "PAYMENT_DELETED"
  | "PAYMENT_REFUNDED"
  | "PAYMENT_CHARGEBACK_REQUESTED"
  | "PAYMENT_CHARGEBACK_DISPUTE"
  | "PAYMENT_AWAITING_CHARGEBACK_REVERSAL";

interface AsaasPayment {
  id?: string;
  customer?: string | { mobilePhone?: string; email?: string; name?: string };
  value?: number;
  netValue?: number;
  description?: string;
  billingType?: string;
  status?: string;
  invoiceUrl?: string;
  externalReference?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerCpfCnpj?: string;
}

interface AsaasWebhookPayload {
  event: AsaasEvent;
  payment?: AsaasPayment;
}

const MESSAGES = {
  PAYMENT_CONFIRMED: `🎉 Pagamento confirmado!

Seja muito bem-vindo(a) ao Amo Vidas! 💜

Seu cartão de benefícios já está ativo. Em breve você receberá todas as instruções de como usar.

Qualquer dúvida, estou por aqui! 😊`,

  PAYMENT_OVERDUE: `⚠️ Olá! Notei que o pagamento do seu plano Amo Vidas está pendente.

Posso te ajudar com alguma coisa? Se precisar de um novo link de pagamento, é só me avisar! 💜`,
};

function getPhoneFromPayment(payment: AsaasPayment): string | null {
  const fromTop = payment.customerPhone?.replace(/\D/g, "");
  if (fromTop) return fromTop;
  const customer = payment.customer;
  if (customer && typeof customer === "object" && customer.mobilePhone) {
    return String(customer.mobilePhone).replace(/\D/g, "") || null;
  }
  return null;
}

function getEmailFromPayment(payment: AsaasPayment): string | null {
  if (payment.customerEmail) return payment.customerEmail;
  const customer = payment.customer;
  if (customer && typeof customer === "object" && customer.email) {
    return String(customer.email) || null;
  }
  return null;
}

function getCustomerNameFromPayment(payment: AsaasPayment): string | null {
  if (payment.customerName) return payment.customerName;
  const customer = payment.customer;
  if (customer && typeof customer === "object" && customer.name) {
    return String(customer.name) || null;
  }
  return null;
}

export async function POST(req: Request) {
  let logId: string | null = null;

  try {
    const rawBody = await req.text();
    const payload: AsaasWebhookPayload = JSON.parse(rawBody);

    const event = payload.event;
    const payment = payload.payment;

    console.log("[Asaas Webhook] Evento recebido:", event);
    console.log("[Asaas Webhook] Payment ID:", payment?.id);

    if (!payment) {
      await prisma.asaasWebhookLog.create({
        data: {
          event: event ?? "UNKNOWN",
          rawPayload: rawBody,
          processed: false,
          errorMsg: "Payload sem payment",
        },
      });
      return NextResponse.json({ ok: false, error: "Payload inválido" }, { status: 400 });
    }

    // Sempre grava no banco primeiro (auditoria)
    const webhookLog = await prisma.asaasWebhookLog.create({
      data: {
        event,
        paymentId: payment.id ?? null,
        rawPayload: rawBody,
        processed: false,
      },
    });
    logId = webhookLog.id;

    const phone = getPhoneFromPayment(payment);
    const email = getEmailFromPayment(payment);
    const customerName = getCustomerNameFromPayment(payment);

    let lead: { id: string; phone: string; name: string | null; email: string | null; conversations: { id: string }[] } | null = null;

    // 1) Tenta por externalReference (ex: leadId enviado na cobrança)
    if (payment.externalReference) {
      lead = await prisma.lead.findUnique({
        where: { id: payment.externalReference },
        include: { conversations: { take: 1, orderBy: { lastMessageAt: "desc" }, select: { id: true } } },
      });
    }

    if (!lead && phone) {
      const phoneVariations = [phone, `55${phone}`, phone.replace(/^55/, "")];
      for (const phoneVar of phoneVariations) {
        lead = await prisma.lead.findFirst({
          where: { phone: { contains: phoneVar } },
          include: { conversations: { take: 1, orderBy: { lastMessageAt: "desc" }, select: { id: true } } },
        });
        if (lead) break;
      }
    }

    if (!lead && email) {
      lead = await prisma.lead.findFirst({
        where: { email },
        include: { conversations: { take: 1, orderBy: { lastMessageAt: "desc" }, select: { id: true } } },
      });
    }

    switch (event) {
      case "PAYMENT_CONFIRMED":
      case "PAYMENT_RECEIVED": {
        if (lead) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              status: "FECHADO",
              name: lead.name || customerName || null,
              email: lead.email || email || null,
            },
          });

          try {
            await evolutionSendText({
              number: lead.phone,
              text: MESSAGES.PAYMENT_CONFIRMED,
            });
          } catch (e) {
            console.error("[Asaas Webhook] Erro ao enviar WhatsApp:", e);
          }

          if (lead.conversations?.[0]) {
            await prisma.message.create({
              data: {
                conversationId: lead.conversations[0].id,
                direction: "out",
                type: "text",
                body: MESSAGES.PAYMENT_CONFIRMED,
                sentAt: new Date(),
              },
            });
          }
          console.log(`[Asaas Webhook] Lead ${lead.id} marcado como FECHADO`);
        } else {
          console.log("[Asaas Webhook] Lead não encontrado para:", phone || email || payment.externalReference);
        }
        break;
      }

      case "PAYMENT_OVERDUE": {
        if (lead) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { status: "QUALIFICADO" },
          });
          try {
            await evolutionSendText({
              number: lead.phone,
              text: MESSAGES.PAYMENT_OVERDUE,
            });
          } catch (e) {
            console.error("[Asaas Webhook] Erro ao enviar WhatsApp:", e);
          }
          if (lead.conversations?.[0]) {
            await prisma.message.create({
              data: {
                conversationId: lead.conversations[0].id,
                direction: "out",
                type: "text",
                body: MESSAGES.PAYMENT_OVERDUE,
                sentAt: new Date(),
              },
            });
          }
          console.log(`[Asaas Webhook] Follow-up enviado para lead ${lead.id}`);
        }
        break;
      }

      default:
        console.log(`[Asaas Webhook] Evento ${event} ignorado`);
    }

    if (logId) {
      await prisma.asaasWebhookLog.update({
        where: { id: logId },
        data: { processed: true, leadId: lead?.id ?? null },
      });
    }

    return NextResponse.json({
      ok: true,
      event,
      leadFound: !!lead,
      logId,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[Asaas Webhook] Erro:", error);

    if (logId) {
      await prisma.asaasWebhookLog.update({
        where: { id: logId },
        data: { processed: false, errorMsg: errMsg },
      }).catch(() => {});
    } else {
      try {
        await prisma.asaasWebhookLog.create({
          data: {
            event: "ERROR",
            rawPayload: "",
            processed: false,
            errorMsg: errMsg,
          },
        });
      } catch {
        // ignore
      }
    }

    return NextResponse.json(
      { ok: false, error: "Erro ao processar webhook" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Webhook Asaas ativo",
    events: ["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_OVERDUE"],
  });
}
