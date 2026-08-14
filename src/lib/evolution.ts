/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

import { getSystemSettings } from "@/lib/settings";

type SendTextArgs = {
  number: string;
  text: string;
};

async function getEvolutionConfig() {
  const settings = await getSystemSettings();
  return {
    baseUrl: settings.evolutionBaseUrl || process.env.EVOLUTION_BASE_URL || "",
    instance: settings.evolutionInstance || process.env.EVOLUTION_INSTANCE || "",
    token: settings.evolutionToken || process.env.EVOLUTION_TOKEN || "",
  };
}

/**
 * Envia status "composing" (digitando) para o contato
 */
export async function evolutionSendPresence(number: string, presence: "composing" | "recording" | "paused" = "composing") {
  const { baseUrl, instance, token } = await getEvolutionConfig();

  // Evolution API v2 - endpoint correto: /chat/sendPresence
  const url = `${baseUrl.replace(/\/api\/?$/, "")}/chat/sendPresence/${instance}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: token,
      },
      body: JSON.stringify({
        number,
        presence,
        delay: 1200,
      }),
    });
    
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("Erro presence:", res.status, body);
    }
  } catch (error) {
    console.error("Erro ao enviar presence:", error);
  }
}

export async function evolutionSendText({ number, text }: SendTextArgs) {
  const { baseUrl, instance, token } = await getEvolutionConfig();

  if (!baseUrl || !instance || !token) {
    throw new Error("Evolution API não configurada (baseUrl, instance ou token faltando)");
  }

  // Evolution API v2 - remove /api do base se existir
  const url = `${baseUrl.replace(/\/api\/?$/, "")}/message/sendText/${instance}`;

  console.log("[Evolution] Sending message to:", url);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: token,
    },
    body: JSON.stringify({
      number,
      text,
    }),
    signal: AbortSignal.timeout(30000), // 30 segundos de timeout
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[Evolution] Send failed:", res.status, body);
    throw new Error(`Evolution sendText failed: ${res.status} ${body}`);
  }

  console.log("[Evolution] Message sent successfully");
  return res.json().catch(() => ({}));
}

/**
 * Envia áudio (base64) via Evolution API como mensagem de voz (PTT)
 */
export async function evolutionSendAudio({ number, base64, mimeType }: { number: string; base64: string; mimeType?: string }) {
  const { baseUrl, instance, token } = await getEvolutionConfig();

  if (!baseUrl || !instance || !token) {
    throw new Error("Evolution API não configurada (baseUrl, instance ou token faltando)");
  }

  const url = `${baseUrl.replace(/\/api\/?$/, "")}/message/sendWhatsAppAudio/${instance}`;

  console.log("[Evolution] Sending audio to:", number);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: token,
    },
    body: JSON.stringify({
      number,
      audio: base64,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[Evolution] Send audio failed:", res.status, body);
    throw new Error(`Evolution sendAudio failed: ${res.status} ${body}`);
  }

  console.log("[Evolution] Audio sent successfully");
  return res.json().catch(() => ({}));
}

/**
 * Envia mídia (imagem, documento, vídeo) via Evolution API
 */
export async function evolutionSendMedia({
  number,
  mediatype,
  media,
  mimetype,
  caption,
  fileName,
}: {
  number: string;
  mediatype: "image" | "document" | "video";
  media: string; // base64 puro ou URL pública
  mimetype?: string;
  caption?: string;
  fileName?: string;
}) {
  const { baseUrl, instance, token } = await getEvolutionConfig();

  if (!baseUrl || !instance || !token) {
    throw new Error("Evolution API não configurada (baseUrl, instance ou token faltando)");
  }

  const url = `${baseUrl.replace(/\/api\/?$/, "")}/message/sendMedia/${instance}`;

  console.log("[Evolution] Sending media to:", number, "type:", mediatype);

  const body: Record<string, unknown> = {
    number,
    mediatype,
    media,
  };
  if (mimetype) body.mimetype = mimetype;
  if (caption) body.caption = caption;
  if (fileName) body.fileName = fileName;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: token,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const resBody = await res.text().catch(() => "");
    console.error("[Evolution] Send media failed:", res.status, resBody);
    throw new Error(`Evolution sendMedia failed: ${res.status} ${resBody}`);
  }

  console.log("[Evolution] Media sent successfully");
  return res.json().catch(() => ({}));
}

/**
 * Calcula delay de digitação baseado no tamanho do texto
 * Simula velocidade de digitação humana (~50-80 caracteres por segundo)
 */
function calculateTypingDelay(text: string): number {
  const baseDelay = 500; // Delay mínimo de 500ms
  const charsPerSecond = 60; // Velocidade média de digitação
  const calculatedDelay = (text.length / charsPerSecond) * 1000;
  const maxDelay = 4000; // Máximo de 4 segundos
  
  return Math.min(baseDelay + calculatedDelay, maxDelay);
}

/**
 * Divide texto em partes menores para envio mais natural
 * Divide por parágrafos, frases ou tamanho máximo
 */
function splitMessage(text: string, maxLength: number = 300): string[] {
  // Primeiro tenta dividir por parágrafos (linhas duplas)
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
  
  if (paragraphs.length > 1) {
    const result: string[] = [];
    for (const paragraph of paragraphs) {
      if (paragraph.length <= maxLength) {
        result.push(paragraph.trim());
      } else {
        // Se o parágrafo for muito grande, divide por frases
        result.push(...splitBySentences(paragraph, maxLength));
      }
    }
    return result;
  }
  
  // Se não tem parágrafos, divide por frases
  return splitBySentences(text, maxLength);
}

function splitBySentences(text: string, maxLength: number): string[] {
  // Divide por pontuação final (. ! ?)
  const sentences = text.split(/(?<=[.!?])\s+/);
  const result: string[] = [];
  let current = "";
  
  for (const sentence of sentences) {
    if ((current + " " + sentence).trim().length <= maxLength) {
      current = (current + " " + sentence).trim();
    } else {
      if (current) result.push(current);
      current = sentence.trim();
    }
  }
  
  if (current) result.push(current);
  
  // Se ainda tiver partes muito grandes, divide por tamanho
  return result.flatMap(part => {
    if (part.length <= maxLength) return [part];
    const chunks: string[] = [];
    let i = 0;
    while (i < part.length) {
      chunks.push(part.slice(i, i + maxLength));
      i += maxLength;
    }
    return chunks;
  });
}

/**
 * Aguarda um tempo em ms
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Envia mensagem de forma humanizada:
 * - Divide mensagens longas
 * - Mostra "digitando" antes de cada parte
 * - Pausa entre mensagens
 */
/**
 * Busca a foto de perfil de um contato no WhatsApp
 */
/**
 * Obtém mídia (áudio, imagem, etc.) de uma mensagem em base64.
 * Usado para transcrição de áudio (Whisper) e descrição de imagem (Vision).
 * @param instanceName Nome da instância Evolution (ex.: payload.instance)
 * @param messageKeyId ID da mensagem (ex.: payload.data.key.id)
 * @returns Objeto com base64 e opcionalmente mimeType, ou null se falhar
 */
export async function evolutionGetMediaBase64(
  instanceName: string,
  messageKeyId: string
): Promise<{ base64: string; mimeType?: string } | null> {
  const { baseUrl, token } = await getEvolutionConfig();
  if (!baseUrl || !token) return null;

  const url = `${baseUrl.replace(/\/api\/?$/, "")}/chat/getBase64FromMediaMessage/${instanceName}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: token,
      },
      body: JSON.stringify({
        message: { key: { id: messageKeyId } },
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const base64 = data?.base64 ?? data?.base64Base64 ?? null;
    if (!base64 || typeof base64 !== "string") return null;
    return {
      base64,
      mimeType: data?.mimetype ?? data?.mimeType ?? undefined,
    };
  } catch (error) {
    console.error("[Evolution] Erro ao obter mídia base64:", error);
    return null;
  }
}

