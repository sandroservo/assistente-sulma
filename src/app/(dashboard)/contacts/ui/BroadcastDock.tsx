/**
 * Painel flutuante do disparo em background — não bloqueia o resto do sistema.
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Loader2, Pause, Play, Radio, Square, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatSendError } from "@/lib/send-error";

const STORAGE_KEY = "sulma-broadcast-run";
const DISMISS_KEY = "sulma-broadcast-dismissed";
const EVENT_NAME = "sulma-broadcast-run";

function readDismissed(): string[] {
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function dismissRuns(ids: string[]) {
  const next = new Set(readDismissed());
  for (const id of ids) if (id) next.add(id);
  try {
    sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...next]));
  } catch {
    /* ignore */
  }
}

function allDismissed(ids: string[]) {
  if (!ids.length) return false;
  const dismissed = new Set(readDismissed());
  return ids.every((id) => dismissed.has(id));
}

export type BroadcastRunContact = {
  id: string;
  phone: string;
  name: string | null;
  status: string;
  errorMsg: string | null;
  sentAt: string | Date | null;
};

export type BroadcastRun = {
  id: string;
  status: string;
  total: number;
  sent: number;
  failed: number;
  skipped?: number;
  pauseReason?: string | null;
  waitUntil?: string | Date | null;
  waitReason?: string | null;
  campaignName: string;
  etaSeconds?: number | null;
  ownerName?: string | null;
  contacts: BroadcastRunContact[];
};

function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length >= 12) return `(${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  return phone;
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `~${seconds}s`;
  const m = Math.round(seconds / 60);
  if (m < 60) return `~${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `~${h}h ${rest}min` : `~${h}h`;
}

function notifyRunChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT_NAME));
}

