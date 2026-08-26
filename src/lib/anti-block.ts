/**
 * Anti-bloqueio para disparo via Evolution (Baileys).
 * A Evolution não limita envio: o WhatsApp é que restringe.
 *
 * Fluxo: horário comercial 8h–19h (Brasília) · aquecimento 7 dias ·
 * teto por perfil · conferir número · delay "digitando" · intervalo irregular ·
 * pausa até a manhã se houver restrição.
 */

import { prisma } from "@/lib/prisma";
import type { Instance } from "@prisma/client";
import { classifySendError, formatSendError } from "@/lib/send-error";

export type AntiBlockProfile = "conservative" | "balanced" | "aggressive";

type ProfileCfg = {
  minDelay: number;
  maxDelay: number;
  extraEvery: number;
  extraChance: number;
  extraMin: number;
  extraMax: number;
  dayMult: number;
  hourMult: number;
};

const PROFILES: Record<AntiBlockProfile, ProfileCfg> = {
  conservative: {
    minDelay: 45_000,
    maxDelay: 110_000,
    extraEvery: 8,
    extraChance: 0.7,
    extraMin: 90_000,
    extraMax: 240_000,
    dayMult: 0.55,
    hourMult: 0.55,
  },
  balanced: {
    minDelay: 30_000,
    maxDelay: 75_000,
    extraEvery: 10,
    extraChance: 0.45,
    extraMin: 60_000,
    extraMax: 150_000,
    dayMult: 0.85,
    hourMult: 0.85,
  },
  aggressive: {
    minDelay: 20_000,
    maxDelay: 50_000,
    extraEvery: 12,
    extraChance: 0.3,
    extraMin: 40_000,
    extraMax: 90_000,
    dayMult: 1,
    hourMult: 1,
  },
};

/** Teto após aquecimento — 100/hora em API não oficial é o que costuma gerar restrição até a noite. */
const PROFILE_CEILING: Record<AntiBlockProfile, { hourly: number; daily: number }> = {
  conservative: { hourly: 35, daily: 280 },
  balanced: { hourly: 50, daily: 420 },
  aggressive: { hourly: 70, daily: 600 },
};

const WARMUP_BY_DAY: Array<{ hourly: number; daily: number }> = [
  { hourly: 10, daily: 50 },
  { hourly: 15, daily: 80 },
  { hourly: 20, daily: 120 },
  { hourly: 28, daily: 170 },
  { hourly: 35, daily: 230 },
  { hourly: 42, daily: 300 },
  { hourly: 50, daily: 380 },
];

const SEND_TZ = "America/Sao_Paulo";
const SEND_HOUR_START = 8;
const SEND_HOUR_END = 19;

function warmupDayIndex(warmupStartedAt: Date | null): number {
  if (!warmupStartedAt) return 1;
  return Math.max(1, Math.floor((Date.now() - warmupStartedAt.getTime()) / 86_400_000) + 1);
}

export function warmupLimits(
  warmupStartedAt: Date | null,
  dailyLimit: number,
  hourlyLimit: number,
  profile: AntiBlockProfile
) {
  const days = warmupDayIndex(warmupStartedAt);
  const ceiling = PROFILE_CEILING[profile];
  if (days >= 8) {
    return {
      daily: Math.max(1, Math.min(dailyLimit, ceiling.daily)),
      hourly: Math.max(1, Math.min(hourlyLimit, ceiling.hourly)),
      days,
    };
  }
  const ramp = WARMUP_BY_DAY[days - 1];
  return {
    daily: Math.max(1, Math.min(dailyLimit, ramp.daily, ceiling.daily)),
    hourly: Math.max(1, Math.min(hourlyLimit, ramp.hourly, ceiling.hourly)),
    days,
  };
}

