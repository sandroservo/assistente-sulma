/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Variação de mensagem por IA: gera um POOL de reescritas com o mesmo sentido,
 * tom de conversa natural do WhatsApp. 1 chamada por disparo (não por contato).
 * Preserva EXATO placeholders {{...}}, números, valores, datas e links — pra
 * não mandar informação errada ao cliente. Fallback: retorna [original].
 */

import OpenAI from "openai";
import { getSystemSettings } from "@/lib/settings";

const FALLBACK_MODEL = "gpt-4o-mini";

/** Gera até `n` variações naturais da mensagem. Nunca lança — degrada pro original. */
export async function generateVariations(message: string, n = 15): Promise<string[]> {
  const original = message.trim();
  if (!original) return [original];

  try {
    const settings = await getSystemSettings();
    const apiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) return [original];
    const client = new OpenAI({ apiKey });

    const sys =
      "Você reescreve mensagens de WhatsApp para soar como conversa natural, variando as palavras. " +
      "REGRAS INVIOLÁVEIS: mantenha EXATAMENTE iguais os placeholders entre chaves duplas (ex.: {{nome}}), " +
      "todos os números, valores em dinheiro, datas, horários e links/URLs. NÃO acrescente nem remova informação. " +
      "Mesmo idioma, mesmo sentido, comprimento parecido. Responda SOMENTE um array JSON de strings.";
    const user = `Gere ${n} variações desta mensagem:\n\n"""${original}"""`;

    const res = await client.chat.completions.create({
      model: settings.openaiModel || FALLBACK_MODEL,
      temperature: 0.9,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    });

    const raw = res.choices[0]?.message?.content ?? "";
    const variations = parseVariations(raw);
    // Garante o original no pool e filtra vazios/duplicados.
    const pool = [...new Set([original, ...variations].map((s) => s.trim()).filter(Boolean))];
    return pool.length ? pool : [original];
  } catch (e) {
    console.error("[message-variations] falha, usando original:", e instanceof Error ? e.message : e);
    return [original];
  }
}

/** Aceita `{"variacoes":[...]}` ou `[...]` direto. */
export function parseVariations(raw: string): string[] {
  try {
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return data.filter((x): x is string => typeof x === "string");
    if (data && typeof data === "object") {
      const arr = Object.values(data).find((v) => Array.isArray(v));
      if (Array.isArray(arr)) return arr.filter((x): x is string => typeof x === "string");
    }
  } catch {
    // não é JSON válido
  }
  return [];
}
