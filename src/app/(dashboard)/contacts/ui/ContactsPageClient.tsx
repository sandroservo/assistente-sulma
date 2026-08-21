/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Lista de contatos com seleção e disparo em massa em segundo plano.
 */

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  X,
  Send,
  Loader2,
  Users,
  Radio,
  Plus,
  UserPlus,
  FileSpreadsheet,
  Download,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LEAD_STATUS_LABELS, normalizeLeadStatus } from "@/lib/lead-funnel";
import { saveActiveRunId } from "./BroadcastDock";

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

  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    created: number;
    skipped: number;
    total: number;
    errors: Array<{ row: number; name?: string; phone?: string; error: string }>;
  } | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Disparo em background
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string; message: string; status: string }>>([]);
  const [campaignId, setCampaignId] = useState("");
  const [recipientSource, setRecipientSource] = useState<"selected" | "sheet">("selected");
  const [sheetFile, setSheetFile] = useState<File | null>(null);
  const [startingBroadcast, setStartingBroadcast] = useState(false);
  const [broadcastError, setBroadcastError] = useState<string | null>(null);
  const sheetInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showBroadcast) return;
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((data) => {
        const list = (data.campaigns || []) as Array<{ id: string; name: string; message: string; status: string }>;
        setCampaigns(list);
        setCampaignId((prev) => prev || list[0]?.id || "");
      })
      .catch(() => setCampaigns([]));
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

  const startBroadcast = useCallback(async () => {
    setBroadcastError(null);
    if (!campaignId) {
      setBroadcastError("Escolha uma campanha.");
      return;
    }
    if (recipientSource === "selected" && selectedIds.size === 0) {
      setBroadcastError("Selecione os contatos na lista ou importe uma planilha.");
      return;
    }
    if (recipientSource === "sheet" && !sheetFile) {
      setBroadcastError("Selecione a planilha com os leads.");
      return;
    }

    setStartingBroadcast(true);
    try {
      const body = new FormData();
      body.append("campaignId", campaignId);
      body.append("source", recipientSource);
      if (recipientSource === "sheet" && sheetFile) {
        body.append("file", sheetFile);
      } else {
        const selected = contacts.filter((c) => selectedIds.has(c.id));
        body.append(
          "contacts",
          JSON.stringify(selected.map((c) => ({ phone: c.phone, name: c.name || c.phone })))
        );
      }
      const res = await fetch("/api/broadcast", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBroadcastError(data.error || "Não foi possível iniciar o disparo.");
        return;
      }
      saveActiveRunId(data.runId);
      setShowBroadcast(false);
      setSheetFile(null);
      setBroadcastError(null);
    } catch {
      setBroadcastError("Erro de conexão ao iniciar o disparo.");
    } finally {
      setStartingBroadcast(false);
    }
  }, [campaignId, recipientSource, sheetFile, selectedIds, contacts]);

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

  const resetImport = () => {
    setShowImport(false);
    setImportFile(null);
    setImportError(null);
    setImportResult(null);
    if (importInputRef.current) importInputRef.current.value = "";
  };

  const handleImport = useCallback(async () => {
    if (!importFile) {
      setImportError("Selecione o arquivo Excel ou CSV.");
      return;
    }
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const body = new FormData();
      body.append("file", importFile);
      const res = await fetch("/api/contacts/import", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImportError(data.error || "Erro ao importar a planilha.");
        return;
      }
      setImportResult({
        created: data.created ?? 0,
        skipped: data.skipped ?? 0,
        total: data.total ?? 0,
        errors: data.errors ?? [],
      });
      if ((data.created ?? 0) > 0) router.refresh();
    } catch {
      setImportError("Erro de conexão ao importar.");
    } finally {
      setImporting(false);
    }
  }, [importFile, router]);

  const resetBroadcast = () => {
    setShowBroadcast(false);
    setBroadcastError(null);
    setSheetFile(null);
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

        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => { setShowImport(true); setImportError(null); setImportResult(null); }}
            variant="outline"
            className="border-[#9AADD4] text-[#001A5E] hover:bg-[#EEF2FF]"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Importar Excel
          </Button>
          <Button
            onClick={() => { setShowNewContact(true); setSaveError(null); }}
            variant="outline"
            className="border-[#9AADD4] text-[#001A5E] hover:bg-[#EEF2FF]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Contato
          </Button>

          <Button
            onClick={() => {
              setShowBroadcast(true);
              setBroadcastError(null);
              setRecipientSource(selectedIds.size > 0 ? "selected" : "sheet");
            }}
            className="bg-[#001A5E] hover:bg-[#003080] text-white"
          >
            <Radio className="w-4 h-4 mr-2" />
            Disparo em Massa{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
          </Button>
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

      {/* Modal Importar Excel */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#001A5E] to-[#003080] flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800">Importar Excel</h2>
                  <p className="text-xs text-gray-500">Baixe o modelo, preencha e envie a planilha</p>
                </div>
              </div>
              <button
                onClick={resetImport}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <a
                href="/api/contacts/import/template"
                className="flex items-center justify-between gap-3 rounded-xl border border-[#9AADD4] bg-[#EEF2FF] px-4 py-3 text-sm text-[#001A5E] hover:bg-[#E0E7FF] transition-colors"
              >
                <span className="flex items-center gap-2 font-medium">
                  <Download className="w-4 h-4" />
                  Baixar modelo Excel
                </span>
                <span className="text-xs text-[#001A5E]/70">modelo-contatos-sulma.xlsx</span>
              </a>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Arquivo (.xlsx, .xls ou .csv)</label>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  onChange={(e) => {
                    setImportFile(e.target.files?.[0] ?? null);
                    setImportError(null);
                    setImportResult(null);
                  }}
                  className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#001A5E] file:text-white hover:file:bg-[#003080] file:cursor-pointer"
                />
                {importFile && (
                  <p className="mt-1.5 text-xs text-gray-500 truncate">{importFile.name}</p>
                )}
              </div>

              <p className="text-xs text-gray-500 leading-relaxed">
                Colunas obrigatórias: <strong>nome</strong> e <strong>telefone</strong>. Telefones já cadastrados são ignorados.
              </p>

              {importError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                  {importError}
                </div>
              )}

              {importResult && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2 text-sm">
                  <p className="font-semibold text-gray-800">Importação concluída</p>
                  <p className="text-green-700">{importResult.created} criado(s)</p>
                  <p className="text-gray-600">{importResult.skipped} já existiam (ignorados)</p>
                  {importResult.errors.length > 0 && (
                    <div className="pt-2 border-t border-gray-200">
                      <p className="text-red-600 font-medium mb-1">{importResult.errors.length} linha(s) com erro</p>
                      <ul className="max-h-32 overflow-y-auto space-y-1 text-xs text-red-700">
                        {importResult.errors.slice(0, 30).map((err, i) => (
                          <li key={i}>
                            Linha {err.row}: {err.name || err.phone || "—"} — {err.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <Button variant="outline" onClick={resetImport} disabled={importing}>
                {importResult ? "Fechar" : "Cancelar"}
              </Button>
              {!importResult && (
                <Button
                  onClick={handleImport}
                  disabled={importing || !importFile}
                  className="bg-[#001A5E] hover:bg-[#003080] text-white"
                >
                  {importing ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importando...</>
                  ) : (
                    <><Upload className="w-4 h-4 mr-2" /> Importar</>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

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

      {/* Modal: só para escolher campanha e destinatários — o envio roda fora */}
      {showBroadcast && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#001A5E] to-[#003080] flex items-center justify-center">
                  <Radio className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800">Disparo em Massa</h2>
                  <p className="text-xs text-gray-500">Entra na sua fila. O WhatsApp envia uma mensagem por vez, revezando com os outros usuários.</p>
                </div>
              </div>
              <button onClick={resetBroadcast} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600" aria-label="Fechar">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label htmlFor="broadcast-campaign" className="block text-sm font-medium text-gray-700 mb-1">Campanha</label>
                {campaigns.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Nenhuma campanha criada.{" "}
                    <Link href="/campaigns" className="text-[#001A5E] font-medium hover:underline">Criar em Campanhas</Link>
                  </p>
                ) : (
                  <>
                    <select
                      id="broadcast-campaign"
                      value={campaignId}
                      onChange={(e) => setCampaignId(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#001A5E]/20"
                    >
                      {campaigns.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    {campaigns.find((c) => c.id === campaignId)?.message && (
                      <p className="mt-2 text-xs text-gray-500 line-clamp-3 bg-gray-50 rounded-lg p-2">
                        {campaigns.find((c) => c.id === campaignId)?.message}
                      </p>
                    )}
                  </>
                )}
              </div>

              <div>
                <p className="block text-sm font-medium text-gray-700 mb-2">Destinatários</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRecipientSource("selected")}
                    className={cn(
                      "rounded-xl border px-3 py-3 text-left text-sm",
                      recipientSource === "selected" ? "border-[#001A5E] bg-[#EEF2FF]" : "border-gray-200 hover:bg-gray-50"
                    )}
                  >
                    <span className="font-medium text-gray-800">Contatos selecionados</span>
                    <span className="block text-xs text-gray-500 mt-0.5">{selectedIds.size} na lista</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecipientSource("sheet")}
                    className={cn(
                      "rounded-xl border px-3 py-3 text-left text-sm",
                      recipientSource === "sheet" ? "border-[#001A5E] bg-[#EEF2FF]" : "border-gray-200 hover:bg-gray-50"
                    )}
                  >
                    <span className="font-medium text-gray-800">Planilha de leads</span>
                    <span className="block text-xs text-gray-500 mt-0.5">Importar Excel/CSV só para este disparo</span>
                  </button>
                </div>
              </div>

              {recipientSource === "sheet" && (
                <div className="space-y-2">
                  <a href="/api/contacts/import/template" className="inline-flex items-center gap-1.5 text-xs font-medium text-[#001A5E] hover:underline">
                    <Download className="w-3.5 h-3.5" /> Baixar modelo Excel
                  </a>
                  <input
                    ref={sheetInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => setSheetFile(e.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#001A5E] file:text-white"
                  />
                  {sheetFile && <p className="text-xs text-gray-500 truncate">{sheetFile.name}</p>}
                </div>
              )}

              <p className="text-xs text-gray-500 leading-relaxed">
                Ao iniciar, o modal fecha e você pode usar o sistema. O painel no canto mostra quem já recebeu.
              </p>

              {broadcastError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">{broadcastError}</div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <Button variant="outline" onClick={resetBroadcast} disabled={startingBroadcast}>Cancelar</Button>
              <Button
                onClick={startBroadcast}
                disabled={startingBroadcast || !campaignId}
                className="bg-[#001A5E] hover:bg-[#003080] text-white"
              >
                {startingBroadcast ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Iniciando...</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" /> Disparar em segundo plano</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
