"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Trash2, ChevronDown, Send, MessageSquare, CheckCircle2, XCircle, Radio, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type RunSummary = {
  id: string;
  status: string;
  total: number;
  sent: number;
  failed: number;
  skipped?: number;
  pauseReason?: string | null;
  startedAt: string | Date;
};
type Campaign = {
  id: string;
  name: string;
  message: string;
  profile: string;
  status: string;
  lastRunAt: string | Date | null;
  runs: RunSummary[];
};
type FailedContact = {
  phone: string;
  name: string | null;
  status?: string;
  errorKind: string | null;
  errorMsg: string | null;
  leadName?: string | null;
  contactName?: string | null;
  conversationId?: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Pronta",
  SCHEDULED: "Pronta",
  RUNNING: "Enviando",
  PAUSED: "Pausada",
  DONE: "Pronta",
  CANCELLED: "Arquivada",
};
const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-gray-200 text-gray-700",
  SCHEDULED: "bg-gray-200 text-gray-700",
  RUNNING: "bg-amber-100 text-amber-700",
  PAUSED: "bg-orange-100 text-orange-800",
  DONE: "bg-gray-200 text-gray-700",
  CANCELLED: "bg-red-100 text-red-700",
};
const PROFILE_LABEL: Record<string, string> = {
  conservative: "Conservador",
  balanced: "Equilibrado",
  aggressive: "Agressivo",
};

