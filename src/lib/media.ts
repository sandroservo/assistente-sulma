/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Transcrição de áudio (Whisper) e descrição de imagem (Vision) para mensagens do WhatsApp.
 */

import fs from "fs";
import os from "os";
import path from "path";
import OpenAI from "openai";
import { getSystemSettings } from "./settings";

async function getOpenAIClient(): Promise<OpenAI | null> {
  const settings = await getSystemSettings();
  const apiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

/**
 * Transcreve áudio em base64 (ex.: áudio do WhatsApp) usando OpenAI Whisper.
 * @param base64 Conteúdo do áudio em base64
 * @param mimeType Opcional, ex.: audio/ogg (WhatsApp costuma enviar ogg)
 * @returns Texto transcrito ou null se falhar
 */
export async function transcribeAudio(
  base64: string,
  mimeType?: string
): Promise<string | null> {
  const openai = await getOpenAIClient();
  if (!openai) return null;

  try {
    const format = (mimeType?.split("/")[1]?.split(";")[0]?.trim()) ?? "ogg";
    const buffer = Buffer.from(base64, "base64");
    const tmpPath = path.join(os.tmpdir(), `whisper-${Date.now()}.${format}`);
    fs.writeFileSync(tmpPath, buffer);
    try {
      const file = fs.createReadStream(tmpPath);
      const transcription = await openai.audio.transcriptions.create({
        file,
        model: "whisper-1",
        language: "pt",
      });
      const text = transcription?.text?.trim();
      return text || null;
    } finally {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // ignore
      }
    }
  } catch (error) {
    console.error("[Media] Erro ao transcrever áudio:", error);
    return null;
  }
}

/**
 * Descreve uma imagem em base64 usando OpenAI Vision (GPT-4o ou gpt-4o-mini).
 * @param base64 Conteúdo da imagem em base64
 * @param mimeType Opcional, ex.: image/jpeg
 * @param caption Legenda enviada pelo usuário (incluída no contexto para a IA)
 * @returns Descrição da imagem em texto ou null se falhar
 */
export async function describeImage(
  base64: string,
  mimeType?: string,
  caption?: string
): Promise<string | null> {
  const openai = await getOpenAIClient();
  if (!openai) return null;

  const settings = await getSystemSettings();
  const model = settings.openaiModel || process.env.OPENAI_MODEL || "gpt-4o-mini";

  try {
    const imageUrl = `data:${mimeType ?? "image/jpeg"};base64,${base64}`;
    const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
      {
        type: "image_url",
        image_url: { url: imageUrl },
      },
    ];
    const system =
      "Descreva de forma objetiva o que aparece na imagem, em português. Foque em texto visível, objetos, cenário e ações. A descrição será usada por um assistente para responder ao usuário.";
    const userContent =
      caption?.trim()
        ? `O usuário enviou esta imagem com a legenda: "${caption}". Descreva a imagem e, se a legenda for uma pergunta ou pedido, deixe claro na descrição para o assistente poder responder.`
        : "Descreva o conteúdo desta imagem.";

    const response = await openai.chat.completions.create({
      model,
      max_tokens: 500,
      messages: [
        { role: "system", content: system },
        { role: "user", content: [content[0], { type: "text", text: userContent }] },
      ],
    });
    const text = response?.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch (error) {
    console.error("[Media] Erro ao descrever imagem:", error);
    return null;
  }
}
