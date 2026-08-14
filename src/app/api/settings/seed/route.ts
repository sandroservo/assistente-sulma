/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 * 
 * Endpoint para popular configurações iniciais
 */

import { NextResponse } from "next/server";
import { saveSystemSettings } from "@/lib/settings";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    await saveSystemSettings({
      evolutionBaseUrl: body.evolutionBaseUrl || "",
      evolutionInstance: body.evolutionInstance || "",
      evolutionToken: body.evolutionToken || "",
      webhookSecret: body.webhookSecret || "",
      openaiApiKey: body.openaiApiKey || "",
    });
    
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
