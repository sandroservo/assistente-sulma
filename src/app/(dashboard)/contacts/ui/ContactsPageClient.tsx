/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Componente cliente: lista de contatos com seleção múltipla
 * e disparo em massa via SSE com delay aleatório.
 */

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  X,
  Send,
  Image as ImageIcon,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  Radio,
  Trash2,
  Plus,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LEAD_STATUS_LABELS, normalizeLeadStatus } from "@/lib/lead-funnel";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Contact {
  id: string;
  name: string;
  phone: string;
  avatarUrl: string | null;
  status: string;
  category: string;
  leadScore: number;
  tags: Tag[];
  lastMessageAt: string | null;
}

interface BroadcastLog {
  contact: string;
  status: "ok" | "error" | "waiting";
  message?: string;
  instance?: string;
}

type BroadcastProfile = "conservative" | "balanced" | "aggressive";

type BroadcastInstance = {
  id: string;
  name: string;
  status: string;
  health?: { ok: boolean; reason?: string };
};

interface ContactsPageClientProps {
  contacts: Contact[];
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 13) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 12) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  return phone;
}

function getInitials(name: string, phone: string): string {
  if (name) {
    return name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
  }
  return phone.slice(-2);
}

const STATUS_LABELS = LEAD_STATUS_LABELS;

