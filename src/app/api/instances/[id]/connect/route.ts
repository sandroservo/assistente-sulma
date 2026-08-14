/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrganizationSettings } from "@/lib/session";
import { getSystemSettings } from "@/lib/settings";

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

    // Verifica se a instância pertence à organização
    const instance = await prisma.instance.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!instance) {
      return NextResponse.json({ error: "Instância não encontrada" }, { status: 404 });
    }

    // Busca configurações da Evolution API da organização
    const orgSettings = await getOrganizationSettings(session.user.organizationId);
    const baseUrl = orgSettings.evolutionBaseUrl || process.env.EVOLUTION_BASE_URL;
    const token = instance.token || orgSettings.evolutionToken || process.env.EVOLUTION_TOKEN;

    if (!baseUrl || !token) {
      return NextResponse.json(
        { error: "Evolution API não configurada" },
        { status: 400 }
      );
    }

    // Cria instância na Evolution API se não existir
    const createUrl = `${baseUrl.replace(/\/api\/?$/, "")}/instance/create`;
    const globalSettings = await getSystemSettings();
    const appBase = globalSettings.appUrl || process.env.NEXT_PUBLIC_APP_URL || "";
    const webhookUrl = appBase ? `${appBase.replace(/\/$/, "")}/api/webhooks/evolution` : `${process.env.NEXT_PUBLIC_APP_URL || "https://seu-dominio.com"}/api/webhooks/evolution`;

    try {
      const createRes = await fetch(createUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: token,
        },
        body: JSON.stringify({
          instanceName: instance.instanceName,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
          webhook: {
            url: webhookUrl,
            events: ["MESSAGES_UPSERT"],
          },
        }),
      });

      if (createRes.ok) {
        const data = await createRes.json();
        
        // Se retornou QR Code
        if (data.qrcode?.base64) {
          await prisma.instance.update({
            where: { id },
            data: { 
              status: "QRCODE",
              qrcode: `data:image/png;base64,${data.qrcode.base64}`,
            },
          });

          return NextResponse.json({
            status: "QRCODE",
            qrcode: `data:image/png;base64,${data.qrcode.base64}`,
          });
        }
      }
    } catch (e) {
      console.log("Instância pode já existir, tentando conectar...", e);
    }

    // Tenta obter QR Code para conexão
    const connectUrl = `${baseUrl.replace(/\/api\/?$/, "")}/instance/connect/${instance.instanceName}`;
    
    const connectRes = await fetch(connectUrl, {
      method: "GET",
      headers: { apikey: token },
    });

    if (!connectRes.ok) {
      return NextResponse.json(
        { error: "Erro ao conectar instância" },
        { status: 500 }
      );
    }

    const connectData = await connectRes.json();

    if (connectData.base64) {
      await prisma.instance.update({
        where: { id },
        data: { 
          status: "QRCODE",
          qrcode: `data:image/png;base64,${connectData.base64}`,
        },
      });

      return NextResponse.json({
        status: "QRCODE",
        qrcode: `data:image/png;base64,${connectData.base64}`,
      });
    }

    // Já está conectado
    if (connectData.instance?.state === "open") {
      await prisma.instance.update({
        where: { id },
        data: { status: "CONNECTED", qrcode: null },
      });

      return NextResponse.json({ status: "CONNECTED" });
    }

    return NextResponse.json({ status: instance.status });
  } catch (error) {
    console.error("Erro ao conectar instância:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
