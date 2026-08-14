/**
 * Credenciais da Evolution API.
 * URL e token globais vêm das Configurações.
 * O nome da instância WhatsApp vem SOMENTE do painel (tabela Instance),
 * nunca do .env (EVOLUTION_INSTANCE / AmoVidas).
 */

import { getSystemSettings } from "@/lib/settings";
import { getOrganizationSettings } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import type { Instance } from "@prisma/client";

export type EvolutionCredentials = {
  baseUrl: string;
  token: string;
  defaultInstance: string;
};

export function evolutionApiRoot(baseUrl: string): string {
  return baseUrl.replace(/\/api\/?$/, "").replace(/\/$/, "");
}

export async function resolvePanelInstance(
  organizationId?: string | null
): Promise<Instance | null> {
  const orgFilter = organizationId ? { organizationId } : {};

  return (
    (await prisma.instance.findFirst({
      where: { ...orgFilter, isDefault: true, status: "CONNECTED" },
    })) ||
    (await prisma.instance.findFirst({
      where: { ...orgFilter, status: "CONNECTED" },
      orderBy: { updatedAt: "desc" },
    })) ||
    (await prisma.instance.findFirst({
      where: { ...orgFilter, isDefault: true },
    })) ||
    (await prisma.instance.findFirst({
      where: orgFilter,
      orderBy: { createdAt: "asc" },
    }))
  );
}

export async function getInstanceForConversation(
  instanceId?: string | null,
  organizationId?: string | null
): Promise<Instance | null> {
  if (instanceId) {
    const inst = await prisma.instance.findUnique({ where: { id: instanceId } });
    if (inst) return inst;
  }
  return resolvePanelInstance(organizationId);
}

export async function getEvolutionCredentials(
  organizationId?: string | null,
  instanceToken?: string | null
): Promise<EvolutionCredentials> {
  const settings = await getSystemSettings();
  const org = organizationId
    ? await getOrganizationSettings(organizationId)
    : {};

  const panel = await resolvePanelInstance(organizationId);

  const baseUrl =
    org.evolutionBaseUrl ||
    settings.evolutionBaseUrl ||
    process.env.EVOLUTION_BASE_URL ||
    "";

  const token =
    instanceToken ||
    panel?.token ||
    org.evolutionToken ||
    settings.evolutionToken ||
    process.env.EVOLUTION_TOKEN ||
    "";

  return {
    baseUrl,
    token,
    defaultInstance: panel?.instanceName || "",
  };
}
