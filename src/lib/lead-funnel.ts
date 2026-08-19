/**
 * Funil do Kanban Sulma / Unisulma.
 * Novo → Entender → Orientar → Qualificar → Registrar → Conduzir para matrícula
 */

export const FUNNEL_STATUSES = [
  "NOVO",
  "ENTENDER",
  "ORIENTAR",
  "QUALIFICAR",
  "REGISTRAR",
  "CONDUZIR_MATRICULA",
] as const;

export type FunnelStatus = (typeof FUNNEL_STATUSES)[number];

export const OPERATIONAL_STATUSES = [
  "LEAD_FRIO",
  "AGUARDANDO_RESPOSTA",
  "PERDIDO",
  "HUMANO_SOLICITADO",
  "HUMANO_EM_ATENDIMENTO",
] as const;

const LEGACY_STATUS_MAP: Record<string, string> = {
  EM_ATENDIMENTO: "ENTENDER",
  CONSCIENTIZADO: "ORIENTAR",
  QUALIFICADO: "QUALIFICAR",
  EM_NEGOCIACAO: "REGISTRAR",
  PROPOSTA_ENVIADA: "REGISTRAR",
  FECHADO: "CONDUZIR_MATRICULA",
};

export const LEAD_STATUS_LABELS: Record<string, string> = {
  NOVO: "Novo",
  ENTENDER: "Entender",
  ORIENTAR: "Orientar",
  QUALIFICAR: "Qualificar",
  REGISTRAR: "Registrar",
  CONDUZIR_MATRICULA: "Conduzir para matrícula",
  LEAD_FRIO: "Lead frio",
  AGUARDANDO_RESPOSTA: "Aguardando resposta",
  PERDIDO: "Perdido",
  HUMANO_SOLICITADO: "Aguardando humano",
  HUMANO_EM_ATENDIMENTO: "Humano atendendo",
  EM_ATENDIMENTO: "Entender",
  CONSCIENTIZADO: "Orientar",
  QUALIFICADO: "Qualificar",
  EM_NEGOCIACAO: "Registrar",
  PROPOSTA_ENVIADA: "Registrar",
  FECHADO: "Conduzir para matrícula",
};

export const KANBAN_COLUMNS = [
  {
    id: "NOVO",
    title: "Novo",
    hint: "Primeiro contato",
    bgColor: "bg-[#EEF2FF]",
    headerBg: "bg-[#E8EDF8]",
    borderColor: "border-[#C5D0E8]",
    badgeColor: "bg-[#001A5E]",
  },
  {
    id: "ENTENDER",
    title: "Entender",
    hint: "Descobrir a necessidade",
    bgColor: "bg-sky-50",
    headerBg: "bg-sky-100",
    borderColor: "border-sky-200",
    badgeColor: "bg-sky-600",
  },
  {
    id: "ORIENTAR",
    title: "Orientar",
    hint: "Cursos, campus e processo",
    bgColor: "bg-teal-50",
    headerBg: "bg-teal-100",
    borderColor: "border-teal-200",
    badgeColor: "bg-teal-600",
  },
  {
    id: "QUALIFICAR",
    title: "Qualificar",
    hint: "Curso, prazo e perfil",
    bgColor: "bg-amber-50",
    headerBg: "bg-amber-100",
    borderColor: "border-amber-200",
    badgeColor: "bg-[#C9A227]",
  },
  {
    id: "REGISTRAR",
    title: "Registrar",
    hint: "Inscrição e documentos",
    bgColor: "bg-indigo-50",
    headerBg: "bg-indigo-100",
    borderColor: "border-indigo-200",
    badgeColor: "bg-indigo-600",
  },
  {
    id: "CONDUZIR_MATRICULA",
    title: "Conduzir para matrícula",
    hint: "Fechar a matrícula",
    bgColor: "bg-emerald-50",
    headerBg: "bg-emerald-100",
    borderColor: "border-emerald-200",
    badgeColor: "bg-emerald-600",
  },
  {
    id: "PERDIDO",
    title: "Perdido",
    hint: "Sem interesse ou desistiu",
    bgColor: "bg-red-50",
    headerBg: "bg-red-100",
    borderColor: "border-red-200",
    badgeColor: "bg-red-500",
  },
] as const;

