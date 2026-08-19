/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Client component principal da conversa — orquestra header, tabs, chat, composer e lead sidebar
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bot,
  UserCheck,
  PanelRightOpen,
  PanelRightClose,
  Phone,
  RefreshCw,
  MoreHorizontal,
  User,
  Mail,
  MapPin,
  CheckCircle2,
  Clock,
  Pencil,
  X,
  Bell,
  Trash2,
  AlertTriangle,
  Info,
  ArrowLeft,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import InboxConversation from "./InboxConversation";
import ChatComposer from "./ChatComposer";
import LeadSidebar from "./LeadSidebar";
import { LeadAvatar } from "@/components/LeadAvatar";
import {
  FUNNEL_STATUSES,
  LEAD_STATUS_COLORS,
  LEAD_STATUS_LABELS,
  leadStatusLabel,
  normalizeLeadStatus,
} from "@/lib/lead-funnel";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Lead {
  id: string;
  organizationId: string;
  name: string | null;
  pushName: string | null;
  avatarUrl: string | null;
  phone: string;
  email: string | null;
  city: string | null;
  status: string;
  ownerType: string;
  leadScore: number;
  summary: string | null;
  notes: string | null;
  tags: Tag[];
}

interface ChatPageClientProps {
  conversationId: string;
  convStatus?: string; // open | closed
  sectorId?: string | null;
  assignedUserId?: string | null;
  currentUserId?: string | null;
  lead: Lead;
  initialMessages: Array<{
    id: string;
    body: string | null;
    type?: string;
    mediaUrl?: string | null;
    transcription?: string | null;
    direction: string;
    createdAt: Date;
    sentByUserName?: string | null;
    providerId?: string | null;
    quotedMessageId?: string | null;
    status?: string | null;
    editedAt?: string | null;
  }>;
}

function getInitials(name: string | null, phone: string): string {
  if (name) {
    return name
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }
  return phone.slice(-2);
}

