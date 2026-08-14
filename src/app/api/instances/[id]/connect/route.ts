/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Cria a instância na Evolution API e devolve o QR Code.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getEvolutionCredentials, evolutionApiRoot } from "@/lib/evolution-credentials";
import { resolveAppBaseUrl, evolutionWebhookUrl, setInstanceWebhook, EVOLUTION_WEBHOOK_EVENTS } from "@/lib/evolution-webhook";

function asQrDataUri(raw: string | undefined | null): string | null {
  if (!raw) return null;
  return raw.startsWith("data:") ? raw : `data:image/png;base64,${raw.replace(/^data:image\/png;base64,/, "")}`;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id } = await params;

    const instance = await prisma.instance.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });

    if (!instance) {
      return NextResponse.json({ error: "Instância não encontrada" }, { status: 404 });
    }

    const creds = await getEvolutionCredentials(session.user.organizationId, instance.token);
    if (!creds.baseUrl || !creds.token) {
      return NextResponse.json(
        { error: "Evolution API não configurada. Vá em Configurações e preencha URL e token." },
        { status: 400 }
      );
    }

    const root = evolutionApiRoot(creds.baseUrl);
    const appBase = await resolveAppBaseUrl();
    const webhookUrl = appBase ? evolutionWebhookUrl(appBase) : "";

    if (!webhookUrl) {
      console.warn(
        "[Evolution] URL pública da aplicação não configurada. Defina em Configurações → Geral. AUTH_URL atual não pode ser placeholder/localhost."
      );
    }

    await prisma.instance.update({
      where: { id },
      data: { status: "CONNECTING", webhookUrl: webhookUrl || instance.webhookUrl },
    });

    const createRes = await fetch(`${root}/instance/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: creds.token,
      },
      body: JSON.stringify({
        instanceName: instance.instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
        groupsIgnore: false,
        alwaysOnline: false,
        readMessages: false,
        syncFullHistory: false,
        ...(webhookUrl
          ? {
              webhook: {
                url: webhookUrl,
                byEvents: false,
                base64: true,
                events: EVOLUTION_WEBHOOK_EVENTS,
              },
            }
          : {}),
      }),
    });

    if (createRes.ok) {
      const data = await createRes.json().catch(() => ({}));
      const instToken =
        data.hash?.apikey ||
        (typeof data.hash === "string" ? data.hash : null) ||
        instance.token;
      const qr =
        asQrDataUri(data.qrcode?.base64) ||
        asQrDataUri(data.qrcode?.code) ||
        asQrDataUri(data.base64);

      if (instToken && instToken !== instance.token) {
        await prisma.instance.update({
          where: { id },
          data: { token: instToken },
        });
      }

      if (qr) {
        await prisma.instance.update({
          where: { id },
          data: { status: "QRCODE", qrcode: qr, token: instToken || instance.token },
        });
        if (webhookUrl) {
          await setInstanceWebhook({
            baseUrl: creds.baseUrl,
            token: instToken || creds.token,
            instanceName: instance.instanceName,
            webhookUrl,
          });
        }
        return NextResponse.json({
          status: "QRCODE",
          qrcode: qr,
          warning: webhookUrl
            ? undefined
            : "Preencha a URL da aplicação (pública) em Configurações → Geral para as mensagens chegarem no chat.",
        });
      }
    }

    const connectRes = await fetch(`${root}/instance/connect/${instance.instanceName}`, {
      method: "GET",
      headers: { apikey: creds.token },
    });

    if (!connectRes.ok) {
      const body = await connectRes.text().catch(() => "");
      return NextResponse.json(
        { error: `Erro ao conectar na Evolution (${connectRes.status}) ${body.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const connectData = await connectRes.json().catch(() => ({}));
    const qr =
      asQrDataUri(connectData.base64) ||
      asQrDataUri(connectData.code) ||
      asQrDataUri(connectData.qrcode?.base64);

    if (qr) {
      await prisma.instance.update({
        where: { id },
        data: { status: "QRCODE", qrcode: qr },
      });
      if (webhookUrl) {
        await setInstanceWebhook({
          baseUrl: creds.baseUrl,
          token: creds.token,
          instanceName: instance.instanceName,
          webhookUrl,
        });
      }
      return NextResponse.json({
        status: "QRCODE",
        qrcode: qr,
        warning: webhookUrl
          ? undefined
          : "Preencha a URL da aplicação (pública) em Configurações → Geral para as mensagens chegarem no chat.",
      });
    }

    if (connectData.instance?.state === "open" || connectData.state === "open") {
      await prisma.instance.update({
        where: { id },
        data: {
          status: "CONNECTED",
          qrcode: null,
          warmupStartedAt: instance.warmupStartedAt ?? new Date(),
        },
      });
      if (webhookUrl) {
        await setInstanceWebhook({
          baseUrl: creds.baseUrl,
          token: creds.token,
          instanceName: instance.instanceName,
          webhookUrl,
        });
      }
      return NextResponse.json({
        status: "CONNECTED",
        webhook: !!webhookUrl,
        warning: webhookUrl
          ? undefined
          : "WhatsApp conectado, mas o webhook não foi registrado. Preencha a URL da aplicação (pública) em Configurações → Geral.",
      });
    }

    if (webhookUrl) {
      await setInstanceWebhook({
        baseUrl: creds.baseUrl,
        token: creds.token,
        instanceName: instance.instanceName,
        webhookUrl,
      });
    }

    return NextResponse.json({
      status: "CONNECTING",
      qrcode: instance.qrcode,
      webhook: !!webhookUrl,
      warning: webhookUrl
        ? undefined
        : "Preencha a URL da aplicação (pública) em Configurações → Geral para as mensagens chegarem no chat.",
    });
  } catch (error) {
    console.error("Erro ao conectar instância:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