export const LEAD_STATUS_COLORS: Record<string, string> = {
  NOVO: "bg-[#E8EDF8] text-[#001A5E]",
  ENTENDER: "bg-sky-100 text-sky-800",
  ORIENTAR: "bg-teal-100 text-teal-800",
  QUALIFICAR: "bg-amber-100 text-amber-800",
  REGISTRAR: "bg-indigo-100 text-indigo-800",
  CONDUZIR_MATRICULA: "bg-emerald-100 text-emerald-800",
  PERDIDO: "bg-red-100 text-red-700",
  LEAD_FRIO: "bg-slate-100 text-slate-700",
  AGUARDANDO_RESPOSTA: "bg-orange-100 text-orange-700",
  HUMANO_SOLICITADO: "bg-yellow-100 text-yellow-800",
  HUMANO_EM_ATENDIMENTO: "bg-indigo-100 text-indigo-700",
  EM_ATENDIMENTO: "bg-sky-100 text-sky-800",
  CONSCIENTIZADO: "bg-teal-100 text-teal-800",
  QUALIFICADO: "bg-amber-100 text-amber-800",
  EM_NEGOCIACAO: "bg-indigo-100 text-indigo-800",
  PROPOSTA_ENVIADA: "bg-indigo-100 text-indigo-800",
  FECHADO: "bg-emerald-100 text-emerald-800",
};

export const CHART_STATUS_COLORS: Record<string, { label: string; color: string }> = {
  NOVO: { label: "Novo", color: "#001A5E" },
  ENTENDER: { label: "Entender", color: "#0284C7" },
  ORIENTAR: { label: "Orientar", color: "#0D9488" },
  QUALIFICAR: { label: "Qualificar", color: "#C9A227" },
  REGISTRAR: { label: "Registrar", color: "#4F46E5" },
  CONDUZIR_MATRICULA: { label: "Matrícula", color: "#059669" },
  PERDIDO: { label: "Perdido", color: "#9CA3AF" },
  HUMANO_SOLICITADO: { label: "Humano", color: "#FB923C" },
  HUMANO_EM_ATENDIMENTO: { label: "Hum. atend.", color: "#818CF8" },
  LEAD_FRIO: { label: "Frio", color: "#94A3B8" },
};

export const VALID_LEAD_STATUSES = [
  ...FUNNEL_STATUSES,
  ...OPERATIONAL_STATUSES,
  "EM_ATENDIMENTO",
  "CONSCIENTIZADO",
  "QUALIFICADO",
  "PROPOSTA_ENVIADA",
  "EM_NEGOCIACAO",
  "FECHADO",
] as const;

export const PROTECTED_FUNNEL_STATUSES = [
  "CONDUZIR_MATRICULA",
  "FECHADO",
  "PERDIDO",
  "HUMANO_SOLICITADO",
  "HUMANO_EM_ATENDIMENTO",
  "AGUARDANDO_RESPOSTA",
  "LEAD_FRIO",
];

export function normalizeLeadStatus(status: string | null | undefined): string {
  if (!status) return "NOVO";
  return LEGACY_STATUS_MAP[status] || status;
}

export function leadStatusLabel(status: string | null | undefined): string {
  const key = status || "NOVO";
  return LEAD_STATUS_LABELS[key] || key.replace(/_/g, " ");
}

export function funnelIndex(status: string | null | undefined): number {
  const normalized = normalizeLeadStatus(status);
  const idx = FUNNEL_STATUSES.indexOf(normalized as FunnelStatus);
  return idx === -1 ? -1 : idx;
}
