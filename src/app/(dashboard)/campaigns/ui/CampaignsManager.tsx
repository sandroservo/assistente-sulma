"use client";

import { useState } from "react";
import { Loader2, Play, Trash2, XCircle, ChevronDown, Send, Repeat, Clock, MessageSquare, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type RunSummary = { status: string; total: number; sent: number; failed: number; startedAt: string | Date };
type Campaign = {
  id: string;
  name: string;
  message: string;
  profile: string;
  recurrence: string;
  status: string;
  scheduledAt: string | Date | null;
  lastRunAt: string | Date | null;
  instanceIds: string[];
  targetFilter: { category?: string } | null;
  runs: RunSummary[];
};
type Instance = { id: string; name: string; status: string };
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
  DRAFT: "Rascunho",
  SCHEDULED: "Agendada",
  RUNNING: "Executando",
  DONE: "Concluída",
  CANCELLED: "Cancelada",
};
const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-gray-200 text-gray-700",
  SCHEDULED: "bg-blue-100 text-blue-700",
  RUNNING: "bg-amber-100 text-amber-700",
  DONE: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};
const RECURRENCE_LABEL: Record<string, string> = {
  NONE: "Única", DAILY: "Diária", WEEKLY: "Semanal", MONTHLY: "Mensal",
};

function fmt(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function CampaignsManager({
  initialCampaigns,
  instances,
  categories,
}: {
  initialCampaigns: Campaign[];
  instances: Instance[];
  categories: string[];
}) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [recipientsByCampaign, setRecipientsByCampaign] = useState<Record<string, FailedContact[]>>({});

  // form
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState("balanced");
  const [recurrence, setRecurrence] = useState("NONE");
  const [category, setCategory] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [selectedInstances, setSelectedInstances] = useState<string[]>([]);
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
          name, message, profile, recurrence,
          scheduledAt: scheduledAt || null,
          instanceIds: selectedInstances,
          targetFilter: category ? { category } : null,
          mediaBase64: image?.base64 || null,
          mediaMimeType: image?.mime || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setError(data.error || "Falha ao criar."); return; }
      setName(""); setMessage(""); setScheduledAt(""); setCategory("");
      setSelectedInstances([]); setImage(null); setRecurrence("NONE");
      await reload();
    } catch { setError("Erro ao criar campanha."); }
    finally { setSaving(false); }
  }

  async function runNow(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/campaigns/${id}/run`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Falha ao iniciar."); }
      setTimeout(reload, 1500);
    } finally { setBusyId(null); }
  }

  async function cancel(id: string) {
    setBusyId(id);
    try {
      await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      await reload();
    } finally { setBusyId(null); }
  }

  async function remove(id: string) {
    if (!confirm("Excluir esta campanha e seu histórico?")) return;
    setBusyId(id);
    try {
      await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
    } finally { setBusyId(null); }
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
          Disparo em massa com anti-bloqueio, agendamento e recorrência.
        </p>
      </div>

      {/* Formulário de criação */}
      <form onSubmit={handleCreate} className="rounded-lg border p-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="c-name">Nome</Label>
            <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Promoção Semanal" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="c-cat">Público (categoria de lead)</Label>
            <select id="c-cat" value={category} onChange={(e) => setCategory(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">Todos os leads</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="c-msg">Mensagem</Label>
          <Textarea id="c-msg" value={message} onChange={(e) => setMessage(e.target.value)} rows={4}
            placeholder="Texto que será enviado..." />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="c-profile">Perfil anti-bloqueio</Label>
            <select id="c-profile" value={profile} onChange={(e) => setProfile(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="conservative">Conservador</option>
              <option value="balanced">Equilibrado</option>
              <option value="aggressive">Agressivo</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="c-rec">Recorrência</Label>
            <select id="c-rec" value={recurrence} onChange={(e) => setRecurrence(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="NONE">Única</option>
              <option value="DAILY">Diária</option>
              <option value="WEEKLY">Semanal</option>
              <option value="MONTHLY">Mensal</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="c-when">Agendar para</Label>
            <Input id="c-when" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="c-img">Imagem (opcional)</Label>
            <Input id="c-img" type="file" accept="image/*" onChange={(e) => pickImage(e.target.files?.[0] || null)} />
          </div>
          {instances.length > 0 && (
            <div className="space-y-1">
              <Label>Instâncias (vazio = todas conectadas)</Label>
              <div className="flex flex-wrap gap-2">
                {instances.map((inst) => {
                  const on = selectedInstances.includes(inst.id);
                  return (
                    <button key={inst.id} type="button"
                      onClick={() => setSelectedInstances((prev) => on ? prev.filter((i) => i !== inst.id) : [...prev, inst.id])}
                      className={`rounded-full border px-3 py-1 text-xs ${on ? "bg-primary text-primary-foreground" : "bg-background"}`}>
                      {inst.name} {inst.status !== "CONNECTED" ? "(offline)" : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Criar campanha
        </Button>
      </form>

      {/* Lista */}
      <div className="space-y-3">
        {campaigns.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma campanha ainda.</p>}
        {campaigns.map((c) => {
          const run = c.runs?.[0];
          return (
            <div key={c.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{c.name}</span>
                  <Badge className={STATUS_COLOR[c.status]}>{STATUS_LABEL[c.status] ?? c.status}</Badge>
                  {c.recurrence !== "NONE" && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Repeat className="h-3 w-3" />{RECURRENCE_LABEL[c.recurrence]}
                    </span>
                  )}
                  {c.scheduledAt && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />{fmt(c.scheduledAt)}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={busyId === c.id || c.status === "RUNNING"} onClick={() => runNow(c.id)}>
                    {busyId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    Disparar
                  </Button>
                  {c.status === "SCHEDULED" && (
                    <Button size="sm" variant="outline" disabled={busyId === c.id} onClick={() => cancel(c.id)}>
                      <XCircle className="h-4 w-4" /> Cancelar
                    </Button>
                  )}
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
                        {f.status === "sent" ? (
                          <span className="inline-flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-3 w-3" /> enviado
                          </span>
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