export function ContactsPageClient({ contacts }: ContactsPageClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterCategory, setFilterCategory] = useState<string>("todos");

  // Novo contato
  const [showNewContact, setShowNewContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", phone: "", email: "", category: "geral", notes: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Broadcast state
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastImage, setBroadcastImage] = useState<string | null>(null);
  const [broadcastImageName, setBroadcastImageName] = useState<string | null>(null);
  const [broadcastImageMime, setBroadcastImageMime] = useState<string>("image/jpeg");
  const [isSending, setIsSending] = useState(false);
  const [broadcastLogs, setBroadcastLogs] = useState<BroadcastLog[]>([]);
  const [broadcastProgress, setBroadcastProgress] = useState({ sent: 0, failed: 0, total: 0 });
  const [broadcastDone, setBroadcastDone] = useState(false);
  const [broadcastInstances, setBroadcastInstances] = useState<BroadcastInstance[]>([]);
  const [broadcastInstanceIds, setBroadcastInstanceIds] = useState<Set<string>>(new Set());
  const [broadcastProfile, setBroadcastProfile] = useState<BroadcastProfile>("balanced");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showBroadcast) return;
    fetch("/api/instances")
      .then((r) => r.json())
      .then((data) => {
        const list = (data.instances || []) as BroadcastInstance[];
        setBroadcastInstances(list);
        const connected = list.filter((i) => i.status === "CONNECTED").map((i) => i.id);
        setBroadcastInstanceIds(new Set(connected));
      })
      .catch(() => setBroadcastInstances([]));
  }, [showBroadcast]);

  // Filtro
  const filtered = contacts.filter((c) => {
    const matchSearch =
      !search ||
      (c.name || "").toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search);
    const matchStatus =
      filterStatus === "todos" ||
      c.status === filterStatus ||
      normalizeLeadStatus(c.status) === filterStatus;
    const matchCategory = filterCategory === "todos" || c.category === filterCategory;
    return matchSearch && matchStatus && matchCategory;
  });

  // Estatísticas únicas
  const statuses = [...new Set(contacts.map((c) => c.status))];
  const categories = [...new Set(contacts.map((c) => c.category))];

  // Seleção
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((c) => c.id)));
    }
  };

  // Imagem
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBroadcastImageName(file.name);
    setBroadcastImageMime(file.type || "image/jpeg");

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove o prefixo data:image/...;base64,
      setBroadcastImage(result.split(",")[1]);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const clearImage = () => {
    setBroadcastImage(null);
    setBroadcastImageName(null);
  };

  // Broadcast via SSE
  const startBroadcast = useCallback(async () => {
    const selected = contacts.filter((c) => selectedIds.has(c.id));
    if (!selected.length || !broadcastMessage.trim()) return;

    setIsSending(true);
    setBroadcastDone(false);
    setBroadcastLogs([]);
    setBroadcastProgress({ sent: 0, failed: 0, total: selected.length });

    try {
      const res = await fetch("/api/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contacts: selected.map((c) => ({
            phone: c.phone,
            name: c.name || c.phone,
          })),
          message: broadcastMessage,
          imageBase64: broadcastImage || undefined,
          imageMimeType: broadcastImageMime || undefined,
          instanceIds: [...broadcastInstanceIds],
          profile: broadcastProfile,
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setBroadcastLogs((prev) => [
          ...prev,
          { contact: "Sistema", status: "error", message: data.error || "Erro ao iniciar disparo" },
        ]);
        setIsSending(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.replace("data: ", ""));

            if (data.type === "progress") {
              setBroadcastProgress({
                sent: data.sent,
                failed: data.failed,
                total: data.total,
              });
              setBroadcastLogs((prev) => [
                ...prev,
                {
                  contact: data.contact,
                  status: data.status,
                  message: data.error,
                  instance: data.instance,
                },
              ]);
            } else if (data.type === "waiting") {
              setBroadcastLogs((prev) => [
                ...prev,
                {
                  contact: "⏳",
                  status: "waiting",
                  message: data.message,
                },
              ]);
            } else if (data.type === "done") {
              setBroadcastProgress({
                sent: data.sent,
                failed: data.failed,
                total: data.total,
              });
              setBroadcastDone(true);
            }

            // Auto-scroll logs
            setTimeout(() => {
              logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 50);
          } catch {
            // Ignore parse errors
          }
        }
      }
    } catch (error) {
      console.error("Broadcast error:", error);
      setBroadcastLogs((prev) => [
        ...prev,
        { contact: "Sistema", status: "error", message: "Conexão perdida" },
      ]);
    } finally {
      setIsSending(false);
    }
  }, [contacts, selectedIds, broadcastMessage, broadcastImage, broadcastImageMime, broadcastInstanceIds, broadcastProfile]);

  const handleSaveContact = useCallback(async () => {
    setSaveError(null);
    if (!newContact.name.trim() || !newContact.phone.trim()) {
      setSaveError("Nome e telefone são obrigatórios");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/contacts/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newContact),
      });

      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error || "Erro ao salvar contato");
        return;
      }

      setShowNewContact(false);
      setNewContact({ name: "", phone: "", email: "", category: "geral", notes: "" });
      router.refresh();
    } catch {
      setSaveError("Erro de conexão");
    } finally {
      setSaving(false);
    }
  }, [newContact, router]);

  const resetBroadcast = () => {
    setShowBroadcast(false);
    setBroadcastMessage("");
    setBroadcastImage(null);
    setBroadcastImageName(null);
    setBroadcastLogs([]);
    setBroadcastProgress({ sent: 0, failed: 0, total: 0 });
    setBroadcastDone(false);
    setSelectedIds(new Set());
  };

  return (
    <div className="p-4 pt-14 md:p-6 md:pt-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-4 md:mb-6 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-[#001A5E] to-[#003080] rounded-lg flex items-center justify-center shrink-0">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-800">Contatos</h1>
            <p className="text-gray-500 text-sm">
              {contacts.length} contatos | {selectedIds.size} selecionados
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => { setShowNewContact(true); setSaveError(null); }}
            variant="outline"
            className="border-[#9AADD4] text-[#001A5E] hover:bg-[#EEF2FF]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Contato
          </Button>

          {selectedIds.size > 0 && (
            <Button
              onClick={() => {
                setShowBroadcast(true);
                setBroadcastDone(false);
                setBroadcastLogs([]);
              }}
              className="bg-[#001A5E] hover:bg-[#003080] text-white"
            >
              <Radio className="w-4 h-4 mr-2" />
              Disparo em Massa ({selectedIds.size})
            </Button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-100 p-3 md:p-4 mb-4 flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#001A5E]/20 focus:border-[#001A5E] transition-colors"
            aria-label="Buscar contato"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#001A5E]/20 cursor-pointer"
            aria-label="Filtrar por status"
          >
            <option value="todos">Status</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s] || s}
              </option>
            ))}
          </select>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#001A5E]/20 cursor-pointer"
            aria-label="Filtrar por categoria"
          >
            <option value="todos">Categoria</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Selecionar todos */}
      <div className="bg-white rounded-t-xl border border-b-0 border-gray-100 px-4 py-2 flex items-center gap-3">
        <input
          type="checkbox"
          checked={filtered.length > 0 && selectedIds.size === filtered.length}
          onChange={toggleSelectAll}
          className="w-4 h-4 rounded border-gray-300 text-[#001A5E] focus:ring-[#001A5E] cursor-pointer"
          aria-label="Selecionar todos"
        />
        <span className="text-xs text-gray-500">
          {selectedIds.size > 0 ? `${selectedIds.size} selecionado(s)` : "Selecionar todos"}
        </span>
      </div>

      {/* Lista de contatos */}
      <div className="bg-white rounded-b-xl border border-t-0 border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Nenhum contato encontrado</p>
          </div>
        ) : (
          <div className="max-h-[calc(100vh-320px)] overflow-y-auto divide-y divide-gray-50">
            {filtered.map((contact) => (
              <label
                key={contact.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors",
                  selectedIds.has(contact.id) && "bg-[#EEF2FF]/60 hover:bg-[#EEF2FF]/60"
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(contact.id)}
                  onChange={() => toggleSelect(contact.id)}
                  className="w-4 h-4 rounded border-gray-300 text-[#001A5E] focus:ring-[#001A5E] cursor-pointer shrink-0"
                />

                {contact.avatarUrl ? (
                  <img
                    src={contact.avatarUrl}
                    alt={contact.name}
                    className="w-10 h-10 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#001A5E] to-[#F9A825] flex items-center justify-center text-white text-xs font-semibold shrink-0">
                    {getInitials(contact.name, contact.phone)}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-800 truncate">
                      {contact.name || formatPhone(contact.phone)}
                    </span>
                    <span className="text-xs text-gray-400 font-mono shrink-0 hidden sm:block">
                      {formatPhone(contact.phone)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="inline-flex px-2 py-0.5 text-[10px] font-medium rounded-full bg-gray-100 text-gray-600">
                      {STATUS_LABELS[contact.status] || contact.status}
                    </span>
                    {contact.leadScore > 0 && (
                      <span className="text-[10px] font-bold text-gray-500">
                        Score: {contact.leadScore}
                      </span>
                    )}
                    {contact.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color }}
                        title={tag.name}
                      />
                    ))}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Modal Novo Contato */}
      {showNewContact && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#001A5E] to-[#003080] flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-bold text-gray-800">Novo Contato</h2>
              </div>
              <button
                onClick={() => setShowNewContact(false)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="contact-name" className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  id="contact-name"
                  type="text"
                  value={newContact.name}
                  onChange={(e) => setNewContact((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Nome completo"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#001A5E]/20 focus:border-[#001A5E]"
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="contact-phone" className="block text-sm font-medium text-gray-700 mb-1">Telefone *</label>
                <input
                  id="contact-phone"
                  type="tel"
                  value={newContact.phone}
                  onChange={(e) => setNewContact((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="55999XXXXXXX"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#001A5E]/20 focus:border-[#001A5E]"
                />
              </div>

              <div>
                <label htmlFor="contact-email" className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                <input
                  id="contact-email"
                  type="email"
                  value={newContact.email}
                  onChange={(e) => setNewContact((p) => ({ ...p, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#001A5E]/20 focus:border-[#001A5E]"
                />
              </div>

              <div>
                <label htmlFor="contact-category" className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                <select
                  id="contact-category"
                  value={newContact.category}
                  onChange={(e) => setNewContact((p) => ({ ...p, category: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#001A5E]/20 focus:border-[#001A5E] bg-white"
                >
                  <option value="geral">Geral</option>
                  <option value="clinica">Clínica</option>
                  <option value="medico">Médico</option>
                  <option value="parceiro">Parceiro</option>
                  <option value="fornecedor">Fornecedor</option>
                  <option value="paciente">Paciente</option>
                </select>
              </div>

              <div>
                <label htmlFor="contact-notes" className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea
                  id="contact-notes"
                  value={newContact.notes}
                  onChange={(e) => setNewContact((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Anotações sobre o contato..."
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#001A5E]/20 focus:border-[#001A5E]"
                />
              </div>

              {saveError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                  {saveError}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowNewContact(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button
                onClick={handleSaveContact}
                disabled={saving || !newContact.name.trim() || !newContact.phone.trim()}
                className="bg-[#001A5E] hover:bg-[#003080] text-white"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</>
                ) : (
                  <><UserPlus className="w-4 h-4 mr-2" /> Salvar Contato</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Broadcast */}
      {showBroadcast && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
            {/* Header modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#001A5E] to-[#003080] flex items-center justify-center">
                  <Radio className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800">Disparo em Massa</h2>
                  <p className="text-xs text-gray-500">
                    {selectedIds.size} contatos selecionados | Intervalos dinâmicos
                  </p>
                </div>
              </div>
              <button
                onClick={resetBroadcast}
                disabled={isSending}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Composer */}
              {!isSending && !broadcastDone && (
                <>
                  <div>
                    <label htmlFor="broadcast-msg" className="block text-sm font-medium text-gray-700 mb-1">
                      Mensagem
                    </label>
                    <textarea
                      id="broadcast-msg"
                      value={broadcastMessage}
                      onChange={(e) => setBroadcastMessage(e.target.value)}
                      placeholder="Digite a mensagem que será enviada para todos os contatos selecionados..."
                      rows={5}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#001A5E]/20 focus:border-[#001A5E] text-sm"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      {broadcastMessage.length} caracteres
                    </p>
                  </div>

                  {/* Imagem */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Imagem (opcional)
                    </label>
                    {broadcastImage ? (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                        <ImageIcon className="w-5 h-5 text-[#001A5E] shrink-0" />
                        <span className="text-sm text-gray-700 flex-1 truncate">
                          {broadcastImageName}
                        </span>
                        <button
                          onClick={clearImage}
                          className="p-1 rounded-md hover:bg-gray-200 text-gray-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full p-4 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-[#F9A825] hover:text-[#F9A825] transition-colors"
                      >
                        <ImageIcon className="w-6 h-6 mx-auto mb-1" />
                        Clique para anexar uma imagem
                      </button>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Instâncias (escolha aleatória a cada envio)
                    </label>
                    {broadcastInstances.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        Nenhuma instância cadastrada.{" "}
                        <Link href="/settings" className="text-[#001A5E] font-medium hover:underline">
                          Criar em Configurações → Evolution
                        </Link>
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-36 overflow-y-auto border border-gray-200 rounded-xl p-3">
                        {broadcastInstances.map((inst) => {
                          const connected = inst.status === "CONNECTED";
                          return (
                            <label
                              key={inst.id}
                              className={cn(
                                "flex items-center gap-2 text-sm",
                                !connected && "opacity-50"
                              )}
                            >
                              <input
                                type="checkbox"
                                disabled={!connected}
                                checked={broadcastInstanceIds.has(inst.id)}
                                onChange={() => {
                                  setBroadcastInstanceIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(inst.id)) next.delete(inst.id);
                                    else next.add(inst.id);
                                    return next;
                                  });
                                }}
                                className="rounded border-gray-300"
                              />
                              <span className="flex-1">{inst.name}</span>
                              <span className="text-[11px] text-gray-400">
                                {connected ? "conectada" : inst.status.toLowerCase()}
                                {inst.health?.reason ? ` · ${inst.health.reason}` : ""}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div>
                    <label htmlFor="broadcast-profile" className="block text-sm font-medium text-gray-700 mb-1">
                      Perfil anti-bloqueio
                    </label>
                    <select
                      id="broadcast-profile"
                      value={broadcastProfile}
                      onChange={(e) => setBroadcastProfile(e.target.value as BroadcastProfile)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#001A5E]/20 focus:border-[#001A5E]"
                    >
                      <option value="conservative">Conservador — mais intervalo, menos volume</option>
                      <option value="balanced">Equilibrado — recomendado</option>
                      <option value="aggressive">Ágil — mais volume, mais risco</option>
                    </select>
                  </div>

                  {/* Aviso */}
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                    <strong>Anti-bloqueio Meta:</strong> cada mensagem sai de uma instância sorteada
                    (prioriza quem enviou menos). Há aquecimento em números novos, limites por hora/dia
                    e pausa automática se a Meta recusar. Não feche esta janela durante o disparo.
                  </div>
                </>
              )}

              {/* Progresso / Logs */}
              {(isSending || broadcastDone) && (
                <div className="space-y-4">
                  {/* Barra de progresso */}
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">
                        Progresso: {broadcastProgress.sent + broadcastProgress.failed} / {broadcastProgress.total}
                      </span>
                      <span className="text-gray-500">
                        <span className="text-green-600 font-medium">{broadcastProgress.sent} ok</span>
                        {broadcastProgress.failed > 0 && (
                          <> | <span className="text-red-500 font-medium">{broadcastProgress.failed} falha</span></>
                        )}
                      </span>
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#001A5E] to-[#003080] rounded-full transition-all duration-500"
                        style={{
                          width: `${broadcastProgress.total > 0
                            ? ((broadcastProgress.sent + broadcastProgress.failed) / broadcastProgress.total) * 100
                            : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Logs */}
                  <div className="bg-gray-50 rounded-xl border border-gray-200 max-h-60 overflow-y-auto">
                    <div className="p-3 space-y-1.5">
                      {broadcastLogs.map((log, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          {log.status === "ok" && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                          {log.status === "error" && <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                          {log.status === "waiting" && <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                          <span className={cn(
                            "truncate",
                            log.status === "ok" && "text-gray-700",
                            log.status === "error" && "text-red-600",
                            log.status === "waiting" && "text-amber-600"
                          )}>
                            {log.status === "waiting"
                              ? log.message
                              : `${log.contact}${log.instance ? ` · ${log.instance}` : ""}${log.message ? ` — ${log.message}` : ""}`}
                          </span>
                        </div>
                      ))}
                      <div ref={logsEndRef} />
                    </div>
                  </div>

                  {broadcastDone && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-center">
                      <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-green-700">
                        Disparo finalizado!
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        {broadcastProgress.sent} enviados com sucesso
                        {broadcastProgress.failed > 0 && `, ${broadcastProgress.failed} falharam`}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer modal */}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              {!isSending && !broadcastDone && (
                <>
                  <Button variant="outline" onClick={resetBroadcast}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={startBroadcast}
                    disabled={!broadcastMessage.trim() || broadcastInstanceIds.size === 0}
                    className="bg-[#001A5E] hover:bg-[#003080] text-white"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Iniciar Disparo
                  </Button>
                </>
              )}
              {isSending && (
                <Button disabled className="bg-gray-200 text-gray-500">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </Button>
              )}
              {broadcastDone && (
                <Button onClick={resetBroadcast} className="bg-[#001A5E] hover:bg-[#003080] text-white">
                  Fechar
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
