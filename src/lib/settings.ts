/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 * 
 * Serviço para gerenciar configurações do sistema
 */

import { prisma } from "@/lib/prisma";

export interface SystemSettings {
  evolutionBaseUrl: string;
  evolutionInstance: string;
  evolutionToken: string;
  webhookSecret: string;
  openaiApiKey: string;
  openaiModel: string;
  systemPrompt: string;
  asaasWebhookUrl: string;
  n8nTranscribeWebhook: string;
  appUrl: string;
}

const SETTINGS_KEYS = {
  EVOLUTION_BASE_URL: "evolution_base_url",
  EVOLUTION_INSTANCE: "evolution_instance",
  EVOLUTION_TOKEN: "evolution_token",
  WEBHOOK_SECRET: "webhook_secret",
  OPENAI_API_KEY: "openai_api_key",
  OPENAI_MODEL: "openai_model",
  SYSTEM_PROMPT: "system_prompt",
  ASAAS_WEBHOOK_URL: "asaas_webhook_url",
  N8N_TRANSCRIBE_WEBHOOK: "n8n_transcribe_webhook",
  APP_URL: "app_url",
};

export async function getSetting(key: string): Promise<string | null> {
  const setting = await prisma.settings.findUnique({
    where: { key },
  });
  return setting?.value ?? null;
}

export async function setSetting(
  key: string,
  value: string,
  encrypted: boolean = false
): Promise<void> {
  await prisma.settings.upsert({
    where: { key },
    update: { value, encrypted },
    create: { id: key, key, value, encrypted },
  });
}

export async function getSystemSettings(): Promise<SystemSettings> {
  const settings = await prisma.settings.findMany();
  const map = new Map(settings.map((s) => [s.key, s.value]));

  return {
    evolutionBaseUrl:
      map.get(SETTINGS_KEYS.EVOLUTION_BASE_URL) ||
      process.env.EVOLUTION_BASE_URL ||
      "",
    evolutionInstance:
      map.get(SETTINGS_KEYS.EVOLUTION_INSTANCE) ||
      process.env.EVOLUTION_INSTANCE ||
      "",
    evolutionToken:
      map.get(SETTINGS_KEYS.EVOLUTION_TOKEN) ||
      process.env.EVOLUTION_TOKEN ||
      "",
    webhookSecret:
      map.get(SETTINGS_KEYS.WEBHOOK_SECRET) ||
      process.env.WEBHOOK_SECRET ||
      "",
    openaiApiKey:
      map.get(SETTINGS_KEYS.OPENAI_API_KEY) ||
      process.env.OPENAI_API_KEY ||
      "",
    openaiModel:
      map.get(SETTINGS_KEYS.OPENAI_MODEL) ||
      "gpt-4o-mini",
    systemPrompt:
      map.get(SETTINGS_KEYS.SYSTEM_PROMPT) ||
      "",
    asaasWebhookUrl:
      map.get(SETTINGS_KEYS.ASAAS_WEBHOOK_URL) ||
      "",
    n8nTranscribeWebhook:
      map.get(SETTINGS_KEYS.N8N_TRANSCRIBE_WEBHOOK) ||
      process.env.N8N_TRANSCRIBE_WEBHOOK ||
      "",
    appUrl:
      map.get(SETTINGS_KEYS.APP_URL) ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "",
  };
}

export async function saveSystemSettings(
  settings: Partial<SystemSettings>
): Promise<void> {
  const updates: { key: string; value: string; encrypted: boolean }[] = [];

  if (settings.evolutionBaseUrl !== undefined) {
    updates.push({
      key: SETTINGS_KEYS.EVOLUTION_BASE_URL,
      value: settings.evolutionBaseUrl,
      encrypted: false,
    });
  }
  if (settings.evolutionInstance !== undefined) {
    updates.push({
      key: SETTINGS_KEYS.EVOLUTION_INSTANCE,
      value: settings.evolutionInstance,
      encrypted: false,
    });
  }
  if (settings.evolutionToken !== undefined) {
    updates.push({
      key: SETTINGS_KEYS.EVOLUTION_TOKEN,
      value: settings.evolutionToken,
      encrypted: true,
    });
  }
  if (settings.webhookSecret !== undefined) {
    updates.push({
      key: SETTINGS_KEYS.WEBHOOK_SECRET,
      value: settings.webhookSecret,
      encrypted: true,
    });
  }
  if (settings.openaiApiKey !== undefined) {
    updates.push({
      key: SETTINGS_KEYS.OPENAI_API_KEY,
      value: settings.openaiApiKey,
      encrypted: true,
    });
  }
  if (settings.openaiModel !== undefined) {
    updates.push({
      key: SETTINGS_KEYS.OPENAI_MODEL,
      value: settings.openaiModel,
      encrypted: false,
    });
  }
  if (settings.systemPrompt !== undefined) {
    updates.push({
      key: SETTINGS_KEYS.SYSTEM_PROMPT,
      value: settings.systemPrompt,
      encrypted: false,
    });
  }
  if (settings.asaasWebhookUrl !== undefined) {
    updates.push({
      key: SETTINGS_KEYS.ASAAS_WEBHOOK_URL,
      value: settings.asaasWebhookUrl,
      encrypted: false,
    });
  }
  if (settings.n8nTranscribeWebhook !== undefined) {
    updates.push({
      key: SETTINGS_KEYS.N8N_TRANSCRIBE_WEBHOOK,
      value: settings.n8nTranscribeWebhook,
      encrypted: false,
    });
  }
  if (settings.appUrl !== undefined) {
    updates.push({
      key: SETTINGS_KEYS.APP_URL,
      value: settings.appUrl,
      encrypted: false,
    });
  }

  for (const { key, value, encrypted } of updates) {
    await setSetting(key, value, encrypted);
  }
}

export { SETTINGS_KEYS };
