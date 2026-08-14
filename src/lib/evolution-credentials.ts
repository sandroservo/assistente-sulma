/**
 * Credenciais da Evolution API (global Settings → env).
 */

import { getSystemSettings } from "@/lib/settings";
import { getOrganizationSettings } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export type EvolutionCredentials = {
  baseUrl: string;
  token: string;
  defaultInstance: string;
};

export function evolutionApiRoot(baseUrl: string): string {
  return baseUrl.replace(/\/api\/?$/, "").replace(/\/$/, "");
}

export async function getEvolutionCredentials(
  organizationId?: string | null,
  instanceToken?: string | null
): Promise<EvolutionCredentials> {
  const settings = await getSystemSettings();
  const org = organizationId
    ? await getOrganizationSettings(organizationId)
    : {};

  const baseUrl =
    org.evolutionBaseUrl ||
    settings.evolutionBaseUrl ||
    process.env.EVOLUTION_BASE_URL ||
    "";
  const token =
    instanceToken ||
    org.evolutionToken ||
    settings.evolutionToken ||
    process.env.EVOLUTION_TOKEN ||
    "";

  const connected = await prisma.instance.findFirst({
    where: {
      status: "CONNECTED",
      ...(organizationId ? { organizationId } : {}),
    },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });

  const defaultInstance =
    connected?.instanceName ||
    settings.evolutionInstance ||
    process.env.EVOLUTION_INSTANCE ||
    "";

  return { baseUrl, token, defaultInstance };
}
