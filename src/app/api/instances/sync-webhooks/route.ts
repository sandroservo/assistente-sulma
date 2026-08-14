/**
 * Reaplica o webhook da Sulma em todas as instâncias da Evolution.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEvolutionCredentials } from "@/lib/evolution-credentials";
import { resolveAppBaseUrl, evolutionWebhookUrl, setInstanceWebhook } from "@/lib/evolution-webhook";

export async function POST() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const appBase = await resolveAppBaseUrl();
  if (!appBase) {
    return NextResponse.json(
      {
        error:
          "Defina a URL pública da aplicação em Configurações → Geral. Não use localhost nem o placeholder seu-dominio.com.",
      },
      { status: 400 }
    );
  }

  const webhookUrl = evolutionWebhookUrl(appBase);
  const instances = await prisma.instance.findMany({
    where: { organizationId: session.user.organizationId },
  });

  const creds = await getEvolutionCredentials(session.user.organizationId);
  if (!creds.baseUrl || !creds.token) {
    return NextResponse.json({ error: "Evolution API não configurada" }, { status: 400 });
  }

  let ok = 0;
  let failed = 0;
  for (const inst of instances) {
    const token = inst.token || creds.token;
    const success = await setInstanceWebhook({
      baseUrl: creds.baseUrl,
      token,
      instanceName: inst.instanceName,
      webhookUrl,
    });
    if (success) {
      ok++;
      await prisma.instance.update({
        where: { id: inst.id },
        data: { webhookUrl },
      });
    } else {
      failed++;
    }
  }

  return NextResponse.json({ ok: true, webhookUrl, synced: ok, failed });
}
