/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrganizationSettings } from "@/lib/session";

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
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!instance) {
      return NextResponse.json({ error: "Instância não encontrada" }, { status: 404 });
    }

    const orgSettings = await getOrganizationSettings(session.user.organizationId);
    const baseUrl = orgSettings.evolutionBaseUrl || process.env.EVOLUTION_BASE_URL;
    const token = instance.token || orgSettings.evolutionToken || process.env.EVOLUTION_TOKEN;

    if (!baseUrl || !token) {
      return NextResponse.json({ status: instance.status });
    }

    const statusUrl = `${baseUrl.replace(/\/api\/?$/, "")}/instance/connectionState/${instance.instanceName}`;
    
    try {
      const res = await fetch(statusUrl, {
        method: "GET",
        headers: { apikey: token },
      });

      if (res.ok) {
        const data = await res.json();
        let newStatus = instance.status;
        let phone = instance.phone;

        if (data.instance?.state === "open") {
          newStatus = "CONNECTED";
          phone = data.instance?.ownerJid?.split("@")[0] || phone;
        } else if (data.instance?.state === "connecting") {
          newStatus = "CONNECTING";
        } else {
          newStatus = "DISCONNECTED";
        }

        if (newStatus !== instance.status || phone !== instance.phone) {
          await prisma.instance.update({
            where: { id },
            data: { status: newStatus, phone },
          });
        }

        return NextResponse.json({ status: newStatus, phone });
      }
    } catch (e) {
      console.error("Erro ao verificar status:", e);
    }

    return NextResponse.json({ status: instance.status, phone: instance.phone });
  } catch (error) {
    console.error("Erro ao buscar status:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