function fmt(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function CampaignsManager({
  initialCampaigns,
}: {
  initialCampaigns: Campaign[];
}) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [recipientsByCampaign, setRecipientsByCampaign] = useState<Record<string, FailedContact[]>>({});

  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState("balanced");
  const [image, setImage] = useState<{ base64: string; mime: string } | null>(null);

  async function reload() {
    const res = await fetch("/api/campaigns");
    const data = await res.json();
    if (data.ok) setCampaigns(data.campaigns);
  }

  async function pickImage(file: File | null) {
    if (!file) { setImage(null); return; }
    const dataUrl: string = await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.readAsDataURL(file);
    });
    setImage({ base64: dataUrl.split(",")[1] || "", mime: file.type || "image/jpeg" });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !message.trim()) {
      setError("Preencha nome e mensagem.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          message,
          profile,
          mediaBase64: image?.base64 || null,
          mediaMimeType: image?.mime || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setError(data.error || "Falha ao criar."); return; }
      setName("");
      setMessage("");
      setImage(null);
      await reload();
    } catch {
      setError("Erro ao criar campanha.");
    } finally {
      setSaving(false);
    }
  }

  async function resume(runId: string) {
    setBusyId(runId);
    try {
      const res = await fetch(`/api/broadcast/${runId}/resume`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Não foi possível retomar."); return; }
      await reload();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Excluir esta campanha e seu histórico?")) return;
    setBusyId(id);
    try {
      await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleRecipients(id: string) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!recipientsByCampaign[id]) {
      const res = await fetch(`/api/campaigns/${id}`);
      const data = await res.json();
      if (data.ok) {
        const recipients: FailedContact[] = data.campaign.runs.flatMap((r: { contacts: FailedContact[] }) => r.contacts);
        setRecipientsByCampaign((prev) => ({ ...prev, [id]: recipients }));
      }
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Campanhas</h1>
        <p className="text-sm text-muted-foreground">
          Monte o modelo da mensagem aqui. O envio é feito em{" "}
          <Link href="/contacts" className="text-[#001A5E] font-medium hover:underline">
            Contatos → Disparo em Massa
          </Link>
          .
        </p>
      </div>

      <form onSubmit={handleCreate} className="rounded-lg border p-4 space-y-4">
        <div className="space-y-1">
          <Label htmlFor="c-name">Nome</Label>
          <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Promoção Semanal" />
        </div>

        <div className="space-y-1">
          <Label htmlFor="c-msg">Mensagem</Label>
          <Textarea
            id="c-msg"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="Texto que será enviado..."
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="c-profile">Perfil anti-bloqueio</Label>
            <select
              id="c-profile"
              value={profile}
              onChange={(e) => setProfile(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="conservative">Conservador</option>
              <option value="balanced">Equilibrado</option>
              <option value="aggressive">Agressivo</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="c-img">Imagem (opcional)</Label>
            <Input id="c-img" type="file" accept="image/*" onChange={(e) => pickImage(e.target.files?.[0] || null)} />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Salvar modelo
        </Button>
      </form>

      <div className="space-y-3">
        {campaigns.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma campanha ainda.</p>}
        {campaigns.map((c) => {
          const run = c.runs?.[0];
          return (
            <div key={c.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{c.name}</span>
                  <Badge className={STATUS_COLOR[c.status]}>{STATUS_LABEL[c.status] ?? c.status}</Badge>
                  <span className="text-xs text-muted-foreground">{PROFILE_LABEL[c.profile] || c.profile}</span>
                </div>
                <div className="flex gap-2">
                  {(c.status === "PAUSED" || run?.status === "PAUSED") && run?.id && (
                    <Button size="sm" variant="outline" disabled={busyId === run.id} onClick={() => resume(run.id)}>
                      {busyId === run.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      Retomar
                    </Button>
                  )}
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/contacts">
                      <Radio className="h-4 w-4" />
                      Disparar em Contatos
                    </Link>
                  </Button>
                  <Button size="sm" variant="outline" disabled={busyId === c.id} onClick={() => remove(c.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <p className="line-clamp-2 text-sm text-muted-foreground">{c.message}</p>

              {run && (
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <span>Total: <b>{run.total}</b></span>
                  <span className="text-green-600">Enviados: <b>{run.sent}</b></span>
                  <span className="text-red-600">Erros: <b>{run.failed}</b></span>
                  {(run.skipped ?? 0) > 0 && <span className="text-gray-600">Ignorados: <b>{run.skipped}</b></span>}
                  {run.pauseReason && <span className="text-orange-700">{run.pauseReason}</span>}
                  <span className="text-muted-foreground">Último: {fmt(run.startedAt)}</span>
                  <button onClick={() => toggleRecipients(c.id)} className="flex items-center gap-1 text-blue-600">
                    Ver quem recebeu <ChevronDown className={`h-3 w-3 transition ${expanded === c.id ? "rotate-180" : ""}`} />
                  </button>
                </div>
              )}

              {expanded === c.id && (
                <div className="rounded border bg-muted/30 p-2 text-xs space-y-1">
                  {!recipientsByCampaign[c.id] && <p className="text-muted-foreground">Carregando...</p>}
                  {recipientsByCampaign[c.id]?.length === 0 && <p className="text-muted-foreground">Nenhum destinatário nesta execução.</p>}
                  {recipientsByCampaign[c.id]?.map((f, i) => (
                    <div key={i} className="flex items-start justify-between gap-2 border-b py-1.5 last:border-0">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-800">
                          Lead: {f.leadName || f.name || "sem nome"}
                        </p>
                        <p className="text-muted-foreground">
                          Contato: {f.contactName || f.name || "—"} · {f.phone}
                        </p>
                        {f.status === "failed" && (
                          <p className="text-red-600">{f.errorKind || "erro"}: {f.errorMsg?.slice(0, 80)}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {f.status === "sent" || f.status === "delivered" || f.status === "read" ? (
                          <span className="inline-flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-3 w-3" /> enviado
                          </span>
                        ) : f.status === "pending" || f.status === "sending" ? (
                          <span className="inline-flex items-center gap-1 text-amber-600">na fila</span>
                        ) : f.status === "skipped" ? (
                          <span className="inline-flex items-center gap-1 text-gray-500">ignorado</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600">
                            <XCircle className="h-3 w-3" /> falhou
                          </span>
                        )}
                        {f.conversationId && (
                          <a href={`/chats/${f.conversationId}`} className="inline-flex items-center gap-1 text-[#001A5E] font-medium">
                            <MessageSquare className="h-3 w-3" /> chat
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
