/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 * 
 * API para gerenciar configurações do sistema
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSystemSettings, saveSystemSettings } from "@/lib/settings";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    if (!["OWNER", "ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ ok: false, error: "Sem permissão para ver configurações" }, { status: 403 });
    }

    const settings = await getSystemSettings();
    
    // Mascarar valores sensíveis para exibição
    return NextResponse.json({
      ok: true,
      settings: {
        evolutionBaseUrl: settings.evolutionBaseUrl,
        evolutionInstance: settings.evolutionInstance,
        evolutionToken: settings.evolutionToken ? "••••••••" + settings.evolutionToken.slice(-4) : "",
        webhookSecret: settings.webhookSecret ? "••••••••" + settings.webhookSecret.slice(-4) : "",
        openaiApiKey: settings.openaiApiKey ? "••••••••" + settings.openaiApiKey.slice(-4) : "",
        openaiModel: settings.openaiModel,
        appUrl: settings.appUrl,
        systemPrompt: settings.systemPrompt ? "(configurado)" : "",
        asaasWebhookUrl: settings.asaasWebhookUrl,
        n8nTranscribeWebhook: settings.n8nTranscribeWebhook,
        hasEvolutionToken: !!settings.evolutionToken,
        hasWebhookSecret: !!settings.webhookSecret,
        hasOpenaiApiKey: !!settings.openaiApiKey,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar configurações:", error);
    return NextResponse.json(
      { ok: false, error: "Erro ao buscar configurações" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    if (!["OWNER", "ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ ok: false, error: "Sem permissão para alterar configurações" }, { status: 403 });
    }

    const body = await req.json();
    
    const settings: Record<string, string> = {};
    
    if (body.evolutionBaseUrl !== undefined) {
      settings.evolutionBaseUrl = body.evolutionBaseUrl;
    }
    if (body.evolutionInstance !== undefined) {
      settings.evolutionInstance = body.evolutionInstance;
    }
    if (body.evolutionToken && body.evolutionToken !== "••••••••") {
      settings.evolutionToken = body.evolutionToken;
    }
    if (body.webhookSecret && body.webhookSecret !== "••••••••") {
      settings.webhookSecret = body.webhookSecret;
    }
    if (body.openaiApiKey && body.openaiApiKey !== "••••••••") {
      settings.openaiApiKey = body.openaiApiKey;
    }
    if (body.openaiModel !== undefined) {
      settings.openaiModel = body.openaiModel;
    }
    if (body.appUrl !== undefined) {
      settings.appUrl = body.appUrl;
    }
    if (body.n8nTranscribeWebhook !== undefined) {
      settings.n8nTranscribeWebhook = body.n8nTranscribeWebhook;
    }
    if (body.systemPrompt !== undefined) {
      settings.systemPrompt = body.systemPrompt;
    }
    
    await saveSystemSettings(settings);
    
    return NextResponse.json({
      ok: true,
      message: "Configurações salvas com sucesso",
    });
  } catch (error) {
    console.error("Erro ao salvar configurações:", error);
    return NextResponse.json(
      { ok: false, error: "Erro ao salvar configurações" },
      { status: 500 }
    );
  }
}
