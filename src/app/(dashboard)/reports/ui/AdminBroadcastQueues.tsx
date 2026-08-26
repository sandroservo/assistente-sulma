"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Loader2, Pause, Play, Radio, Square } from "lucide-react";
import { cn } from "@/lib/utils";

type QueueRun = {
  id: string;
  campaignName: string;
  status: string;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  pending: number;
  pauseReason: string | null;
  waitReason: string | null;
  waitUntil: string | Date | null;
  etaSeconds: number | null;
};

type Queue = {
  userId: string | null;
  userName: string;
  userEmail: string | null;
  runs: QueueRun[];
};

function formatEta(seconds: number): string {
  if (seconds < 60) return `~${seconds}s`;
  const m = Math.round(seconds / 60);
  if (m < 60) return `~${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `~${h}h ${rest}min` : `~${h}h`;
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
}

export function AdminBroadcastQueues() {
  const [queues, setQueues] = useState<Queue[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(runId: string, action: "pause" | "resume" | "stop") {
    if (action === "stop" && !confirm("Parar este disparo? O que não saiu é descartado.")) return;
    setBusy(runId);
    try {
      await fetch(`/api/broadcast/${runId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const res = await fetch("/api/broadcast/queues");
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.queues)) setQueues(data.queues);
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    let stop = false;
    async function tick() {
      try {
        const res = await fetch("/api/broadcast/queues");
        const data = await res.json().catch(() => ({}));
        if (stop) return;
        if (res.ok && Array.isArray(data.queues)) setQueues(data.queues);
      } catch {
        /* ignore */
      }
      if (!stop) timer = setTimeout(tick, 2500);
    }
    let timer = setTimeout(tick, 0);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, []);

  const totalConsultants = queues?.length ?? 0;
  const totalPending = queues?.reduce((s, q) => s + q.runs.reduce((a, r) => a + r.pending, 0), 0) ?? 0;

  return (
    <Card className="p-5 border-[#C5D0E8]">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <Radio className="w-5 h-5 text-[#001A5E]" />
          Filas de disparo
        </h2>
        {totalConsultants > 0 && (
          <p className="text-xs text-gray-500">
            {totalConsultants} consultor{totalConsultants === 1 ? "" : "es"} · {totalPending} na fila
          </p>
        )}
      </div>

      {queues === null && (
        <p className="text-sm text-gray-400 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando filas…
        </p>
      )}

      {queues && queues.length === 0 && (
        <p className="text-sm text-gray-400 py-6 text-center">Nenhum consultor disparando agora.</p>
      )}

      {queues && queues.length > 0 && (
        <div className="space-y-4">
          {queues.map((q) => (
            <div key={q.userId || q.userName} className="rounded-xl border border-gray-100 p-4 bg-white">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-[#001A5E] text-white text-sm font-bold flex items-center justify-center shrink-0">
                  {initials(q.userName)}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{q.userName}</p>
                  {q.userEmail && <p className="text-xs text-gray-500 truncate">{q.userEmail}</p>}
                </div>
              </div>
              <div className="space-y-3">
                {q.runs.map((run) => {
                  const processed = run.sent + run.failed + run.skipped;
                  const pct = run.total > 0 ? Math.round((processed / run.total) * 100) : 0;
                  const waitingUntil = run.waitUntil ? new Date(run.waitUntil) : null;
                  const waiting = Boolean(waitingUntil && waitingUntil.getTime() > Date.now());
                  const paused = run.status === "PAUSED";
                  return (
                    <div key={run.id} className="rounded-lg bg-gray-50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <p className="text-sm font-medium text-gray-800 truncate">{run.campaignName}</p>
                        <Badge
                          className={cn(
                            "text-[10px]",
                            paused ? "bg-orange-100 text-orange-800" : waiting ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                          )}
                        >
                          {paused ? (
                            <span className="inline-flex items-center gap-1"><Pause className="w-3 h-3" /> Pausado</span>
                          ) : waiting ? (
                            <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> Aguardando</span>
                          ) : (
                            <span className="inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Enviando</span>
                          )}
                        </Badge>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                        <div className="h-full bg-[#001A5E] transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[11px] text-gray-600">
                        {run.sent} ok
                        {run.failed > 0 ? ` · ${run.failed} falha` : ""}
                        {run.skipped > 0 ? ` · ${run.skipped} ignorado` : ""}
                        {` · ${run.pending} na fila · ${processed}/${run.total}`}
                        {run.etaSeconds ? ` · falta ${formatEta(run.etaSeconds)}` : ""}
                      </p>
                      {paused && run.pauseReason && (
                        <p className="text-[11px] text-orange-700 mt-1">{run.pauseReason}</p>
                      )}
                      {waiting && run.waitReason && (
                        <p className="text-[11px] text-[#001A5E] mt-1">{run.waitReason}</p>
                      )}
                      {/* Controle do admin: pausar/retomar/parar qualquer fila */}
                      <div className="flex gap-2 mt-2">
                        {paused ? (
                          <button
                            onClick={() => act(run.id, "resume")}
                            disabled={busy === run.id}
                            className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                          >
                            {busy === run.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />} Retomar
                          </button>
                        ) : (
                          <button
                            onClick={() => act(run.id, "pause")}
                            disabled={busy === run.id}
                            className="inline-flex items-center gap-1 rounded-md border border-orange-200 bg-orange-50 px-2 py-1 text-[11px] font-medium text-orange-700 hover:bg-orange-100 disabled:opacity-50"
                          >
                            {busy === run.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Pause className="w-3 h-3" />} Pausar
                          </button>
                        )}
                        <button
                          onClick={() => act(run.id, "stop")}
                          disabled={busy === run.id}
                          className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                        >
                          <Square className="w-3 h-3" /> Parar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
