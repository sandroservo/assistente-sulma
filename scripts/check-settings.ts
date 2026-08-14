/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 * 
 * Script para verificar configurações no banco
 */

import { prisma } from "../src/lib/prisma";

async function main() {
  try {
    const settings = await prisma.settings.findMany();
    
    if (settings.length === 0) {
      console.log("❌ Nenhuma configuração encontrada no banco");
      return;
    }

    console.log("✅ Configurações encontradas:");
    console.log(`Total: ${settings.length} registros\n`);
    
    const map = new Map(settings.map((s) => [s.key, s.value]));
    
    console.log("OpenAI API Key:", map.get("openai_api_key") ? "✅ Configurada" : "❌ Não configurada");
    
    const systemPrompt = map.get("system_prompt");
    console.log("System Prompt:", systemPrompt ? `✅ ${systemPrompt.length} caracteres` : "❌ Não configurado");
    
    console.log("Evolution Base URL:", map.get("evolution_base_url") || "❌ Não configurado");
    console.log("Evolution Instance:", map.get("evolution_instance") || "❌ Não configurado");
    console.log("Evolution Token:", map.get("evolution_token") ? "✅ Configurado" : "❌ Não configurado");
    
    if (systemPrompt) {
      console.log("\n📝 Primeiras 300 caracteres do System Prompt:");
      console.log(systemPrompt.substring(0, 300) + "...");
    }
    
    console.log("\n📋 Todas as chaves:");
    settings.forEach(s => {
      console.log(`  - ${s.key}: ${s.value ? (s.value.length > 50 ? `${s.value.substring(0, 50)}...` : s.value) : "(vazio)"}`);
    });
  } catch (error) {
    console.error("Erro ao verificar configurações:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
