/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 * 
 * Serviço de Base de Conhecimento da Sulma
 * Similar às Tools do n8n - fonte de verdade para planos, regras, links, etc.
 */

import { prisma } from "@/lib/prisma";

export interface KnowledgeItem {
  id: string;
  organizationId: string;
  category: string;
  title: string;
  content: string;
  keywords: string | null;
  priority: number;
  active: boolean;
}

// Categorias padrão
export const KNOWLEDGE_CATEGORIES = [
  "planos",
  "regras",
  "links",
  "check-ups",
  "pagamento",
  "carencia",
  "atendimento",
  "faq",
] as const;

export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

/**
 * Busca conhecimentos relevantes baseado em palavras-chave
 */
export async function searchKnowledge(
  query: string,
  category?: string,
  limit: number = 5,
  organizationId?: string
): Promise<KnowledgeItem[]> {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  if (words.length === 0) {
    return getAllKnowledge(category, limit, organizationId);
  }

  // Busca por palavras-chave no título, conteúdo e keywords (da organização)
  const knowledge = await prisma.knowledge.findMany({
    where: {
      active: true,
      ...(organizationId && { organizationId }),
      ...(category && { category }),
      OR: words.flatMap((word) => [
        { title: { contains: word, mode: "insensitive" } },
        { content: { contains: word, mode: "insensitive" } },
        { keywords: { contains: word, mode: "insensitive" } },
      ]),
    },
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
    take: limit,
  });

  return knowledge;
}

/**
 * Busca todos os conhecimentos de uma categoria (opcionalmente da organização)
 */
export async function getAllKnowledge(
  category?: string,
  limit: number = 20,
  organizationId?: string
): Promise<KnowledgeItem[]> {
  return prisma.knowledge.findMany({
    where: {
      active: true,
      ...(organizationId && { organizationId }),
      ...(category && { category }),
    },
    orderBy: [{ priority: "desc" }, { category: "asc" }, { title: "asc" }],
    take: limit,
  });
}

/**
 * Busca conhecimento por ID
 */
export async function getKnowledgeById(
  id: string
): Promise<KnowledgeItem | null> {
  return prisma.knowledge.findUnique({
    where: { id },
  });
}

/**
 * Cria um novo conhecimento
 */
export async function createKnowledge(data: {
  organizationId: string;
  category: string;
  title: string;
  content: string;
  keywords?: string;
  priority?: number;
}): Promise<KnowledgeItem> {
  return prisma.knowledge.create({
    data: {
      organizationId: data.organizationId,
      category: data.category,
      title: data.title,
      content: data.content,
      keywords: data.keywords,
      priority: data.priority ?? 0,
    },
  });
}

/**
 * Atualiza um conhecimento
 */
export async function updateKnowledge(
  id: string,
  data: Partial<{
    category: string;
    title: string;
    content: string;
    keywords: string;
    priority: number;
    active: boolean;
  }>
): Promise<KnowledgeItem> {
  return prisma.knowledge.update({
    where: { id },
    data,
  });
}

/**
 * Remove um conhecimento
 */
export async function deleteKnowledge(id: string): Promise<void> {
  await prisma.knowledge.delete({
    where: { id },
  });
}

/**
 * Formata conhecimentos para contexto da IA (Tool Information)
 */
export function formatKnowledgeForAI(knowledge: KnowledgeItem[]): string {
  if (knowledge.length === 0) {
    return "";
  }

  const grouped = knowledge.reduce(
    (acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    },
    {} as Record<string, KnowledgeItem[]>
  );

  let result = "<Tool Information>\n";

  for (const [category, items] of Object.entries(grouped)) {
    result += `\n## ${category.toUpperCase()}\n`;
    for (const item of items) {
      result += `\n### ${item.title}\n${item.content}\n`;
    }
  }

  result += "\n</Tool Information>";

  return result;
}
