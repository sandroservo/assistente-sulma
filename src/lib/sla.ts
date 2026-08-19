/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * SLA de atendimento: semáforo por tempo de espera (doc §6.6/§8).
 * Só funções puras aqui — este módulo é importado por client components.
 * As métricas TME/TMA/TMR (que usam prisma) ficam em sla-server.ts.
 */

export type SlaLevel = "ok" | "leve" | "atencao" | "critico";

// Faixas padrão em minutos (doc §6.6: 10min · 1h · 1 dia). Override futuro por OrgSettings.
export const SLA_THRESHOLDS = { leve: 10, atencao: 60, critico: 1440 };

const SLA_COLORS: Record<SlaLevel, string> = {
  ok: "#22c55e",
  leve: "#eab308",
  atencao: "#f97316",
  critico: "#ef4444",
};

/** Nível de SLA pelo tempo desde a última mensagem (esperando resposta). */
export function slaLevel(
  lastMessageAt: string | Date | null,
  thresholds = SLA_THRESHOLDS
): { level: SlaLevel; color: string; minutes: number } {
  if (!lastMessageAt) return { level: "ok", color: SLA_COLORS.ok, minutes: 0 };
  const minutes = (Date.now() - new Date(lastMessageAt).getTime()) / 60_000;
  let level: SlaLevel = "ok";
  if (minutes >= thresholds.critico) level = "critico";
  else if (minutes >= thresholds.atencao) level = "atencao";
  else if (minutes >= thresholds.leve) level = "leve";
  return { level, color: SLA_COLORS[level], minutes: Math.round(minutes) };
}

/** Rótulo curto tipo "Há 4d" / "Há 19h" / "Há 25min" (doc §8). */
export function slaLabel(minutes: number): string {
  if (minutes < 60) return `Há ${minutes}min`;
  if (minutes < 1440) return `Há ${Math.floor(minutes / 60)}h`;
  return `Há ${Math.floor(minutes / 1440)}d`;
}