export async function evolutionGetProfilePicture(number: string): Promise<string | null> {
  const { baseUrl, instance, token } = await getEvolutionConfig();
  
  // Endpoint correto da Evolution API v2: /chat/fetchProfile
  const url = `${baseUrl.replace(/\/api\/?$/, "")}/chat/fetchProfile/${instance}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: token,
      },
      body: JSON.stringify({ number }),
    });

    if (!res.ok) {
      console.log(`[Evolution] Erro ao buscar perfil: ${res.status}`);
      return null;
    }

    const data = await res.json();
    // O campo correto é "picture" no endpoint fetchProfile
    return data?.picture || data?.profilePictureUrl || null;
  } catch (error) {
    console.error("[Evolution] Erro ao buscar foto de perfil:", error);
    return null;
  }
}

/**
 * Envia texto respondendo uma mensagem específica (quote reply)
 */
export async function evolutionSendTextWithQuote({
  number,
  text,
  quotedId,
  remoteJid,
}: {
  number: string;
  text: string;
  quotedId: string;
  remoteJid: string;
}) {
  const { baseUrl, instance, token } = await getEvolutionConfig();
  if (!baseUrl || !instance || !token) {
    throw new Error("Evolution API não configurada");
  }

  const url = `${baseUrl.replace(/\/api\/?$/, "")}/message/sendText/${instance}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: token },
    body: JSON.stringify({
      number,
      text,
      quoted: {
        key: {
          remoteJid,
          fromMe: false,
          id: quotedId,
        },
        message: { conversation: "" },
      },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[Evolution] Send quoted failed:", res.status, body);
    throw new Error(`Evolution sendTextWithQuote failed: ${res.status} ${body}`);
  }
  return res.json().catch(() => ({}));
}

