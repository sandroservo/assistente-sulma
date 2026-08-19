/**
 * Painel flutuante do disparo em background — não bloqueia o resto do sistema.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Loader2, Radio, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "sulma-broadcast-run";
const EVENT_NAME = "sulma-broadcast-run";

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
  campaignName: string;
  etaSeconds?: number | null;
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
  notifyRunChange();
}

export function BroadcastDockHost() {
  const [runId, setRunId] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setRunId(readActiveRunId());
    sync();
    window.addEventListener(EVENT_NAME, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT_NAME, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (!runId) return null;
  return (
    <BroadcastDock
      runId={runId}
      onClose={() => {
        clearActiveRunId();
        setRunId(null);
      }}
    />
  );
}

export function BroadcastDock({
  runId,
  onClose,
}: {
  runId: string;
  onClose: () => void;
}) {
  const [run, setRun] = useState<BroadcastRun | null>(null);
  const [open, setOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "sent" | "pending" | "failed" | "skipped">("all");
  const [resuming, setResuming] = useState(false);

  useEffect(() => {
    let stop = false;
    async function tick() {
      try {
        const res = await fetch(`/api/broadcast/${runId}`);
        const data = await res.json();
        if (stop) return;
        if (!res.ok) {
          setError(data.error || "Não foi possível acompanhar o disparo");
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
  }, [runId]);

  const done = run?.status === "DONE" || run?.status === "CANCELLED";
  const paused = run?.status === "PAUSED";
  const processed = (run?.sent ?? 0) + (run?.failed ?? 0) + (run?.skipped ?? 0);
  const total = run?.total ?? 0;
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
  const sendingCount = run?.contacts.filter((c) => c.status === "sending").length ?? 0;
  const pendingCount = run?.contacts.filter((c) => c.status === "pending" || c.status === "sending").length ?? 0;

  async function resume() {
    setResuming(true);
    try {
      const res = await fetch(`/api/broadcast/${runId}/resume`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Não foi possível retomar");
    } finally {
      setResuming(false);
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
          {done ? <CheckCircle2 className="w-4 h-4 text-[#FFD600] shrink-0" /> : paused ? <XCircle className="w-4 h-4 text-orange-300 shrink-0" /> : <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{run?.campaignName || "Disparo"}</p>
            <p className="text-[11px] text-white/70">
              {done
                ? "Concluído"
                : paused
                  ? "Pausado automaticamente"
                  : sendingCount > 0
                    ? `Enviando agora${run?.etaSeconds ? ` · falta ${formatEta(run.etaSeconds)}` : ""}`
                    : `Na fila${run?.etaSeconds ? ` · falta ${formatEta(run.etaSeconds)}` : ""}`}
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
              onClose();
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
                    {c.status === "failed" && c.errorMsg ? ` · ${c.errorMsg}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {paused && (
            <div className="rounded-lg bg-orange-50 border border-orange-200 p-2 space-y-2">
              <p className="text-xs text-orange-800">{run?.pauseReason || "Disparo pausado por falhas consecutivas."}</p>
              <button
                type="button"
                onClick={resume}
                disabled={resuming}
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[#001A5E] text-white disabled:opacity-60"
              >
                {resuming ? "Retomando…" : "Retomar envio"}
              </button>
            </div>
          )}
          {!done && !paused && (
            <p className="text-[11px] text-gray-500">
              Pode fechar este painel, trocar de página ou continuar trabalhando. O envio não para.
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
