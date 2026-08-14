/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

import { prisma } from "@/lib/prisma";

export interface OrganizationSettings {
  evolutionBaseUrl?: string;
  evolutionToken?: string;
  openaiApiKey?: string;
  asaasWebhookUrl?: string;
  [key: string]: string | undefined;
}

/**
 * Busca as configurações da organização no banco de dados
 */
export async function getOrganizationSettings(
  organizationId: string
): Promise<OrganizationSettings> {
  const settings = await prisma.orgSettings.findMany({
    where: { organizationId },
  });

  const result: OrganizationSettings = {};

  for (const setting of settings) {
    result[setting.key] = setting.value;
  }

  return result;
}

/**
 * Salva uma configuração da organização
 */
export async function setOrganizationSetting(
  organizationId: string,
  key: string,
  value: string,
  encrypted = false
): Promise<void> {
  await prisma.orgSettings.upsert({
    where: {
      organizationId_key: {
        organizationId,
        key,
      },
    },
    update: {
      value,
      encrypted,
    },
    create: {
      organizationId,
      key,
      value,
      encrypted,
    },
  });
}
