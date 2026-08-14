/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 * 
 * Script para popular o system prompt no banco a partir do arquivo
 */

import { readFileSync } from "fs";
import { join } from "path";
import { prisma } from "../src/lib/prisma";

async function main() {
  try {
    // Lê o arquivo do system prompt
    const promptPath = join(process.cwd(), "agent", "systemprompt.md");
    const systemPrompt = readFileSync(promptPath, "utf-8");
    
    console.log(`📝 Lido system prompt: ${systemPrompt.length} caracteres`);
    
    // Salva no banco
    await prisma.settings.upsert({
      where: { key: "system_prompt" },
      update: { value: systemPrompt },
      create: {
        id: "system_prompt",
        key: "system_prompt",
        value: systemPrompt,
        encrypted: false,
      },
    });
    
    console.log("✅ System prompt salvo no banco com sucesso!");
    
    // Verifica
    const saved = await prisma.settings.findUnique({
      where: { key: "system_prompt" },
    });
    
    console.log(`\n✅ Verificação: ${saved?.value?.length || 0} caracteres salvos`);
    console.log("\n📝 Primeiras 300 caracteres:");
    console.log(saved?.value?.substring(0, 300) + "...");
  } catch (error) {
    console.error("❌ Erro ao salvar system prompt:", error);
  }
}

main();
