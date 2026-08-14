/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Sistema de Lead Score (0–1.000) — Amo Vidas
 * Baseado no documento Ficha do Lead Ideal.
 *
 * Categorias:
 *  1. Perfil Demográfico        — até 100 pts
 *  2. Dor / Necessidade Real    — até 200 pts
 *  3. Consciência do Produto    — até 300 pts (mais importante)
 *  4. Comportamento na Conversa — até 200 pts
 *  5. Intenção de Decisão       — até 200 pts
 *
 * O score é acumulativo e dinâmico — sobe e desce conforme respostas.
 */

import { prisma } from "./prisma";

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface ScoreBreakdown {
  perfil: number;
  necessidade: number;
  consciencia: number;
  comportamento: number;
  decisao: number;
  total: number;
}

interface ScoreRule {
  keywords: string[];
  points: number;
  /** true = só verifica na msg atual; false/undefined = verifica no combinado */
  currentOnly?: boolean;
}

// ─── Regras de Score ────────────────────────────────────────────────────────

// 1. Perfil Demográfico (100 pts)
const PERFIL_RULES: ScoreRule[] = [
  // Menção a dependentes / família → +40
  { keywords: ["dependente", "dependentes", "minha esposa", "meu marido", "meu filho", "minha filha", "minha família", "minha familia", "pros filhos", "pra família", "pra familia"], points: 40 },
  // Menção a idosos → +20
  { keywords: ["minha mãe", "minha mae", "meu pai", "60 anos", "idoso", "idosa", "terceira idade", "avó", "avô", "avo"], points: 20 },
];

// 2. Dor / Necessidade Real (200 pts)
const NECESSIDADE_RULES: ScoreRule[] = [
  { keywords: ["quero fazer check-up", "quero fazer checkup", "preciso de check-up", "preciso de checkup"], points: 100 },
  { keywords: ["cuidar melhor da saúde", "cuidar melhor da saude", "cuidar da saúde", "cuidar da saude", "quero me cuidar"], points: 80 },
  { keywords: ["histórico familiar", "historico familiar", "histórico na família", "historico na familia", "caso na família", "caso na familia"], points: 80 },
  { keywords: ["faz tempo que não faço exame", "faz tempo que nao faco exame", "nunca fiz exame", "nunca fiz check", "tempo sem exame", "muito tempo sem ir ao médico", "muito tempo sem ir ao medico"], points: 70 },
  { keywords: ["medo de doença", "medo de doenca", "doença silenciosa", "doenca silenciosa", "preocupado com", "preocupada com"], points: 40 },
  { keywords: ["sentindo algo", "sintoma", "sintomas"], points: 30 },
  // Sinal negativo
  { keywords: ["só quero consulta barata", "so quero consulta barata", "só quero uma consulta", "so quero uma consulta"], points: -50, currentOnly: true },
];

// 3. Consciência do Produto (300 pts) — mais importante
const CONSCIENCIA_RULES: ScoreRule[] = [
  // Entende que NÃO é plano de saúde
  { keywords: ["não é plano de saúde", "nao e plano de saude", "entendi que não é plano", "entendi que nao e plano", "clube de benefício", "clube de beneficio", "clube de saúde", "clube de saude"], points: 120 },
  // Confunde mas aceita explicação
  { keywords: ["entendi", "ah entendi", "agora entendi", "faz sentido", "compreendi"], points: 60 },
  // Fala em prevenção / cuidado contínuo
  { keywords: ["prevenção", "prevencao", "prevenir", "preventivo", "cuidado contínuo", "cuidado continuo", "me cuidar sempre"], points: 80 },
  // Entende acesso facilitado
  { keywords: ["acesso facilitado", "valores reduzidos", "mais acessível", "mais acessivel", "mais barato que particular", "economizar"], points: 60 },
  // Clareza de uso
  { keywords: ["como funciona depois de assinar", "depois que assina", "como uso", "como agenda", "como agendar", "como marca consulta", "como marcar consulta"], points: 40 },
  { keywords: ["agendamento", "agendar exame", "marcar exame"], points: 40 },
];

// 4. Comportamento na Conversa (200 pts) — calculado por lógica, não só keywords
const COMPORTAMENTO_RULES: ScoreRule[] = [
  // Faz perguntas completas → detectado por "?" no histórico
  // Calculado de forma dinâmica em calculateBehaviorScore()
];

// 5. Intenção de Decisão (200 pts)
const DECISAO_RULES: ScoreRule[] = [
  // Pré-fechamento
  { keywords: ["quero assinar", "quero contratar", "pode mandar o link", "manda o link", "como assino", "como contrato", "quero esse plano"], points: 120, currentOnly: true },
  // Sinais fortes
  { keywords: ["quanto custa", "qual o valor", "qual o preço", "qual o preco", "qual valor", "quais são os planos", "quais sao os planos", "quais os planos"], points: 60 },
  { keywords: ["como pago", "formas de pagamento", "aceita pix", "aceita cartão", "aceita cartao"], points: 50 },
  { keywords: ["posso incluir dependente", "incluir minha esposa", "incluir meu marido", "incluir meu filho", "incluir minha filha"], points: 50 },
  // Esfriamento
  { keywords: ["vou pensar", "preciso pensar"], points: -60, currentOnly: true },
  { keywords: ["não agora", "nao agora", "mais tarde", "outro dia", "depois eu vejo"], points: -80, currentOnly: true },
];

