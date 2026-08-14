/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 * 
 * Rota de teste para verificar conectividade com Evolution API
 */

import { NextResponse } from "next/server";
import { getSystemSettings } from "@/lib/settings";

export async function GET() {
  try {
    const settings = await getSystemSettings();
    const baseUrl = settings.evolutionBaseUrl || process.env.EVOLUTION_BASE_URL || "";
    const instance = settings.evolutionInstance || process.env.EVOLUTION_INSTANCE || "";
    const token = settings.evolutionToken || process.env.EVOLUTION_TOKEN || "";

    if (!baseUrl || !instance || !token) {
      return NextResponse.json({
        ok: false,
        error: "Evolution API não configurada",
        config: {
          baseUrl: baseUrl ? "✅" : "❌",
          instance: instance ? "✅" : "❌",
          token: token ? "✅" : "❌",
        },
      });
    }

    // Testa conectividade
    const testUrl = `${baseUrl.replace(/\/api\/?$/, "")}/instance/fetchInstances`;
    
    console.log("[Test Evolution] Testing connection to:", testUrl);
    
    const startTime = Date.now();
    
    try {
      const res = await fetch(testUrl, {
        method: "GET",
        headers: {
          apikey: token,
        },
        signal: AbortSignal.timeout(10000),
      });

      const duration = Date.now() - startTime;

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return NextResponse.json({
          ok: false,
          error: `HTTP ${res.status}`,
          details: body,
          duration: `${duration}ms`,
          url: testUrl,
        });
      }

      const data = await res.json();

      return NextResponse.json({
        ok: true,
        message: "Conectado com sucesso!",
        duration: `${duration}ms`,
        instances: data.length || 0,
        url: testUrl,
      });
    } catch (fetchError) {
      const duration = Date.now() - startTime;
      const error = fetchError instanceof Error ? fetchError.message : String(fetchError);
      
      return NextResponse.json({
        ok: false,
        error: "Erro de conexão",
        details: error,
        duration: `${duration}ms`,
        url: testUrl,
        suggestions: [
          "Verifique se Evolution API está rodando",
          "Se estiver no mesmo servidor, tente usar localhost ou IP interno",
          "Verifique firewall e configuração de rede do Docker",
        ],
      });
    }
  } catch (error) {
    console.error("[Test Evolution] Error:", error);
    return NextResponse.json({
      ok: false,
      error: "Erro interno",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
