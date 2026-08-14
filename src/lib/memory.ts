/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 * 
 * Serviço de Memória de Leads da Sulma
 * Armazena preferências, interesses, objeções e contexto das conversas
 */

import { prisma } from "@/lib/prisma";

export interface LeadMemoryItem {
  id: string;
  leadId: string;
  type: string;
  key: string;
  value: string;
  createdAt: Date;
  updatedAt: Date;
}

// Tipos de memória
export const MEMORY_TYPES = {
  PREFERENCE: "preference",     // Preferências do lead (pagamento, plano, etc)
  INTEREST: "interest",         // Interesses demonstrados
  OBJECTION: "objection",       // Objeções levantadas
  CONTEXT: "context",           // Contexto da conversa
  SUMMARY: "summary",           // Resumo da conversa
  PERSONAL: "personal",         // Dados pessoais coletados
} as const;

// Chaves de memória comuns
export const MEMORY_KEYS = {
  PLANO_INTERESSE: "plano_interesse",
  PLANO_RECOMENDADO: "plano_recomendado",
  OBJECAO_PRECO: "objecao_preco",
  OBJECAO_CARENCIA: "objecao_carencia",
  PREFERENCIA_PAGAMENTO: "preferencia_pagamento",
  TEM_DEPENDENTES: "tem_dependentes",
  QTD_DEPENDENTES: "qtd_dependentes",
  TEM_IDOSO_60: "tem_idoso_60",
  FOCO_ATENDIMENTO: "foco_atendimento",
  ULTIMO_RESUMO: "ultimo_resumo",
  PROXIMO_PASSO: "proximo_passo",
  NOME_INFORMADO: "nome_informado",
} as const;

/**
 * Salva ou atualiza uma memória do lead
 */
export async function saveMemory(
  leadId: string,
  type: string,
  key: string,
  value: string
): Promise<LeadMemoryItem> {
  return prisma.leadMemory.upsert({
    where: {
      leadId_key: { leadId, key },
    },
    update: { value, type },
    create: { leadId, type, key, value },
  });
}

/**
 * Busca uma memória específica do lead
 */
export async function getMemory(
  leadId: string,
  key: string
): Promise<string | null> {
  const memory = await prisma.leadMemory.findUnique({
    where: {
      leadId_key: { leadId, key },
    },
  });
  return memory?.value ?? null;
}

/**
 * Busca todas as memórias de um lead
 */
