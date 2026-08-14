/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Gerencia instâncias WhatsApp na Evolution API: criar, QR, desconectar.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  QrCode,
  Unplug,
  Trash2,
  RefreshCw,
  Loader2,
  Smartphone,
  Shield,
  PauseCircle,
  PlayCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Instance = {
  id: string;
  name: string;
  instanceName: string;
  phone: string | null;
  status: "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "QRCODE";
  qrcode: string | null;
  dailyLimit: number;
  hourlyLimit: number;
  sentToday: number;
  sentThisHour: number;
  pausedUntil: string | null;
  warmupStartedAt: string | null;
  lastError: string | null;
  health?: { ok: boolean; reason?: string; daily: number; hourly: number; days: number };
};

const STATUS_LABEL: Record<Instance["status"], string> = {
  CONNECTED: "Conectada",
  CONNECTING: "Conectando",
  QRCODE: "Aguardando QR",
  DISCONNECTED: "Desconectada",
};

export default function InstancesManager({ embedded = false }: { embedded?: boolean }) {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [qr, setQr] = useState<{ id: string; src: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/instances");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Falha ao listar instâncias");
    setInstances(data.instances || []);
  }, []);

  useEffect(() => {
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    fetch("/api/instances/sync-webhooks", { method: "POST" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok && data.error) setInfo(data.error);
      })
      .catch(() => {});
  }, [load]);

  useEffect(() => {
    if (!qr) return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/instances/${qr.id}/status`);
      const data = await res.json().catch(() => ({}));
      if (data.status === "CONNECTED") {
        setQr(null);
        load().catch(() => {});
      } else if (data.qrcode && data.qrcode !== qr.src) {
        setQr({ id: qr.id, src: data.qrcode });
      }
    }, 3000);
    return () => clearInterval(t);
  }, [qr, load]);

  async function createInstance() {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível criar");
      setName("");
      await load();
      if (data.instance?.id) await connect(data.instance.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar");
    } finally {
      setCreating(false);
    }
  }

  async function connect(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/instances/${id}/connect`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falha ao conectar");
      if (data.warning) setInfo(data.warning);
      if (data.qrcode) setQr({ id, src: data.qrcode });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao conectar");
    } finally {
      setBusyId(null);
    }
  }

  async function disconnect(id: string) {
    setBusyId(id);
    try {
      await fetch(`/api/instances/${id}/disconnect`, { method: "POST" });
      if (qr?.id === id) setQr(null);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Excluir esta instância da Evolution e do painel?")) return;
    setBusyId(id);
    try {
      await fetch(`/api/instances/${id}`, { method: "DELETE" });
      if (qr?.id === id) setQr(null);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function resume(id: string) {
    setBusyId(id);
    try {
      await fetch(`/api/instances/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume: true }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className={embedded ? "space-y-4" : "p-4 pt-14 md:p-6 md:pt-6 space-y-6"}>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className={embedded ? "text-base font-semibold text-[#001A5E]" : "text-xl font-bold text-[#001A5E]"}>
            Instâncias WhatsApp
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Crie o número na Evolution, conecte pelo QR e use no disparo com rotação anti-bloqueio.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => load()} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </Button>
      </div>

      {!embedded && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex gap-3">
          <Shield className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Anti-bloqueio Meta</p>
            <p className="mt-1 text-amber-700">
              Números novos começam com aquecimento (poucos envios/dia). O disparo escolhe instâncias
              aleatoriamente, respeita limite horário/diário e pausa o número se a Meta recusar envios.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col sm:flex-row gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome da instância (ex.: Comercial 01)"
          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#001A5E]/20 focus:border-[#001A5E]"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              createInstance();
            }
          }}
        />
        <Button
          type="button"
          onClick={createInstance}
          disabled={creating || !name.trim()}
          className="bg-[#001A5E] hover:bg-[#003080] text-white"
        >
          {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
          Criar e conectar
        </Button>
      </div>

      {info && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{info}</div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : instances.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Smartphone className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          Nenhuma instância ainda. Crie a primeira acima.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {instances.map((inst) => {
            const paused = inst.pausedUntil && new Date(inst.pausedUntil).getTime() > Date.now();
            return (
              <div key={inst.id} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">{inst.name}</p>
                    <p className="text-xs text-gray-400 font-mono">{inst.instanceName}</p>
                    {inst.phone && <p className="text-xs text-gray-500 mt-1">{inst.phone}</p>}
                  </div>
                  <span
                    className={cn(
                      "text-[11px] font-medium px-2 py-1 rounded-full",
                      inst.status === "CONNECTED" && "bg-emerald-50 text-emerald-700",
                      inst.status === "QRCODE" && "bg-amber-50 text-amber-700",
                      inst.status === "CONNECTING" && "bg-sky-50 text-sky-700",
                      inst.status === "DISCONNECTED" && "bg-gray-100 text-gray-600"
                    )}
                  >
                    {STATUS_LABEL[inst.status]}
                  </span>
                </div>

                <div className="text-xs text-gray-500 space-y-1">
                  <p>
                    Hoje {inst.sentToday}/{inst.health?.daily ?? inst.dailyLimit} · Hora {inst.sentThisHour}/
                    {inst.health?.hourly ?? inst.hourlyLimit}
                    {inst.health?.days ? ` · aquecimento dia ${inst.health.days}` : ""}
                  </p>
                  {paused && (
                    <p className="text-amber-700 flex items-center gap-1">
                      <PauseCircle className="w-3.5 h-3.5" />
                      Pausada até {new Date(inst.pausedUntil!).toLocaleString("pt-BR")}
                    </p>
                  )}
                  {!inst.health?.ok && inst.health?.reason && (
                    <p className="text-amber-600">Anti-bloqueio: {inst.health.reason}</p>
                  )}
                  {inst.lastError && <p className="text-red-500 truncate">{inst.lastError}</p>}
                </div>

                <div className="flex flex-wrap gap-2">
                  {inst.status !== "CONNECTED" && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => connect(inst.id)}
                      disabled={busyId === inst.id}
                      className="bg-[#001A5E] hover:bg-[#003080] text-white"
                    >
                      {busyId === inst.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <QrCode className="w-3.5 h-3.5 mr-1" />
                      )}
                      Conectar
                    </Button>
                  )}
                  {inst.status === "CONNECTED" && (
                    <Button type="button" size="sm" variant="outline" onClick={() => disconnect(inst.id)} disabled={busyId === inst.id}>
                      <Unplug className="w-3.5 h-3.5 mr-1" />
                      Desconectar
                    </Button>
                  )}
                  {paused && (
                    <Button type="button" size="sm" variant="outline" onClick={() => resume(inst.id)} disabled={busyId === inst.id}>
                      <PlayCircle className="w-3.5 h-3.5 mr-1" />
                      Retomar
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => remove(inst.id)}
                    disabled={busyId === inst.id}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {qr && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center space-y-4">
            <h2 className="font-semibold text-[#001A5E]">Escaneie o QR no WhatsApp</h2>
            <p className="text-xs text-gray-500">Aparelho vinculado → Aparelhos conectados → Conectar um aparelho</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr.src} alt="QR Code WhatsApp" className="mx-auto w-56 h-56 object-contain rounded-xl border" />
            <p className="text-xs text-gray-400">Atualiza sozinho quando conectar.</p>
            <Button type="button" variant="outline" onClick={() => setQr(null)}>
              Fechar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
