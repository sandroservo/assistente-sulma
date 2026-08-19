/**
 * Anti-bloqueio Meta/WhatsApp para disparos em massa.
 *
 * Regras:
 * - Aquecimento progressivo por idade da instância
 * - Limite diário e por hora
 * - Pausa automática após erros seguidos
 * - Escolha ponderada (quem enviou menos / há mais tempo)
 * - Delays humanos com jitter e pausas longas
 */

import { prisma } from "@/lib/prisma";
import type { Instance } from "@prisma/client";

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
    minDelay: 20_000,
    maxDelay: 80_000,
    extraEvery: 4,
    extraChance: 0.55,
    extraMin: 60_000,
    extraMax: 180_000,
    dayMult: 0.55,
    hourMult: 0.55,
  },
  balanced: {
    minDelay: 12_000,
    maxDelay: 50_000,
    extraEvery: 6,
    extraChance: 0.4,
    extraMin: 35_000,
    extraMax: 90_000,
    dayMult: 0.85,
    hourMult: 0.85,
  },
  aggressive: {
    minDelay: 8_000,
    maxDelay: 28_000,
    extraEvery: 10,
    extraChance: 0.25,
    extraMin: 20_000,
    extraMax: 50_000,
    dayMult: 1,
    hourMult: 1,
  },
};

export function warmupLimits(
  warmupStartedAt: Date | null,
  dailyLimit: number,
  hourlyLimit: number,
  profile: AntiBlockProfile
) {
  const cfg = PROFILES[profile];
  const days = warmupStartedAt
    ? Math.max(
        1,
        Math.floor((Date.now() - warmupStartedAt.getTime()) / 86_400_000) + 1
      )
    : 1;

  let daily = dailyLimit;
  let hourly = hourlyLimit;
  if (days <= 2) {
    daily = Math.min(20, dailyLimit);
    hourly = Math.min(4, hourlyLimit);
  } else if (days <= 7) {
    daily = Math.min(50, dailyLimit);
    hourly = Math.min(8, hourlyLimit);
  } else if (days <= 14) {
    daily = Math.min(90, dailyLimit);
    hourly = Math.min(12, hourlyLimit);
  }

  return {
    daily: Math.max(1, Math.floor(daily * cfg.dayMult)),
    hourly: Math.max(1, Math.floor(hourly * cfg.hourMult)),
    days,
  };
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

export function classifySendError(message: string): "invalid_number" | "blocked" | "transient" | "unknown" {
  const t = message.toLowerCase();
  if (
    t.includes("exists") ||
    t.includes("not a whatsapp") ||
    t.includes("número inválido") ||
    t.includes("invalid number")
  ) {
    return "invalid_number";
  }
  if (
    t.includes("blocked") ||
    t.includes("banned") ||
    t.includes("forbidden") ||
    t.includes("403") ||
    t.includes("401")
  ) {
    return "blocked";
  }
  if (
    t.includes("503") ||
    t.includes("timeout") ||
    t.includes("econn") ||
    t.includes("closed") ||
    t.includes("disconnect")
  ) {
    return "transient";
  }
  return "unknown";
}

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
      data: { lastError: error.slice(0, 500) },
    });
    return kind;
  }

  const errors = inst.consecutiveErrors + 1;
  let pausedUntil: Date | null = inst.pausedUntil;
  if (kind === "blocked" || errors >= 3) {
    const minutes = kind === "blocked" ? 180 : 30;
    pausedUntil = new Date(Date.now() + minutes * 60_000);
  } else if (kind === "transient") {
    pausedUntil = new Date(Date.now() + 10 * 60_000);
  }

  await prisma.instance.update({
    where: { id: instanceId },
    data: {
      consecutiveErrors: errors,
      lastError: error.slice(0, 500),
      pausedUntil,
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