export async function getAllMemories(
  leadId: string,
  type?: string
): Promise<LeadMemoryItem[]> {
  return prisma.leadMemory.findMany({
    where: {
      leadId,
      ...(type && { type }),
    },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Remove uma memória específica
 */
export async function deleteMemory(leadId: string, key: string): Promise<void> {
  await prisma.leadMemory.delete({
    where: {
      leadId_key: { leadId, key },
    },
  }).catch(() => {});
}

/**
 * Remove todas as memórias de um lead
 */
export async function clearAllMemories(leadId: string): Promise<void> {
  await prisma.leadMemory.deleteMany({
    where: { leadId },
  });
}

/**
 * Formata memórias para contexto da IA
 */
export function formatMemoriesForAI(memories: LeadMemoryItem[]): string {
  if (memories.length === 0) {
    return "";
  }

  const grouped = memories.reduce(
    (acc, item) => {
      if (!acc[item.type]) {
        acc[item.type] = [];
      }
      acc[item.type].push(item);
      return acc;
    },
    {} as Record<string, LeadMemoryItem[]>
  );

  let result = "<LeadMemory>\n";

  const typeLabels: Record<string, string> = {
    preference: "Preferências",
    interest: "Interesses",
    objection: "Objeções",
    context: "Contexto",
    summary: "Resumo",
    personal: "Dados Pessoais",
  };

  for (const [type, items] of Object.entries(grouped)) {
    const label = typeLabels[type] || type;
    result += `\n## ${label}\n`;
    for (const item of items) {
      result += `- ${item.key}: ${item.value}\n`;
    }
  }

  result += "\n</LeadMemory>";

  return result;
}

// Palavras que não são nomes (evita extrair "Sulma", "plano", "quanto custa", etc.)
const NOT_NAME_WORDS = new Set([
  "vi", "sulma", "sim", "não", "nao", "oi", "ola", "ok", "então", "entao", "quanto", "custa", "qual", "valor",
  "preço", "preco", "plano", "planos", "me", "explica", "explicar", "como", "funciona", "quero",
  "saber", "mais", "pode", "gostaria", "tenho", "interesse", "informação", "informacao", "por", "favor",
]);

/**
 * Detecta se a mensagem contém um nome informado pelo cliente (resposta à pergunta "como posso te chamar?").
 * Retorna o nome se detectado, null caso contrário. Não extrai frases que claramente não são nome.
 */
export function extractNameFromMessage(message: string, previousBotAskedName: boolean): string | null {
  if (!previousBotAskedName) return null;

  const trimmed = message.trim();
  if (trimmed.length > 40) return null; // Resposta longa não é só um nome

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length > 3 || words.length === 0) return null;

  const hasNumbers = /\d/.test(trimmed);
  const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(trimmed);
  if (hasNumbers || hasSpecialChars) return null;

  // Se alguma palavra é claramente não-nome, não considera como nome
  const lowerWords = words.map((w) => w.toLowerCase());
  if (lowerWords.some((w) => NOT_NAME_WORDS.has(w))) return null;

  // Só aceita padrões explícitos de "me chamo X", "sou o X", etc. (sem fallback que pega qualquer coisa)
  const namePatterns = [
    /^(?:me\s+chamo|meu\s+nome\s+(?:é|e)|sou\s+(?:o|a))\s+([A-ZÀ-Úa-zà-ú]+(?:\s+[A-ZÀ-Úa-zà-ú]+)?)$/i,
    /^(?:pode\s+(?:me\s+)?chamar\s+(?:de\s+)?|chamo-me\s+)([A-ZÀ-Úa-zà-ú]+(?:\s+[A-ZÀ-Úa-zà-ú]+)?)$/i,
    /^([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)?)$/, // Só 1 ou 2 palavras capitalizadas (ex: "Sandro", "Maria Silva")
  ];

  for (const pattern of namePatterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      if (name.length < 2) return null;
      if (NOT_NAME_WORDS.has(name.toLowerCase())) return null;
      return name
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
    }
  }

  return null;
}

/**
 * Extrai e salva memórias automaticamente da conversa
 * Retorna o nome extraído se detectado
 */
export async function extractAndSaveMemories(
  leadId: string,
  message: string,
  isFromLead: boolean,
  previousBotAskedName: boolean = false
): Promise<{ extractedName?: string }> {
  if (!isFromLead) return {};

  const lowerMessage = message.toLowerCase();
  let extractedName: string | undefined;
  
  // Detecta nome informado
  const name = extractNameFromMessage(message, previousBotAskedName);
  if (name) {
    await saveMemory(leadId, MEMORY_TYPES.PERSONAL, MEMORY_KEYS.NOME_INFORMADO, name);
    extractedName = name;
  }

  // Detecta interesse em planos (Amo Vidas)
  if (
    lowerMessage.includes("plano") ||
    lowerMessage.includes("rotina") ||
    lowerMessage.includes("especializado") ||
    lowerMessage.includes("cobertura total")
  ) {
    if (lowerMessage.includes("rotina") || lowerMessage.includes("básico") || lowerMessage.includes("basico")) {
      await saveMemory(leadId, MEMORY_TYPES.INTEREST, MEMORY_KEYS.PLANO_INTERESSE, "Plano Rotina - R$ 37,90/mês");
    } else if (lowerMessage.includes("especializado")) {
      await saveMemory(leadId, MEMORY_TYPES.INTEREST, MEMORY_KEYS.PLANO_INTERESSE, "Plano Especializado - R$ 57,90/mês");
    } else if (lowerMessage.includes("cobertura total") || lowerMessage.includes("completo")) {
      await saveMemory(leadId, MEMORY_TYPES.INTEREST, MEMORY_KEYS.PLANO_INTERESSE, "Plano Cobertura Total - R$ 97,00/mês");
    }
  }

  // Detecta dependentes
  if (lowerMessage.includes("dependente") || lowerMessage.includes("família") || lowerMessage.includes("filhos")) {
    await saveMemory(leadId, MEMORY_TYPES.CONTEXT, MEMORY_KEYS.TEM_DEPENDENTES, "sim");
  }

  // Detecta idoso 60+
  if (lowerMessage.includes("60") || lowerMessage.includes("idoso") || lowerMessage.includes("terceira idade")) {
    await saveMemory(leadId, MEMORY_TYPES.CONTEXT, MEMORY_KEYS.TEM_IDOSO_60, "sim");
  }

  // Detecta objeção de preço
  if (lowerMessage.includes("caro") || lowerMessage.includes("preço") || lowerMessage.includes("desconto")) {
    await saveMemory(leadId, MEMORY_TYPES.OBJECTION, MEMORY_KEYS.OBJECAO_PRECO, "Lead mencionou preço/desconto");
  }

  // Detecta preferência de pagamento
  if (lowerMessage.includes("pix")) {
    await saveMemory(leadId, MEMORY_TYPES.PREFERENCE, MEMORY_KEYS.PREFERENCIA_PAGAMENTO, "Pix");
  } else if (lowerMessage.includes("cartão") || lowerMessage.includes("credito")) {
    await saveMemory(leadId, MEMORY_TYPES.PREFERENCE, MEMORY_KEYS.PREFERENCIA_PAGAMENTO, "Cartão de crédito");
  }

  // Detecta foco de atendimento
  if (lowerMessage.includes("rotina") || lowerMessage.includes("prevenção")) {
    await saveMemory(leadId, MEMORY_TYPES.CONTEXT, MEMORY_KEYS.FOCO_ATENDIMENTO, "Rotina e prevenção");
  } else if (lowerMessage.includes("exame") || lowerMessage.includes("check-up")) {
    await saveMemory(leadId, MEMORY_TYPES.CONTEXT, MEMORY_KEYS.FOCO_ATENDIMENTO, "Exames e check-ups");
  }

  return { extractedName };
}
