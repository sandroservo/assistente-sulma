/**
 * Menu Cobrança da Sulma.
 * Lista clientes vencidos/inadimplentes (do sistema Amo Vidas), permite filtrar,
 * conversar com o cliente (abre o chat), disparar cobrança e registrar observações.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Wallet,
  Search,
  RefreshCw,
  MessageCircle,
  Send,
  StickyNote,
  X,
  Phone,
  AlertTriangle,
} from "lucide-react";
import type { ClienteVencido, ObservacaoCobranca } from "@/lib/amovidas-api";
import SendReminderModal from "@/components/SendReminderModal";

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  em_negociacao: "Em negociação",
  prometeu_pagar: "Prometeu pagar",
  sem_resposta: "Sem resposta",
  pago: "Pago",
  perdido: "Perdido",
};

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-gray-100 text-gray-700",
  em_negociacao: "bg-blue-100 text-blue-700",
  prometeu_pagar: "bg-amber-100 text-amber-700",
  sem_resposta: "bg-purple-100 text-purple-700",
  pago: "bg-green-100 text-green-700",
  perdido: "bg-red-100 text-red-700",
};

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function formatDate(d?: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("pt-BR");
}

export default function CobrancaPage() {
  const router = useRouter();
  const [clients, setClients] = useState<ClienteVencido[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [days, setDays] = useState("all");
  const [minValue, setMinValue] = useState("");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const PER_PAGE = 10;
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Modal de lembrete por situação
  const [reminderClient, setReminderClient] = useState<ClienteVencido | null>(null);

  // Modal de observações
  const [noteClient, setNoteClient] = useState<ClienteVencido | null>(null);
  const [notes, setNotes] = useState<ObservacaoCobranca[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [newNoteStatus, setNewNoteStatus] = useState("pendente");
  const [savingNote, setSavingNote] = useState(false);

  const notify = (type: "ok" | "err", text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const clientKey = (c: ClienteVencido) =>
    c.userId ? `u${c.userId}` : `c${c.asaasCustomerId || c.phone}`;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (days !== "all") params.set("days", days);
      if (minValue) params.set("minValue", minValue);
      if (status !== "all") params.set("status", status);
      if (debouncedSearch) params.set("search", debouncedSearch);
      params.set("page", String(page));
      params.set("limit", String(PER_PAGE));

      const res = await fetch(`/api/cobranca?${params}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Erro ao carregar cobranças");
      }
      setClients(data.clients || []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, [days, minValue, status, debouncedSearch, page]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Volta pra página 1 ao mudar qualquer filtro
  useEffect(() => {
    setPage(1);
  }, [days, minValue, status, debouncedSearch]);

  const conversar = async (c: ClienteVencido) => {
    if (!c.phone) {
      notify("err", "Cliente sem telefone");
      return;
    }
    setBusyKey(`chat-${clientKey(c)}`);
    try {
      const res = await fetch("/api/cobranca/open-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: c.phone, name: c.customerName }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Erro ao abrir conversa");
      router.push(`/chats/${data.conversationId}`);
    } catch (e) {
      notify("err", e instanceof Error ? e.message : "Erro ao abrir conversa");
    } finally {
      setBusyKey(null);
    }
  };

  const cobrar = (c: ClienteVencido) => {
    if (!c.phone) {
      notify("err", "Cliente sem telefone");
      return;
    }
    setReminderClient(c);
  };

  const openNotes = async (c: ClienteVencido) => {
    setNoteClient(c);
    setNotes([]);
    setNewNote("");
    setNewNoteStatus(c.status || "pendente");
    setNotesLoading(true);
    try {
      const params = new URLSearchParams();
      if (c.userId) params.set("user_id", String(c.userId));
      else if (c.asaasCustomerId) params.set("asaas_customer_id", c.asaasCustomerId);
      const res = await fetch(`/api/cobranca/note?${params}`);
      const data = await res.json();
      if (res.ok && data.ok) setNotes(data.notes || []);
    } catch {
      notify("err", "Erro ao carregar observações");
    } finally {
      setNotesLoading(false);
    }
  };

  const saveNote = async () => {
    if (!noteClient || !newNote.trim()) {
      notify("err", "Escreva uma observação");
      return;
    }
    setSavingNote(true);
    try {
      const res = await fetch("/api/cobranca/note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: noteClient.userId,
          asaasCustomerId: noteClient.asaasCustomerId,
          asaasPaymentId: noteClient.asaasPaymentId,
          note: newNote.trim(),
          status: newNoteStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Erro ao salvar");
      notify("ok", "Observação registrada");
      setNewNote("");
      if (data.note) setNotes((prev) => [data.note, ...prev]);
      // Atualiza status/última obs na linha
      setClients((prev) =>
        prev.map((c) =>
          clientKey(c) === clientKey(noteClient)
            ? { ...c, status: newNoteStatus, lastNote: data.note?.note ?? c.lastNote }
            : c
        )
      );
    } catch (e) {
      notify("err", e instanceof Error ? e.message : "Erro ao salvar observação");
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 md:pl-6 pl-14">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#001A5E]/10 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-[#001A5E]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Cobrança</h1>
            <p className="text-sm text-gray-500">
              Clientes vencidos e inadimplentes · {total} encontrado(s)
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, telefone ou e-mail"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#001A5E] focus:border-[#001A5E]"
            />
          </div>

          <select
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="all">Todos os dias</option>
            <option value="1-7">1 a 7 dias</option>
            <option value="8-30">8 a 30 dias</option>
            <option value="31+">31+ dias</option>
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="all">Todos os status</option>
            {Object.entries(STATUS_LABELS).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>

          <input
            type="number"
            value={minValue}
            onChange={(e) => setMinValue(e.target.value)}
            placeholder="Valor mín."
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-28"
          />

          <button
            onClick={fetchClients}
            disabled={loading}
            className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-50"
            title="Atualizar"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Lista */}
        {error ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <p className="text-gray-700 font-medium">{error}</p>
            <p className="text-sm text-gray-500 mt-1">
              Verifique a conexão com o sistema Amo Vidas e o token do agente.
            </p>
          </div>
        ) : loading ? (
          <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
            Carregando...
          </div>
        ) : clients.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <AlertTriangle className="w-10 h-10 text-green-500 mx-auto mb-3" />
            <p className="text-gray-600">Nenhum cliente vencido encontrado</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vencimento</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dias</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {clients.map((c) => {
                    const k = clientKey(c);
                    return (
                      <tr key={k} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 text-sm">{c.customerName}</div>
                          {c.phone ? (
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {c.phone}
                            </div>
                          ) : (
                            <div className="text-xs text-amber-600">Sem telefone</div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-red-600">
                          {formatCurrency(c.value)}
                          {c.chargesCount && c.chargesCount > 1 && (
                            <div className="text-xs font-normal text-gray-500">
                              {c.chargesCount} cobranças
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatDate(c.dueDate)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              c.daysOverdue >= 31
                                ? "bg-red-100 text-red-700"
                                : c.daysOverdue >= 8
                                ? "bg-orange-100 text-orange-700"
                                : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {c.daysOverdue} dias
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              STATUS_COLORS[c.status || "pendente"]
                            }`}
                          >
                            {STATUS_LABELS[c.status || "pendente"]}
                          </span>
                          {c.lastNote && (
                            <div
                              className="text-xs text-gray-400 max-w-[180px] truncate mt-0.5"
                              title={c.lastNote}
                            >
                              {c.lastNote}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => conversar(c)}
                              disabled={!c.phone || busyKey === `chat-${k}`}
                              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#001A5E] bg-[#001A5E]/10 rounded hover:bg-[#001A5E]/20 disabled:opacity-40"
                              title="Conversar no WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              Conversar
                            </button>
                            <button
                              onClick={() => cobrar(c)}
                              disabled={!c.phone}
                              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded hover:bg-green-200 disabled:opacity-40"
                              title="Enviar lembrete de cobrança"
                            >
                              <Send className="w-3.5 h-3.5" />
                              Cobrar
                            </button>
                            <button
                              onClick={() => openNotes(c)}
                              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                              title="Observações"
                            >
                              <StickyNote className="w-3.5 h-3.5" />
                              Obs
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="px-4 py-3 border-t flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  Página {page} de {totalPages} · {total} cliente(s)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1 border rounded text-sm disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="px-3 py-1 border rounded text-sm disabled:opacity-50"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de lembrete por situação */}
      {reminderClient && (
        <SendReminderModal
          client={reminderClient}
          onClose={() => setReminderClient(null)}
          onSent={() => {
            setReminderClient(null);
            notify("ok", "Lembrete enviado via WhatsApp!");
          }}
        />
      )}

      {/* Toast */}
      {feedback && (
        <div
          className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm text-white ${
            feedback.type === "ok" ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Modal de observações */}
      {noteClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setNoteClient(null)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Observações de cobrança</h3>
                <p className="text-sm text-gray-500">{noteClient.customerName}</p>
              </div>
              <button
                onClick={() => setNoteClient(null)}
                className="text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 border-b space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status do contato
                </label>
                <select
                  value={newNoteStatus}
                  onChange={(e) => setNewNoteStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                >
                  {Object.entries(STATUS_LABELS).map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nova observação
                </label>
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  rows={3}
                  placeholder="Ex: cliente disse que paga até sexta..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none focus:ring-2 focus:ring-[#001A5E] focus:border-[#001A5E]"
                />
              </div>
              <button
                onClick={saveNote}
                disabled={savingNote || !newNote.trim()}
                className="w-full px-4 py-2 bg-[#001A5E] text-white rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {savingNote ? "Salvando..." : "Registrar observação"}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <p className="text-xs font-medium text-gray-400 uppercase mb-3">Histórico</p>
              {notesLoading ? (
                <div className="text-sm text-gray-500 text-center py-4">Carregando...</div>
              ) : notes.length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-4">
                  Nenhuma observação registrada
                </div>
              ) : (
                <ul className="space-y-3">
                  {notes.map((n) => (
                    <li key={n.id} className="border-l-2 border-gray-200 pl-3">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            STATUS_COLORS[n.status] || STATUS_COLORS.pendente
                          }`}
                        >
                          {STATUS_LABELS[n.status] || n.status}
                        </span>
                        <span className="text-xs text-gray-400">
                          {n.author_name || (n.author_source === "admin" ? "Admin" : "Sulma")}
                          {" · "}
                          {new Date(n.created_at).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{n.note}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
