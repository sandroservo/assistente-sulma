/**
 * Webhook Evolution: URL pública, registro na instância e parse do payload.
 */

import { getSystemSettings } from "@/lib/settings";
import { evolutionApiRoot } from "@/lib/evolution-credentials";

const PLACEHOLDER_HOSTS = ["seu-dominio.com", "example.com", "localhost", "127.0.0.1"];

export const EVOLUTION_WEBHOOK_EVENTS = [
  "MESSAGES_UPSERT",
  "MESSAGES_UPDATE",
  "SEND_MESSAGE",
  "CONNECTION_UPDATE",
  "QRCODE_UPDATED",
];

export function isUsablePublicUrl(url: string | undefined | null): boolean {
  if (!url?.trim()) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (PLACEHOLDER_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return false;
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function resolveAppBaseUrl(): Promise<string> {
  const settings = await getSystemSettings();
  const candidates = [
    settings.appUrl,
    process.env.AUTH_URL,
    process.env.NEXTAUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ];
  for (const raw of candidates) {
    const url = (raw || "").replace(/\/$/, "");
    if (isUsablePublicUrl(url)) return url;
  }
  return "";
}

export function evolutionWebhookUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/api/webhooks/evolution`;
}

export async function setInstanceWebhook(args: {
  baseUrl: string;
  token: string;
  instanceName: string;
  webhookUrl: string;
}): Promise<boolean> {
  const root = evolutionApiRoot(args.baseUrl);
  const bodies = [
    {
      webhook: {
        enabled: true,
        url: args.webhookUrl,
        webhookByEvents: false,
        webhookBase64: true,
        events: EVOLUTION_WEBHOOK_EVENTS,
      },
    },
    {
      enabled: true,
      url: args.webhookUrl,
      webhookByEvents: false,
      webhookBase64: true,
      events: EVOLUTION_WEBHOOK_EVENTS,
    },
  ];

  for (const body of bodies) {
    try {
      const res = await fetch(`${root}/webhook/set/${encodeURIComponent(args.instanceName)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: args.token,
        },
        body: JSON.stringify(body),
      });
      if (res.ok) return true;
    } catch (error) {
      console.error("[Evolution] webhook/set falhou:", error);
    }
  }
  return false;
}

export type IncomingWhatsApp = {
  remoteJid: string;
  phone: string;
  providerId?: string;
  fromMe: boolean;
  pushName?: string;
  avatarUrl?: string;
  message: Record<string, unknown>;
  text?: string;
  messageType: "text" | "audio" | "image";
};

function unwrapMessage(msg: Record<string, unknown> | undefined | null): Record<string, unknown> {
  if (!msg) return {};
  const nested =
    (msg.ephemeralMessage as { message?: Record<string, unknown> } | undefined)?.message ||
    (msg.viewOnceMessage as { message?: Record<string, unknown> } | undefined)?.message ||
    (msg.viewOnceMessageV2 as { message?: Record<string, unknown> } | undefined)?.message ||
    (msg.viewOnceMessageV2Extension as { message?: Record<string, unknown> } | undefined)?.message ||
    (msg.documentWithCaptionMessage as { message?: Record<string, unknown> } | undefined)?.message ||
    (msg.editedMessage as { message?: Record<string, unknown> } | undefined)?.message;
  return nested ? unwrapMessage(nested) : msg;
}

function extractText(msg: Record<string, unknown>): string | undefined {
  const m = unwrapMessage(msg);
  const ext = m.extendedTextMessage as { text?: string } | undefined;
  const image = m.imageMessage as { caption?: string } | undefined;
  const video = m.videoMessage as { caption?: string } | undefined;
  const doc = m.documentMessage as { caption?: string } | undefined;
  const buttons = m.buttonsResponseMessage as { selectedDisplayText?: string } | undefined;
  const list = m.listResponseMessage as { title?: string } | undefined;
  const template = m.templateButtonReplyMessage as { selectedDisplayText?: string } | undefined;
  const text =
    (typeof m.conversation === "string" ? m.conversation : undefined) ||
    ext?.text ||
    image?.caption ||
    video?.caption ||
    doc?.caption ||
    buttons?.selectedDisplayText ||
    list?.title ||
    template?.selectedDisplayText;
  return text?.trim() ? text : undefined;
}

function isIgnorableJid(jid: string): boolean {
  const lower = jid.toLowerCase();
  return (
    lower.includes("@g.us") ||
    lower.includes("status@broadcast") ||
    lower.includes("@broadcast") ||
    lower.includes("@newsletter")
  );
}

function jidToPhone(jid: string): string {
  return jid.split("@")[0].split(":")[0];
}

function resolveRemoteJid(item: Record<string, unknown>): string | undefined {
  const key = (item.key || {}) as Record<string, unknown>;
  const candidates = [
    key.remoteJidAlt,
    key.senderPn,
    item.senderPn,
    item.sender_pn,
    key.participantAlt,
    key.remoteJid,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.includes("@") && !value.endsWith("@lid")) {
      return value;
    }
  }
  for (const value of candidates) {
    if (typeof value === "string" && value.includes("@")) return value;
  }
  return undefined;
}

export function collectWebhookMessages(payload: Record<string, unknown>): Record<string, unknown>[] {
  const data = payload?.data as unknown;
  if (!data) return [];
  if (Array.isArray(data)) return data.filter(Boolean);
  if (typeof data !== "object") return [];
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.messages)) return obj.messages.filter(Boolean) as Record<string, unknown>[];
  if (obj.key || obj.message) return [obj];
  return [];
}

export function parseIncomingMessage(item: Record<string, unknown>): IncomingWhatsApp | null {
  const remoteJid = resolveRemoteJid(item);
  if (!remoteJid || isIgnorableJid(remoteJid)) return null;

  const key = (item.key || {}) as Record<string, unknown>;
  const rawMessage = (item.message || {}) as Record<string, unknown>;
  const message = unwrapMessage(rawMessage);
  const text = extractText(rawMessage);
  const messageType: IncomingWhatsApp["messageType"] =
    text != null && !message.audioMessage && !message.imageMessage
      ? "text"
      : message.audioMessage
        ? "audio"
        : message.imageMessage
          ? "image"
          : "text";

  return {
    remoteJid,
    phone: jidToPhone(remoteJid),
    providerId: typeof key.id === "string" ? key.id : undefined,
    fromMe: key.fromMe === true,
    pushName: typeof item.pushName === "string" ? item.pushName : undefined,
    avatarUrl: typeof item.profilePictureUrl === "string" ? item.profilePictureUrl : undefined,
    message,
    text,
    messageType,
  };
}

export function isAckOnlyEvent(eventName: string, payload: Record<string, unknown>): boolean {
  const isUpdate =
    eventName === "messages.update" ||
    eventName === "messages.ack" ||
    eventName === "messages_update" ||
    eventName.endsWith("messages.update");
  if (!isUpdate) return false;
  const items = collectWebhookMessages(payload);
  return items.every((item) => !item.message);
}