// ─── Funções de Cálculo ─────────────────────────────────────────────────────

function matchRules(rules: ScoreRule[], currentMsg: string, combinedHistory: string): number {
  let score = 0;
  const matched = new Set<number>();

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    const textToSearch = rule.currentOnly ? currentMsg : combinedHistory;

    if (rule.keywords.some((kw) => textToSearch.includes(kw))) {
      if (!matched.has(i)) {
        score += rule.points;
        matched.add(i);
      }
    }
  }

  return score;
}

/**
 * Calcula score de comportamento baseado em padrões da conversa.
 * - Perguntas completas (contêm "?") → +50
 * - Respostas médias (>10 palavras) → +30
 * - Monossilábicas ("sim", "não", "ok") → -30
 * - Mantém conversa ativa (3+ mensagens do lead) → +40
 * - Some após preço → -40
 */
function calculateBehaviorScore(
  messages: { direction: string; body: string | null }[],
  currentMsg: string
): number {
  let score = 0;

  const leadMessages = messages.filter((m) => m.direction === "in" && m.body);
  const leadCount = leadMessages.length;

  // Qualidade das respostas do lead
  const questionsCount = leadMessages.filter((m) => m.body!.includes("?")).length;
  if (questionsCount >= 2) score += 50; // Faz perguntas completas
  else if (questionsCount >= 1) score += 30; // Respostas médias

  // Monossilábicas
  const monoCount = leadMessages.filter((m) => {
    const words = m.body!.trim().split(/\s+/);
    return words.length <= 2;
  }).length;
  const monoRatio = leadCount > 0 ? monoCount / leadCount : 0;
  if (monoRatio > 0.6 && leadCount >= 3) score -= 30;

  // Continuidade — mantém conversa ativa
  if (leadCount >= 5) score += 40;
  else if (leadCount >= 3) score += 20;

  // Some após preço (último bot falou de preço, lead não respondeu mais ou respondeu curto)
  const lastBotMsg = messages
    .filter((m) => m.direction === "out" && m.body)
    .pop()?.body?.toLowerCase() || "";

  const priceKeywords = ["r$", "37,90", "57,90", "97,00", "valor", "preço", "preco"];
  const botMentionedPrice = priceKeywords.some((k) => lastBotMsg.includes(k));
  const currentWords = currentMsg.trim().split(/\s+/).length;

  if (botMentionedPrice && currentWords <= 2) {
    score -= 40; // Some após preço
  }

  return Math.max(-200, Math.min(200, score));
}

/**
 * Calcula o Lead Score completo (0–1.000) baseado no histórico de conversa.
 */
export function calculateLeadScore(
  messages: { direction: string; body: string | null }[],
  currentMessage: string
): ScoreBreakdown {
  const msg = currentMessage.toLowerCase();
  const allText = messages
    .filter((m) => m.body)
    .map((m) => m.body!.toLowerCase())
    .join(" ");
  const combined = `${allText} ${msg}`;

  const perfil = Math.max(0, Math.min(100, matchRules(PERFIL_RULES, msg, combined)));
  const necessidade = Math.max(-50, Math.min(200, matchRules(NECESSIDADE_RULES, msg, combined)));
  const consciencia = Math.max(0, Math.min(300, matchRules(CONSCIENCIA_RULES, msg, combined)));
  const comportamento = calculateBehaviorScore(messages, msg);
  const decisao = Math.max(-200, Math.min(200, matchRules(DECISAO_RULES, msg, combined)));

  const raw = perfil + Math.max(0, necessidade) + consciencia + Math.max(0, comportamento) + Math.max(0, decisao);
  const penalties = Math.min(0, necessidade) + Math.min(0, comportamento) + Math.min(0, decisao);
  const total = Math.max(0, Math.min(1000, raw + penalties));

  return {
    perfil,
    necessidade: Math.max(0, necessidade),
    consciencia,
    comportamento: Math.max(0, comportamento),
    decisao: Math.max(0, decisao),
    total,
  };
}

/**
 * Retorna o status do Kanban sugerido com base no score.
 * Mapeamento conforme documento Ficha do Lead Ideal:
 *  0–199   → EM_ATENDIMENTO
 *  200–399 → CONSCIENTIZADO
 *  400–599 → QUALIFICADO
 *  600–799 → EM_NEGOCIACAO
 *  800+    → HUMANO_SOLICITADO (handoff)
 */
export function getStatusFromScore(score: number): string {
  if (score >= 800) return "HUMANO_SOLICITADO";
  if (score >= 600) return "EM_NEGOCIACAO";
  if (score >= 400) return "QUALIFICADO";
  if (score >= 200) return "CONSCIENTIZADO";
  return "EM_ATENDIMENTO";
}

/**
 * Retorna a classificação textual do score.
 */
export function getScoreClassification(score: number): string {
  if (score >= 800) return "Muito quente";
  if (score >= 600) return "Quente";
  if (score >= 400) return "Morno";
  if (score >= 200) return "Frio";
  return "Muito frio";
}

/**
 * Calcula e persiste o lead score no banco.
 */
export async function updateLeadScore(
  leadId: string,
  messages: { direction: string; body: string | null }[],
  currentMessage: string
): Promise<ScoreBreakdown> {
  const breakdown = calculateLeadScore(messages, currentMessage);

  await prisma.lead.update({
    where: { id: leadId },
    data: { leadScore: breakdown.total },
  });

  return breakdown;
}