function formatLastSeen(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `há ${hours}h`;
  const d = new Date(isoDate);
  return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

function getScoreColor(score: number): string {
  if (score >= 800) return "bg-red-500";
  if (score >= 600) return "bg-orange-500";
  if (score >= 400) return "bg-yellow-500";
  if (score >= 200) return "bg-blue-400";
  return "bg-gray-400";
}

function getStatusBadge(status: string, ownerType: string) {
  if (ownerType === "human") {
    return { label: "Atendimento humano", className: "bg-purple-100 text-purple-700" };
  }
  return {
    label: leadStatusLabel(status),
    className: LEAD_STATUS_COLORS[status] || "bg-gray-100 text-gray-700",
  };
}

export default function ChatPageClient({
  conversationId,
  convStatus = "open",
  sectorId: initialSectorId = null,
  assignedUserId: initialAssignedUserId = null,
  currentUserId = null,
  lead: initialLead,
  initialMessages,
}: ChatPageClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("conversa");
  const [lead, setLead] = useState(initialLead);
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [parouResponderLoading, setParouResponderLoading] = useState(false);
  const [closed, setClosed] = useState(convStatus === "closed");
  const [closingLoading, setClosingLoading] = useState(false);
  // Atribuição: setor + atendente.
  const [sectorId, setSectorId] = useState<string>(initialSectorId ?? "");
  const [assignedUserId, setAssignedUserId] = useState<string>(initialAssignedUserId ?? "");
  const [sectors, setSectors] = useState<Array<{ id: string; name: string }>>([]);
  const [attendants, setAttendants] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    fetch("/api/sectors").then((r) => r.json()).then((d) => setSectors(d.sectors ?? [])).catch(() => {});
    fetch("/api/users").then((r) => r.json()).then((d) => setAttendants(d.users ?? [])).catch(() => {});
  }, []);

  const patchAssignment = useCallback(async (payload: { sectorId?: string | null; assignedUserId?: string | null }) => {
    try {
      await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch { /* próximo fetch reconcilia */ }
  }, [conversationId]);

  const handleToggleClose = async () => {
    const next = !closed;
    setClosingLoading(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next ? "closed" : "open" }),
      });
      if (res.ok) setClosed(next);
    } catch { /* ignore */ } finally {
      setClosingLoading(false);
    }
  };

  // Presença online do cliente
  const [clientOnline, setClientOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);

  // Edição inline na aba Detalhes
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingField, setSavingField] = useState(false);

  // Lembretes
  const [reminders, setReminders] = useState<Array<{ id: string; scheduledAt: string; lastError: string | null; status: string }>>([]);
  const [loadingReminders, setLoadingReminders] = useState(false);
  const [editingReminder, setEditingReminder] = useState<string | null>(null);
  const [editReminderDate, setEditReminderDate] = useState("");
  const [editReminderNote, setEditReminderNote] = useState("");
  const [savingReminder, setSavingReminder] = useState(false);

  // Toast modal (substitui alert)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Confirm modal (substitui confirm)
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);

  function showToast(message: string, type: "success" | "error" | "info" = "info") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  function showConfirm(message: string, onConfirm: () => void) {
    setConfirmModal({ message, onConfirm });
  }

  const fetchReminders = useCallback(async () => {
    setLoadingReminders(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/reminders`);
      if (res.ok) {
        const data = await res.json();
        setReminders(data.reminders || []);
      }
    } catch {
      console.error("Erro ao buscar lembretes");
    } finally {
      setLoadingReminders(false);
    }
  }, [lead.id]);

  // Polling de presença do cliente (online/offline)
  useEffect(() => {
    let mounted = true;
    async function checkPresence() {
      try {
        const res = await fetch(`/api/conversations/${conversationId}/presence`);
        if (res.ok && mounted) {
          const data = await res.json();
          setClientOnline(data.available === true);
          setLastSeen(data.lastSeen ?? null);
        }
      } catch { /* ignore */ }
    }
    checkPresence();
    const interval = setInterval(checkPresence, 30000);
    return () => { mounted = false; clearInterval(interval); };
  }, [conversationId]);

  useEffect(() => {
    if (activeTab === "detalhes") {
      fetchReminders();
    }
  }, [activeTab, fetchReminders]);

  async function handleDeleteReminder(reminderId: string) {
    showConfirm("Deseja excluir este lembrete?", async () => {
      try {
        const res = await fetch(`/api/leads/${lead.id}/reminders`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reminderId }),
        });
        if (res.ok) {
          setReminders((prev) => prev.filter((r) => r.id !== reminderId));
          showToast("Lembrete excluído", "success");
        } else {
          showToast("Erro ao excluir lembrete", "error");
        }
      } catch {
        showToast("Erro ao excluir lembrete", "error");
      }
    });
  }

  function startEditingReminder(rem: { id: string; scheduledAt: string; lastError: string | null }) {
    setEditingReminder(rem.id);
    const d = new Date(rem.scheduledAt);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setEditReminderDate(local);
    setEditReminderNote(rem.lastError || "");
  }

  async function handleSaveReminder(reminderId: string) {
    if (savingReminder) return;
    setSavingReminder(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/reminders`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reminderId,
          scheduledAt: editReminderDate,
          note: editReminderNote,
        }),
      });
      if (res.ok) {
        setEditingReminder(null);
        fetchReminders();
        showToast("Lembrete atualizado", "success");
      } else {
        showToast("Erro ao salvar lembrete", "error");
      }
    } catch {
      showToast("Erro ao salvar lembrete", "error");
    } finally {
      setSavingReminder(false);
    }
  }

  const displayName = lead.name || lead.pushName || "Sem nome";
  const badge = getStatusBadge(lead.status, lead.ownerType);

  function startEditing(field: string, currentValue: string | null) {
    setEditingField(field);
    setEditValue(currentValue || "");
  }

  async function saveField(field: string) {
    if (savingField) return;
    setSavingField(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: editValue.trim() || null }),
      });
      if (res.ok) {
        setLead((prev) => ({ ...prev, [field]: editValue.trim() || null }));
        setEditingField(null);
        showToast("Dados atualizados", "success");
      } else {
        showToast("Erro ao salvar", "error");
      }
    } catch {
      showToast("Erro ao salvar", "error");
    } finally {
      setSavingField(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    try {
      const res = await fetch(`/api/leads/${lead.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setLead((prev) => ({ ...prev, status: newStatus }));
        showToast("Status atualizado", "success");
      }
    } catch {
      showToast("Erro ao alterar status", "error");
    }
  }

  async function handleHandoff() {
    setHandoffLoading(true);
    try {
      const endpoint =
        lead.ownerType === "human"
          ? `/api/leads/${lead.id}/return-to-bot`
          : `/api/leads/${lead.id}/handoff`;
      const res = await fetch(endpoint, { method: "POST" });
      if (!res.ok) {
        showToast("Erro ao alterar atendimento", "error");
        return;
      }
      const newOwner = lead.ownerType === "human" ? "bot" : "human";
      setLead((prev) => ({ ...prev, ownerType: newOwner }));
      showToast(
        newOwner === "human" ? "Atendimento assumido por você" : "Lead devolvido para Sulma",
        "success"
      );
    } catch {
      showToast("Erro ao alterar atendimento", "error");
    } finally {
      setHandoffLoading(false);
    }
  }

  async function handleParouResponder() {
    setParouResponderLoading(true);
    try {
      const res = await fetch("/api/followups/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, conversationId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error ?? "Erro ao agendar", "error");
        return;
      }
      if (data.message === "followups already scheduled") {
        showToast("Já existem lembretes agendados para este lead.", "info");
      } else {
        showToast("Lead marcado como Aguardando resposta. Lembretes agendados para 24h, 48h, 72h e 120h.", "success");
      }
    } catch {
      showToast("Erro ao marcar cliente parou de responder", "error");
    } finally {
      setParouResponderLoading(false);
    }
  }

  const router = useRouter();

  return (
    <div className="flex h-full max-h-full overflow-hidden">
      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b px-3 md:px-6 py-3 flex items-center justify-between flex-shrink-0 gap-2">
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            {/* Botão voltar — mobile only */}
            <button
              onClick={() => router.push("/chats")}
              className="md:hidden p-2 rounded-full bg-[#EEF2FF] hover:bg-[#E8EDF8] text-[#001A5E] shrink-0 transition-colors"
              aria-label="Voltar para conversas"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <LeadAvatar
              leadId={lead.id}
              avatarUrl={lead.avatarUrl}
              name={lead.name || lead.pushName}
              phone={lead.phone}
              size="md"
              className="shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                <h2 className="font-semibold text-sm md:text-base truncate">{displayName}</h2>
                <Badge className={cn("text-[10px] md:text-xs hidden sm:inline-flex", badge.className)}>
                  {badge.label}
                </Badge>
                {lead.leadScore > 0 && (
                  <span
                    className={cn(
                      "text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white",
                      getScoreColor(lead.leadScore)
                    )}
                    title={`Lead Score: ${lead.leadScore}`}
                  >
                    {lead.leadScore}
                  </span>
                )}
              </div>
              <p className="text-xs md:text-sm text-gray-500 flex items-center gap-1.5">
                <Phone className="h-3 w-3" />
                {lead.phone}
                <span className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0",
                  clientOnline ? "bg-emerald-500" : "bg-gray-300"
                )} title={clientOnline ? "Online" : "Offline"} />
                <span className="text-[10px]">
                  {clientOnline
                    ? "online"
                    : lastSeen
                      ? `visto ${formatLastSeen(lastSeen)}`
                      : "offline"}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 md:gap-2 shrink-0">
            <button
              onClick={handleHandoff}
              disabled={handoffLoading}
              className={cn(
                "px-2 md:px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50",
                lead.ownerType === "human"
                  ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                  : "bg-purple-100 text-purple-700 hover:bg-purple-200"
              )}
              title={lead.ownerType === "human" ? "Devolver para Sulma" : "Assumir atendimento"}
            >
              {lead.ownerType === "human" ? (
                <span className="flex items-center gap-1"><Bot className="h-3.5 w-3.5" /><span className="hidden sm:inline"> Devolver p/ Sulma</span></span>
              ) : (
                <span className="flex items-center gap-1"><UserCheck className="h-3.5 w-3.5" /><span className="hidden sm:inline"> Assumir</span></span>
              )}
            </button>
            <button
              onClick={handleParouResponder}
              disabled={parouResponderLoading}
              className="px-2 md:px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors disabled:opacity-50"
              title="Marcar como parou de responder"
            >
              <span className="flex items-center gap-1">⏳<span className="hidden sm:inline"> Parou responder</span></span>
            </button>
            <button
              onClick={handleToggleClose}
              disabled={closingLoading}
              className={cn(
                "px-2 md:px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50",
                closed
                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
              title={closed ? "Reabrir atendimento" : "Encerrar atendimento"}
            >
              {closed
                ? <span className="flex items-center gap-1">↻<span className="hidden sm:inline"> Reabrir</span></span>
                : <span className="flex items-center gap-1">✓<span className="hidden sm:inline"> Encerrar</span></span>}
            </button>
            <button
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="p-2 rounded-md hover:bg-gray-100 transition-colors text-gray-500"
              title={sidebarOpen ? "Fechar detalhes" : "Abrir detalhes do lead"}
              aria-label={sidebarOpen ? "Fechar detalhes" : "Abrir detalhes do lead"}
            >
              {sidebarOpen ? (
                <PanelRightClose className="h-5 w-5" />
              ) : (
                <PanelRightOpen className="h-5 w-5" />
              )}
            </button>
          </div>
        </header>

        {/* Barra de atribuição: setor + atendente */}
        <div className="bg-white border-b px-3 md:px-6 py-1.5 flex items-center gap-2 flex-shrink-0 text-xs">
          <span className="text-gray-400 hidden sm:inline">Fila:</span>
          <select
            value={sectorId}
            onChange={(e) => { const v = e.target.value; setSectorId(v); patchAssignment({ sectorId: v || null }); }}
            className="px-2 py-1 border border-gray-200 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#001A5E]/20"
            aria-label="Setor"
          >
            <option value="">Sem setor</option>
            {sectors.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </select>
          <span className="text-gray-400 hidden sm:inline">Atendente:</span>
          <select
            value={assignedUserId}
            onChange={(e) => { const v = e.target.value; setAssignedUserId(v); patchAssignment({ assignedUserId: v || null }); }}
            className="px-2 py-1 border border-gray-200 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#001A5E]/20"
            aria-label="Atendente"
          >
            <option value="">Não atribuído</option>
            {attendants.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
          </select>
        </div>

        {/* Aviso de atendimento: evita dois atendentes na mesma conversa.
            ponytail: reflete estado no load + ações próprias; cross-claim ao vivo fica p/ reload. */}
        {assignedUserId && (
          assignedUserId === currentUserId ? (
            <div className="bg-emerald-50 border-b border-emerald-100 px-3 md:px-6 py-1.5 text-xs text-emerald-700 flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5" /> Você está atendendo este cliente
            </div>
          ) : (
            <div className="bg-amber-50 border-b border-amber-200 px-3 md:px-6 py-1.5 text-xs text-amber-800 flex items-center gap-1.5 font-medium">
              <AlertTriangle className="h-3.5 w-3.5" />
              Em atendimento por {attendants.find((u) => u.id === assignedUserId)?.name || "outro atendente"} — evite responder junto
            </div>
          )
        )}

        {/* Tabs */}
        <div className="bg-white flex-shrink-0">
          <div className="flex border-b border-gray-200">
            {[
              { key: "conversa", label: "Conversa" },
              { key: "detalhes", label: "Detalhes" },
              { key: "anotacoes", label: "Anotações" },
              { key: "historico", label: "Histórico" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex-1 py-3 text-sm font-medium transition-colors relative",
                  activeTab === tab.key
                    ? "text-[#001A5E]"
                    : "text-gray-400 hover:text-gray-600"
                )}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#001A5E]" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab: Conversa */}
        {activeTab === "conversa" && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <InboxConversation
              conversationId={conversationId}
              initialMessages={initialMessages}
            />
            <ChatComposer conversationId={conversationId} onToast={showToast} />
          </div>
        )}

        {/* Tab: Detalhes */}
        {activeTab === "detalhes" && (
          <div className="flex-1 p-6 overflow-auto space-y-4">
            {/* Dados do Lead — editáveis */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-[#001A5E]" />
                <h3 className="font-semibold text-sm">Dados do Lead</h3>
              </div>
              <div className="space-y-3">
                {/* Nome */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 group">
                  <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-gray-400 uppercase tracking-wider">Nome</p>
                    {editingField === "name" ? (
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="flex-1 px-2 py-1 text-sm border rounded-md focus:ring-2 focus:ring-[#001A5E] focus:outline-none"
                          autoFocus
                          onKeyDown={(e) => e.key === "Enter" && saveField("name")}
                          aria-label="Editar nome"
                        />
                        <button onClick={() => saveField("name")} disabled={savingField} className="text-green-600 hover:text-green-700">
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => setEditingField(null)} className="text-gray-400 hover:text-gray-600">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm font-medium truncate">{lead.name || lead.pushName || "Não informado"}</p>
                    )}
                  </div>
                  {editingField !== "name" && (
                    <button onClick={() => startEditing("name", lead.name)} className="opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Editar nome">
                      <Pencil className="h-3.5 w-3.5 text-gray-400 hover:text-[#F9A825]" />
                    </button>
                  )}
                </div>

                {/* Telefone (somente leitura) */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                  <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-gray-400 uppercase tracking-wider">Telefone</p>
                    <p className="text-sm font-medium truncate">{lead.phone}</p>
                  </div>
                  <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                </div>

                {/* Email */}
                <div className={`flex items-center gap-3 p-3 rounded-lg group ${lead.email ? "bg-gray-50" : "bg-amber-50 border border-amber-200"}`}>
                  <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-gray-400 uppercase tracking-wider">Email</p>
                    {editingField === "email" ? (
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="email"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="flex-1 px-2 py-1 text-sm border rounded-md focus:ring-2 focus:ring-[#001A5E] focus:outline-none"
                          autoFocus
                          onKeyDown={(e) => e.key === "Enter" && saveField("email")}
                          aria-label="Editar email"
                        />
                        <button onClick={() => saveField("email")} disabled={savingField} className="text-green-600 hover:text-green-700">
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => setEditingField(null)} className="text-gray-400 hover:text-gray-600">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <p className={`text-sm font-medium truncate ${!lead.email ? "text-amber-600 italic" : ""}`}>
                        {lead.email || "Sulma irá solicitar..."}
                      </p>
                    )}
                  </div>
                  {editingField !== "email" && (
                    <button onClick={() => startEditing("email", lead.email)} className="opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Editar email">
                      <Pencil className="h-3.5 w-3.5 text-gray-400 hover:text-[#F9A825]" />
                    </button>
                  )}
                </div>

                {/* Cidade */}
                <div className={`flex items-center gap-3 p-3 rounded-lg group ${lead.city ? "bg-gray-50" : "bg-amber-50 border border-amber-200"}`}>
                  <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-gray-400 uppercase tracking-wider">Cidade</p>
                    {editingField === "city" ? (
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="flex-1 px-2 py-1 text-sm border rounded-md focus:ring-2 focus:ring-[#001A5E] focus:outline-none"
                          autoFocus
                          onKeyDown={(e) => e.key === "Enter" && saveField("city")}
                          aria-label="Editar cidade"
                        />
                        <button onClick={() => saveField("city")} disabled={savingField} className="text-green-600 hover:text-green-700">
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => setEditingField(null)} className="text-gray-400 hover:text-gray-600">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <p className={`text-sm font-medium truncate ${!lead.city ? "text-amber-600 italic" : ""}`}>
                        {lead.city || "Sulma irá solicitar..."}
                      </p>
                    )}
                  </div>
                  {editingField !== "city" && (
                    <button onClick={() => startEditing("city", lead.city)} className="opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Editar cidade">
                      <Pencil className="h-3.5 w-3.5 text-gray-400 hover:text-[#F9A825]" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Status e Score */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-sm mb-4">Status & Qualificação</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-1.5">Status do Lead</p>
                  <select
                    value={normalizeLeadStatus(lead.status)}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-white focus:ring-2 focus:ring-[#001A5E] focus:outline-none cursor-pointer"
                    aria-label="Alterar status do lead"
                  >
                    {FUNNEL_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {LEAD_STATUS_LABELS[status]}
                      </option>
                    ))}
                    <option value="AGUARDANDO_RESPOSTA">Aguardando resposta</option>
                    <option value="LEAD_FRIO">Lead frio</option>
                    <option value="PERDIDO">Perdido</option>
                  </select>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                  <div className="flex-1">
                    <p className="text-[11px] text-gray-400 uppercase tracking-wider">Atendimento</p>
                    <p className="text-sm font-medium">{lead.ownerType === "human" ? "Humano" : "Bot (Sulma)"}</p>
                  </div>
                  <button
                    onClick={handleHandoff}
                    disabled={handoffLoading}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50",
                      lead.ownerType === "human"
                        ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                        : "bg-purple-100 text-purple-700 hover:bg-purple-200"
                    )}
                  >
                    {lead.ownerType === "human" ? "Devolver p/ Sulma" : "Assumir"}
                  </button>
                </div>
                <div className="p-3 rounded-lg bg-gray-50">
                  <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-1.5">Lead Score</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#001A5E] to-[#F9A825] rounded-full transition-all"
                        style={{ width: `${Math.min((lead.leadScore / 1000) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-[#001A5E]">{lead.leadScore}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tags */}
            {lead.tags.length > 0 && (
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-sm mb-3">Tags</h3>
                <div className="flex flex-wrap gap-1.5">
                  {lead.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{ backgroundColor: tag.color + "20", color: tag.color }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Lembretes */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Bell className="h-4 w-4 text-[#001A5E]" />
                <h3 className="font-semibold text-sm">Lembretes</h3>
                {loadingReminders && (
                  <RefreshCw className="h-3 w-3 text-gray-400 animate-spin ml-auto" />
                )}
              </div>
              {reminders.length === 0 ? (
                <p className="text-sm text-gray-400 italic">
                  {loadingReminders ? "Carregando..." : "Nenhum lembrete agendado"}
                </p>
              ) : (
                <div className="space-y-2">
                  {reminders.map((rem) => {
                    const date = new Date(rem.scheduledAt);
                    const isPast = date < new Date();
                    const isEditing = editingReminder === rem.id;

                    if (isEditing) {
                      return (
                        <div key={rem.id} className="p-3 rounded-lg bg-blue-50 border border-blue-200 space-y-2">
                          <div>
                            <label htmlFor={`rem-date-${rem.id}`} className="block text-[11px] text-gray-500 uppercase tracking-wider mb-1">Data e Hora</label>
                            <input
                              id={`rem-date-${rem.id}`}
                              type="datetime-local"
                              value={editReminderDate}
                              onChange={(e) => setEditReminderDate(e.target.value)}
                              className="w-full px-2 py-1.5 text-sm border rounded-md focus:ring-2 focus:ring-[#001A5E] focus:outline-none"
                            />
                          </div>
                          <div>
                            <label htmlFor={`rem-note-${rem.id}`} className="block text-[11px] text-gray-500 uppercase tracking-wider mb-1">Nota</label>
                            <input
                              id={`rem-note-${rem.id}`}
                              type="text"
                              value={editReminderNote}
                              onChange={(e) => setEditReminderNote(e.target.value)}
                              placeholder="Nota do lembrete..."
                              className="w-full px-2 py-1.5 text-sm border rounded-md focus:ring-2 focus:ring-[#001A5E] focus:outline-none"
                            />
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => handleSaveReminder(rem.id)}
                              disabled={savingReminder || !editReminderDate}
                              className="flex-1 px-3 py-1.5 text-xs font-medium bg-[#001A5E] text-white rounded-lg hover:bg-[#003080] disabled:opacity-50 transition-colors"
                            >
                              {savingReminder ? "Salvando..." : "Salvar"}
                            </button>
                            <button
                              onClick={() => setEditingReminder(null)}
                              className="px-3 py-1.5 text-xs font-medium bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={rem.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg text-sm group",
                          isPast ? "bg-gray-50 opacity-70" : "bg-amber-50 border border-amber-200"
                        )}
                      >
                        <Clock className={cn("h-4 w-4 flex-shrink-0", isPast ? "text-gray-400" : "text-amber-500")} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">
                            {date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                            {" às "}
                            {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                          {rem.lastError && (
                            <p className="text-xs text-gray-500 truncate">{rem.lastError}</p>
                          )}
                        </div>
                        {isPast && (
                          <span className="text-[10px] text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full flex-shrink-0">Expirado</span>
                        )}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button
                            onClick={() => startEditingReminder(rem)}
                            className="p-1 rounded hover:bg-white/80 transition-colors"
                            title="Editar lembrete"
                            aria-label="Editar lembrete"
                          >
                            <Pencil className="h-3.5 w-3.5 text-gray-500 hover:text-[#F9A825]" />
                          </button>
                          <button
                            onClick={() => handleDeleteReminder(rem.id)}
                            className="p-1 rounded hover:bg-white/80 transition-colors"
                            title="Excluir lembrete"
                            aria-label="Excluir lembrete"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-gray-500 hover:text-red-500" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Anotações */}
        {activeTab === "anotacoes" && (
          <div className="flex-1 p-6 overflow-auto space-y-4">
            {/* Resumo automático da conversa */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-[#001A5E]" />
                <h3 className="font-semibold text-sm">Resumo da Conversa</h3>
                <span className="text-[10px] text-gray-400 ml-auto">Gerado automaticamente</span>
              </div>
              {lead.summary ? (
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {lead.summary}
                </p>
              ) : (
                <p className="text-sm text-gray-400 italic">
                  O resumo será gerado automaticamente conforme a conversa avança...
                </p>
              )}
            </div>

            {/* Notas manuais */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-sm mb-3">Notas do Atendente</h3>
              <textarea
                placeholder="Adicione notas sobre este lead..."
                className="w-full h-32 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#001A5E] text-sm"
                defaultValue=""
                aria-label="Notas manuais do lead"
              />
            </div>
          </div>
        )}

        {/* Tab: Histórico */}
        {activeTab === "historico" && (
          <div className="flex-1 p-6 overflow-auto">
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold mb-4">Histórico de Interações</h3>
              <p className="text-gray-500 text-sm">
                {initialMessages.length} mensagens trocadas
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Lead sidebar */}
      <LeadSidebar
        lead={lead}
        conversationId={conversationId}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onToast={showToast}
      />

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border min-w-[280px] max-w-[420px]",
              toast.type === "success" && "bg-green-50 border-green-200 text-green-800",
              toast.type === "error" && "bg-red-50 border-red-200 text-red-800",
              toast.type === "info" && "bg-blue-50 border-blue-200 text-blue-800"
            )}
          >
            {toast.type === "success" && <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />}
            {toast.type === "error" && <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />}
            {toast.type === "info" && <Info className="h-5 w-5 text-blue-500 flex-shrink-0" />}
            <p className="text-sm font-medium flex-1">{toast.message}</p>
            <button
              onClick={() => setToast(null)}
              className="p-0.5 rounded hover:bg-black/5 transition-colors flex-shrink-0"
              aria-label="Fechar notificação"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in zoom-in-95 fade-in duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <p className="text-sm font-medium text-gray-800">{confirmModal.message}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
                className="flex-1 px-4 py-2 text-sm font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