function saoPauloClock(now = new Date()): { date: string; hour: number; minute: number } {
  const stamp = now.toLocaleString("sv-SE", { timeZone: SEND_TZ });
  const [date, time] = stamp.split(" ");
  const [hour, minute] = time.split(":").map(Number);
  return { date, hour, minute };
}

function saoPauloEightAmUtc(dateYmd: string): number {
  return Date.parse(`${dateYmd}T08:00:00-03:00`);
}

function nextCalendarDate(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** 0 se está no horário comercial (8h–19h Brasília). Senão, ms até as 8h. */
export function msUntilCampaignWindow(now = new Date()): number {
  const { date, hour } = saoPauloClock(now);
  if (hour >= SEND_HOUR_START && hour < SEND_HOUR_END) return 0;
  const targetDate = hour >= SEND_HOUR_END ? nextCalendarDate(date) : date;
  return Math.max(15_000, saoPauloEightAmUtc(targetDate) - now.getTime());
}

/** Próximas 8h (pula o restante de hoje) — usado após restrição/ban. */
export function msUntilNextMorningSendWindow(now = new Date()): number {
  const { date, hour } = saoPauloClock(now);
  const targetDate = hour < SEND_HOUR_START ? date : nextCalendarDate(date);
  return Math.max(60_000, saoPauloEightAmUtc(targetDate) - now.getTime());
}

export function formatBrasiliaTime(msFromNow: number): string {
  return new Date(Date.now() + msFromNow).toLocaleTimeString("pt-BR", {
    timeZone: SEND_TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function personalizeCampaignMessage(template: string, name: string | null): string {
  const first = (name || "").trim().split(/\s+/)[0] || "";
  let text = String(template || "")
    .replace(/\{\{\s*nome\s*\}\}/gi, first)
    .replace(/\{\{\s*name\s*\}\}/gi, first);
  text = text.replace(/\s+,/g, ",").replace(/ ,/g, ",");
  if (!first) {
    text = text.replace(/olá,\s*/i, "Olá, ").replace(/\s{2,}/g, " ");
  }
  return text.trim();
}

export function composingDelayMs(text: string): number {
  const chars = String(text || "").length;
  const ms = 2000 + chars * 40 + Math.random() * 900;
  return Math.round(Math.min(8_000, Math.max(2_000, ms)));
}

export function resetCountersIfNeeded<T extends Instance>(inst: T): T {
  const now = new Date();
  const hourKey = now.toISOString().slice(0, 13);
  const dayKey = now.toISOString().slice(0, 10);
  const hourReset = inst.hourResetAt?.toISOString().slice(0, 13);
  const dayReset = inst.dayResetAt?.toISOString().slice(0, 10);

  return {
    ...inst,
    sentThisHour: hourReset === hourKey ? inst.sentThisHour : 0,
    sentToday: dayReset === dayKey ? inst.sentToday : 0,
    hourResetAt: hourReset === hourKey ? inst.hourResetAt : now,
    dayResetAt: dayReset === dayKey ? inst.dayResetAt : now,
  };
}

export function instanceHealth(
  inst: Instance,
  profile: AntiBlockProfile
): { ok: boolean; reason?: string; daily: number; hourly: number; days: number } {
  const fresh = resetCountersIfNeeded(inst);
  const { daily, hourly, days } = warmupLimits(
    fresh.warmupStartedAt,
    fresh.dailyLimit,
    fresh.hourlyLimit,
    profile
  );

  if (fresh.status !== "CONNECTED") {
    return { ok: false, reason: "desconectada", daily, hourly, days };
  }
  if (fresh.pausedUntil && fresh.pausedUntil.getTime() > Date.now()) {
    return { ok: false, reason: "em pausa preventiva", daily, hourly, days };
  }
  if (fresh.consecutiveErrors >= 3) {
    return { ok: false, reason: "muitos erros seguidos", daily, hourly, days };
  }
  if (fresh.sentToday >= daily) {
    return { ok: false, reason: "limite diário", daily, hourly, days };
  }
  if (fresh.sentThisHour >= hourly) {
    return { ok: false, reason: "limite horário", daily, hourly, days };
  }
  return { ok: true, daily, hourly, days };
}

/** Por que nenhuma instância pode enviar agora (ou null se alguma está saudável). */
export function poolBlockReason(
  instances: Instance[],
  profile: AntiBlockProfile
): string | null {
  const quiet = msUntilCampaignWindow();
  if (quiet > 0) {
    return `Horário de proteção: disparos só das 8h às 19h (Brasília). Continua às ${formatBrasiliaTime(quiet)}.`;
  }
  if (!instances.length) return "Nenhuma instância conectada.";
  const reports = instances.map((inst) => {
    const fresh = resetCountersIfNeeded(inst);
    const health = instanceHealth(fresh, profile);
    return { fresh, health };
  });
  const blocked = reports.filter((r) => !r.health.ok);
  if (blocked.length < reports.length) return null;
  const { fresh, health } = blocked[0];
  switch (health.reason) {
    case "limite horário":
      return `Limite horário de proteção (${fresh.sentThisHour}/${health.hourly} nesta hora). Continua automaticamente na próxima hora.`;
    case "limite diário":
      return `Limite diário de proteção (${fresh.sentToday}/${health.daily}). Continua automaticamente amanhã.`;
    case "em pausa preventiva":
      return "Instância em pausa preventiva após restrição. Continua sozinho no horário comercial.";
    case "muitos erros seguidos":
      return "Muitos erros seguidos na instância. Verifique o WhatsApp e retome.";
    case "desconectada":
      return "Instância desconectada. Reconecte o WhatsApp e retome.";
    default:
      return health.reason || "Instância indisponível no momento.";
  }
}

export function poolBlockInfo(
  instances: Instance[],
  profile: AntiBlockProfile
): { kind: "hourly" | "daily" | "quiet" | "cooldown" | "hard"; reason: string; waitMs: number } | null {
  const quiet = msUntilCampaignWindow();
  if (quiet > 0) {
    return {
      kind: "quiet",
      reason: `Horário de proteção: disparos só das 8h às 19h (Brasília). Continua às ${formatBrasiliaTime(quiet)}.`,
      waitMs: quiet,
    };
  }

  const reason = poolBlockReason(instances, profile);
  if (!reason) return null;
  if (reason.includes("Limite horário")) {
    return { kind: "hourly", reason, waitMs: msUntilNextUtcHour() };
  }
  if (reason.includes("Limite diário")) {
    return { kind: "daily", reason, waitMs: msUntilNextUtcDay() };
  }
  if (reason.includes("pausa preventiva")) {
    const until = instances.reduce((max, inst) => {
      const t = inst.pausedUntil?.getTime() || 0;
      return t > max ? t : max;
    }, 0);
    const waitMs = until > Date.now() ? until - Date.now() : msUntilNextMorningSendWindow();
    return { kind: "cooldown", reason, waitMs: Math.max(15_000, waitMs) };
  }
  return { kind: "hard", reason, waitMs: 0 };
}

export function pickRandomInstance(
  instances: Instance[],
  profile: AntiBlockProfile
): Instance | null {
  const healthy = instances
    .map(resetCountersIfNeeded)
    .filter((i) => instanceHealth(i, profile).ok);

  if (!healthy.length) return null;

  const weights = healthy.map((i) => {
    const recency = i.lastSentAt
      ? Math.min(1, (Date.now() - i.lastSentAt.getTime()) / 180_000)
      : 1;
    const load = 1 / (1 + i.sentToday + i.sentThisHour * 2);
    return Math.max(0.05, recency * 0.45 + load * 0.55);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < healthy.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return healthy[i];
  }
  return healthy[healthy.length - 1];
}

export function computeDelay(
  index: number,
  profile: AntiBlockProfile,
  opts: { skipExtra?: boolean } = {}
): number {
  const cfg = PROFILES[profile];
  const span = cfg.maxDelay - cfg.minDelay;
  const base = cfg.minDelay + Math.random() * span;
  const jitter = base * (0.85 + Math.random() * 0.3);
  const extra =
    !opts.skipExtra &&
    index > 0 &&
    index % cfg.extraEvery === 0 &&
    Math.random() < cfg.extraChance
      ? cfg.extraMin + Math.random() * (cfg.extraMax - cfg.extraMin)
      : 0;
  return Math.round(jitter + extra);
}

/** Espalha ~hourlyLimit envios na hora, com jitter (não é rajada). */
export function computePacedDelay(hourlyLimit: number): number {
  const cap = Math.max(12, hourlyLimit);
  const base = Math.round(3_600_000 / cap);
  const jitter = 0.75 + Math.random() * 0.5;
  return Math.max(20_000, Math.round(base * jitter));
}

export function computeCampaignDelay(index: number, profile: AntiBlockProfile, hourlyLimit: number): number {
  return Math.max(computePacedDelay(hourlyLimit), computeDelay(index, profile));
}

export function msUntilNextUtcHour(): number {
  const now = new Date();
  const next = new Date(now);
  next.setUTCMilliseconds(0);
  next.setUTCSeconds(0);
  next.setUTCMinutes(0);
  next.setUTCHours(now.getUTCHours() + 1);
  return Math.max(5_000, next.getTime() - now.getTime() + 3_000);
}

export function msUntilNextUtcDay(): number {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 3, 0));
  return Math.max(5_000, next.getTime() - now.getTime());
}

export { classifySendError, formatSendError } from "@/lib/send-error";

export async function recordSendSuccess(instanceId: string) {
  const inst = await prisma.instance.findUnique({ where: { id: instanceId } });
  if (!inst) return;
  const fresh = resetCountersIfNeeded(inst);
  const now = new Date();
  await prisma.instance.update({
    where: { id: instanceId },
    data: {
      lastSentAt: now,
      sentToday: fresh.sentToday + 1,
      sentThisHour: fresh.sentThisHour + 1,
      dayResetAt: fresh.dayResetAt,
      hourResetAt: fresh.hourResetAt,
      consecutiveErrors: 0,
      lastError: null,
      warmupStartedAt: inst.warmupStartedAt ?? now,
    },
  });
}

export async function recordSendFailure(instanceId: string, error: string) {
  const kind = classifySendError(error);
  const inst = await prisma.instance.findUnique({ where: { id: instanceId } });
  if (!inst) return kind;

  if (kind === "invalid_number") {
    await prisma.instance.update({
      where: { id: instanceId },
      data: { lastError: formatSendError(error).slice(0, 200) },
    });
    return kind;
  }

  const errors = inst.consecutiveErrors + 1;
  let pausedUntil: Date | null = inst.pausedUntil;
  if (kind === "blocked") {
    // Restrição real do WhatsApp: trava duro até a manhã e reinicia warmup.
    pausedUntil = new Date(Date.now() + msUntilNextMorningSendWindow());
  } else if (kind === "transient") {
    // Blip de conexão (Baileys reconecta sozinho): cooldown curto, NÃO trava o dia.
    pausedUntil = new Date(Date.now() + 5 * 60_000);
  } else if (errors >= 5) {
    // Erros desconhecidos repetidos: cooldown de 30min, não o dia inteiro.
    pausedUntil = new Date(Date.now() + 30 * 60_000);
  }

  await prisma.instance.update({
    where: { id: instanceId },
    data: {
      consecutiveErrors: errors,
      lastError: formatSendError(error).slice(0, 200),
      pausedUntil,
      ...(kind === "blocked" ? { warmupStartedAt: new Date() } : {}),
    },
  });
  return kind;
}

export function formatWait(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}min ${r}s` : `${m}min`;
}
