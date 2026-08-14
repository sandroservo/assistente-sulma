/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrganizationSettings } from "@/lib/session";

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

    if (baseUrl && token) {
      const logoutUrl = `${baseUrl.replace(/\/api\/?$/, "")}/instance/logout/${instance.instanceName}`;
      
      await fetch(logoutUrl, {
        method: "DELETE",
        headers: { apikey: token },
      }).catch(() => {});
    }

    await prisma.instance.update({
      where: { id },
      data: { status: "DISCONNECTED", qrcode: null, phone: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao desconectar instância:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
