/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getEvolutionCredentials, evolutionApiRoot } from "@/lib/evolution-credentials";

export async function GET(
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
      return NextResponse.json({ status: instance.status, phone: instance.phone, qrcode: instance.qrcode });
    }

    const statusUrl = `${evolutionApiRoot(creds.baseUrl)}/instance/connectionState/${instance.instanceName}`;

    try {
      const res = await fetch(statusUrl, {
        method: "GET",
        headers: { apikey: creds.token },
      });

      if (res.ok) {
        const data = await res.json();
        const state = data.instance?.state || data.state;
        let newStatus = instance.status;
        let phone = instance.phone;

        if (state === "open") {
          newStatus = "CONNECTED";
          phone = data.instance?.ownerJid?.split("@")[0] || data.instance?.owner || phone;
        } else if (state === "connecting") {
          newStatus = "CONNECTING";
        } else if (state === "close") {
          newStatus = instance.qrcode ? "QRCODE" : "DISCONNECTED";
        }

        const extra: { warmupStartedAt?: Date; qrcode?: string | null } = {};
        if (newStatus === "CONNECTED") {
          extra.qrcode = null;
          if (!instance.warmupStartedAt) extra.warmupStartedAt = new Date();
        }

        if (newStatus !== instance.status || phone !== instance.phone) {
          await prisma.instance.update({
            where: { id },
            data: { status: newStatus, phone, ...extra },
          });
        }

        return NextResponse.json({
          status: newStatus,
          phone,
          qrcode: newStatus === "QRCODE" ? instance.qrcode : null,
        });
      }
    } catch (e) {
      console.error("Erro ao verificar status:", e);
    }

    return NextResponse.json({
      status: instance.status,
      phone: instance.phone,
      qrcode: instance.qrcode,
    });
  } catch (error) {
    console.error("Erro ao buscar status:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