export function saveActiveRunId(id: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
  notifyRunChange();
}
export function readActiveRunId(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
export function clearActiveRunId() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function BroadcastDockHost() {
  const [hasQueue, setHasQueue] = useState(false);
  const lastIdsRef = useRef<string[]>([]);

  useEffect(() => {
    let stop = false;
    async function tick() {
      try {
        const res = await fetch("/api/broadcast/mine");
        const data = await res.json().catch(() => ({}));
        if (stop) return;
        const status = data.run?.status as string | undefined;
        const ids: string[] =
          Array.isArray(data.runIds) && data.runIds.length
            ? data.runIds
            : data.run?.id
              ? [data.run.id]
              : [];
        lastIdsRef.current = ids;
        const active = status === "RUNNING" || status === "PAUSED";
        const finished = status === "DONE" || status === "CANCELLED";
        setHasQueue(Boolean(ids.length && (active || (finished && !allDismissed(ids)))));
      } catch {
        /* ignore */
      }
      if (!stop) timer = setTimeout(tick, 2500);
    }
    const onEvent = () => {
      setHasQueue(true);
    };
    window.addEventListener(EVENT_NAME, onEvent);
    let timer = setTimeout(tick, 0);
    return () => {
      stop = true;
      clearTimeout(timer);
      window.removeEventListener(EVENT_NAME, onEvent);
    };
  }, []);

  if (!hasQueue) return null;
  return (
    <BroadcastDock
      onClose={(runId) => {
        dismissRuns([runId, ...lastIdsRef.current].filter((id): id is string => Boolean(id)));
        clearActiveRunId();
        setHasQueue(false);
      }}
    />
  );
}

export function BroadcastDock({
  onClose,
}: {
  onClose: (runId?: string) => void;
}) {
  const [run, setRun] = useState<BroadcastRun | null>(null);
  const [open, setOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "sent" | "pending" | "failed" | "skipped">("all");
  const [acting, setActing] = useState<"pause" | "stop" | "resume" | null>(null);

  useEffect(() => {
    let stop = false;
    async function tick() {
      try {
        const res = await fetch("/api/broadcast/mine");
        const data = await res.json();
        if (stop) return;
        if (!res.ok) {
          setError(data.error || "Não foi possível acompanhar o disparo");
          return;
        }
        if (!data.run) {
          setRun(null);
          return;
        }
        setRun(data.run);
        setError(null);
        if (data.run?.status === "DONE" || data.run?.status === "CANCELLED") {
          return;
        }
      } catch {
        if (!stop) setError("Conexão instável — tentando de novo…");
      }
      if (!stop) timer = setTimeout(tick, 1200);
    }
    let timer = setTimeout(tick, 0);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, []);

  const done = run?.status === "DONE" || run?.status === "CANCELLED";
  const paused = run?.status === "PAUSED";
  const waitingUntil = run?.waitUntil ? new Date(run.waitUntil) : null;
  const waiting = Boolean(waitingUntil && waitingUntil.getTime() > Date.now());
  const processed = (run?.sent ?? 0) + (run?.failed ?? 0) + (run?.skipped ?? 0);
  const total = run?.total ?? 0;
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
  const sendingCount = run?.contacts.filter((c) => c.status === "sending").length ?? 0;
  const pendingCount = run?.contacts.filter((c) => c.status === "pending" || c.status === "sending").length ?? 0;

  async function control(action: "pause" | "stop" | "resume") {
    if (action === "stop") {
      const ok = window.confirm("Parar agora? Quem já recebeu fica. O restante da fila não será enviado.");
      if (!ok) return;
    }
    setActing(action);
    try {
      const res = await fetch("/api/broadcast/mine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error || "Não foi possível alterar o disparo");
    } finally {
      setActing(null);
    }
  }

  const visible = useMemo(() => {
    const list = run?.contacts ?? [];
    if (filter === "sent") return list.filter((c) => c.status === "sent" || c.status === "delivered" || c.status === "read");
    if (filter === "pending") return list.filter((c) => c.status === "pending" || c.status === "sending");
    if (filter === "failed") return list.filter((c) => c.status === "failed");
    if (filter === "skipped") return list.filter((c) => c.status === "skipped");
    return list;
  }, [run?.contacts, filter]);

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[min(100%-2rem,420px)] shadow-2xl rounded-2xl overflow-hidden border border-gray-200 bg-white">
      <div className="w-full flex items-center gap-3 px-4 py-3 bg-[#001A5E] text-white">
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex flex-1 items-center gap-3 min-w-0 text-left">
          {done ? <CheckCircle2 className="w-4 h-4 text-[#FFD600] shrink-0" /> : paused ? <XCircle className="w-4 h-4 text-orange-300 shrink-0" /> : waiting ? <Clock className="w-4 h-4 text-[#FFD600] shrink-0" /> : <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">Sua fila · {run?.campaignName || "Disparo"}</p>
            <p className="text-[11px] text-white/70">
              {done
                ? (run?.status === "CANCELLED" ? "Parado por você" : "Concluído")
                : paused
                  ? (run?.pauseReason?.includes("consultor") ? "Pausado por você" : "Pausado automaticamente")
                  : waiting
                    ? (run?.waitReason || `Aguardando · continua ${waitingUntil?.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}`)
                    : sendingCount > 0
                      ? `Sua vez de enviar${run?.etaSeconds ? ` · falta ${formatEta(run.etaSeconds)}` : ""}`
                      : `Na sua fila · reveza com os outros (uma mensagem por vez)${run?.etaSeconds ? ` · falta ${formatEta(run.etaSeconds)}` : ""}`}
              {" · "}
              {run?.sent ?? 0} ok
              {(run?.failed ?? 0) > 0 ? ` · ${run?.failed} falha` : ""}
              {(run?.skipped ?? 0) > 0 ? ` · ${run?.skipped} ignorado` : ""} · {processed}/{total}
            </p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => {
            if (done) {
              onClose(run?.id);
            } else {
              setOpen(false);
            }
          }}
          className="p-1 rounded hover:bg-white/10"
          aria-label={done ? "Fechar" : "Minimizar"}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {open && (
        <div className="p-3 space-y-3">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#001A5E] transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {(
              [
                ["all", `Todos (${total})`],
                ["sent", `Receberam (${run?.sent ?? 0})`],
                ["pending", `Fila (${pendingCount})`],
                ["failed", `Falhas (${run?.failed ?? 0})`],
                ["skipped", `Ignorados (${run?.skipped ?? 0})`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={cn(
                  "px-2 py-1 rounded-full text-[11px] font-medium",
                  filter === id ? "bg-[#001A5E] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {error && <p className="text-xs text-amber-700">{error}</p>}
          <div className="max-h-64 overflow-y-auto space-y-1">
            {!run && <p className="text-xs text-gray-400 px-1">Carregando destinatários…</p>}
            {run && visible.length === 0 && (
              <p className="text-xs text-gray-400 px-1 py-2">Ninguém nesta lista ainda.</p>
            )}
            {visible.map((c) => (
              <div key={c.id} className="flex items-start gap-2 text-xs px-1 py-1.5 rounded-lg hover:bg-gray-50">
                {c.status === "sent" && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />}
                {c.status === "failed" && <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />}
                {c.status === "pending" && <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />}
                {c.status === "sending" && <Loader2 className="w-3.5 h-3.5 text-[#001A5E] animate-spin shrink-0 mt-0.5" />}
                {c.status === "skipped" && <XCircle className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />}
                {(c.status === "delivered" || c.status === "read") && (
                  <Radio className="w-3.5 h-3.5 text-sky-500 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={cn("font-medium truncate", c.status === "failed" ? "text-red-700" : "text-gray-800")}>
                    {c.name || formatPhone(c.phone)}
                  </p>
                  <p className="text-gray-500 truncate">
                    {formatPhone(c.phone)}
                    {c.status === "sent" && " · recebeu"}
                    {c.status === "sending" && " · enviando agora"}
                    {c.status === "pending" && " · na fila"}
                    {c.status === "skipped" && (c.errorMsg ? ` · ${c.errorMsg}` : " · ignorado")}
                    {c.status === "failed" && ` · ${formatSendError(c.errorMsg || "")}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {waiting && (
            <div className="rounded-lg bg-[#EEF2FF] border border-[#9AADD4] p-2">
              <p className="text-xs text-[#001A5E]">{run?.waitReason || "Aguardando a próxima hora para continuar de onde parou."}</p>
            </div>
          )}
          {paused && (
            <div className="rounded-lg bg-orange-50 border border-orange-200 p-2 space-y-2">
              <p className="text-xs text-orange-800">{run?.pauseReason || "Disparo pausado."}</p>
            </div>
          )}
          {!done && (
            <div className="flex gap-2">
              {paused ? (
                <button
                  type="button"
                  onClick={() => control("resume")}
                  disabled={acting !== null}
                  className="flex-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#001A5E] text-white disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
                >
                  {acting === "resume" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  {acting === "resume" ? "Retomando…" : "Retomar"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => control("pause")}
                  disabled={acting !== null}
                  className="flex-1 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
                >
                  {acting === "pause" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pause className="w-3.5 h-3.5" />}
                  {acting === "pause" ? "Pausando…" : "Pausar"}
                </button>
              )}
              <button
                type="button"
                onClick={() => control("stop")}
                disabled={acting !== null}
                className="flex-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
              >
                {acting === "stop" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
                {acting === "stop" ? "Parando…" : "Parar"}
              </button>
            </div>
          )}
          {!done && (
            <p className="text-[11px] text-gray-500">
              Pausar segura a fila. Parar descarta o que ainda não saiu. Fechar o painel não encerra o envio.
            </p>
          )}
          {done && (
            <p className="text-[11px] text-gray-500">
              Histórico também fica em{" "}
              <Link href="/campaigns" className="text-[#001A5E] font-medium hover:underline">Campanhas</Link>.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