/**
 * Edita uma mensagem já enviada no WhatsApp
 */
export async function evolutionUpdateMessage({
  remoteJid,
  messageId,
  text,
}: {
  remoteJid: string;
  messageId: string;
  text: string;
}) {
  const { baseUrl, instance, token } = await getEvolutionConfig();
  if (!baseUrl || !instance || !token) {
    throw new Error("Evolution API não configurada");
  }

  const url = `${baseUrl.replace(/\/api\/?$/, "")}/chat/updateMessage/${instance}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: token },
    body: JSON.stringify({
      number: remoteJid.split("@")[0],
      text,
      key: {
        remoteJid,
        fromMe: true,
        id: messageId,
      },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[Evolution] Update message failed:", res.status, body);
    throw new Error(`Evolution updateMessage failed: ${res.status} ${body}`);
  }
  return res.json().catch(() => ({}));
}

/**
 * Busca o status de presença (online/offline) de um contato
 */
export async function evolutionFetchPresence(number: string): Promise<{ available: boolean; lastSeen?: string } | null> {
  const { baseUrl, instance, token } = await getEvolutionConfig();
  if (!baseUrl || !instance || !token) return null;

  const url = `${baseUrl.replace(/\/api\/?$/, "")}/chat/fetchPresence/${instance}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: token },
      body: JSON.stringify({ number }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Pode retornar array ou objeto
    const presence = Array.isArray(data) ? data[0] : data;
    return {
      available: presence?.presence === "available" || presence?.status === "available",
      lastSeen: presence?.lastSeen || presence?.last || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Envia um contato (vCard) via WhatsApp
 */
export async function evolutionSendContact({
  number,
  contacts,
}: {
  number: string;
  contacts: Array<{
    fullName: string;
    phoneNumber: string;
    organization?: string;
    email?: string;
  }>;
}) {
  const { baseUrl, instance, token } = await getEvolutionConfig();
  if (!baseUrl || !instance || !token) {
    throw new Error("Evolution API não configurada");
  }

  const url = `${baseUrl.replace(/\/api\/?$/, "")}/message/sendContact/${instance}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: token },
    body: JSON.stringify({
      number,
      contact: contacts.map((c) => ({
        fullName: c.fullName,
        phoneNumber: c.phoneNumber.replace(/\D/g, ""),
        organization: c.organization || "",
        email: c.email || "",
        wuid: c.phoneNumber.replace(/\D/g, ""),
      })),
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[Evolution] Send contact failed:", res.status, body);
    throw new Error(`Evolution sendContact failed: ${res.status} ${body}`);
  }
  return res.json().catch(() => ({}));
}

export async function evolutionSendTextHumanized({ number, text }: SendTextArgs) {
  const parts = splitMessage(text);
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    
    // Envia status "digitando"
    await evolutionSendPresence(number, "composing");
    
    // Aguarda tempo proporcional ao tamanho
    const typingDelay = calculateTypingDelay(part);
    await sleep(typingDelay);
    
    // Envia a mensagem
    await evolutionSendText({ number, text: part });
    
    // Pausa entre mensagens (se não for a última)
    if (i < parts.length - 1) {
      await sleep(800); // 800ms entre mensagens
    }
  }
}
