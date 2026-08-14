"use client";

import { useCallback, useEffect, useState } from "react";
import type { ClienteVencido, ReminderTemplate } from "@/lib/amovidas-api";

interface Props {
  client: ClienteVencido;
  onClose: () => void;
  onSent: () => void;
}

const SIT_LABEL: Record<string, string> = {
  geral: "Geral",
  vencendo: "Vencendo",
  em_atraso: "Em atraso",
  inadimplente: "Inadimplente",
  pago: "Pago",
};

function situacaoFromDays(daysOverdue: number): string {
  if (daysOverdue >= 31) return "inadimplente";
  if (daysOverdue >= 1) return "em_atraso";
  return "vencendo";
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function SendReminderModal({ client, onClose, onSent }: Props) {
  const [templates, setTemplates] = useState<ReminderTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<number | "default">("default");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const situacao = situacaoFromDays(client.daysOverdue);
  const firstName = client.customerName?.split(" ")[0] || "Cliente";
  const fullName = client.customerName || "Cliente";
  const valor = formatCurrency(client.value);
  const vencimento = client.dueDate
    ? new Date(client.dueDate).toLocaleDateString("pt-BR")
    : "-";

  const renderVars = useCallback(
    (body: string) =>
      body
        .replace(/\{nome_completo\}/g, fullName)
        .replace(/\{nome\}/g, firstName)
        .replace(/\{valor\}/g, valor)
        .replace(/\{vencimento\}/g, vencimento)
        .replace(/\{plano\}/g, "AMO VIDAS")
        .replace(/\{link\}/g, ""),
    [fullName, firstName, valor, vencimento]
  );

  const defaultMessage = useCallback(() => {
    const atraso = situacao === "em_atraso" || situacao === "inadimplente";
    if (atraso) {
      return (
        `Olá ${firstName}!\n\n` +
        `*ATENÇÃO: Cobrança em atraso*\n\n` +
        `Sua mensalidade do *AMO VIDAS* está em aberto.\n\n` +
        `Valor: ${valor}\nVencimento: ${vencimento}\n\n` +
        `Regularize para manter seu plano ativo.\n\n*AMO VIDAS*`
      );
    }
    return (
      `Olá ${firstName}! 💳\n\n` +
      `Sua mensalidade do *AMO VIDAS* está próxima do vencimento.\n\n` +
      `Valor: ${valor}\nVencimento: ${vencimento}\n\n` +
      `Mantenha seu plano ativo!\n\n*AMO VIDAS*`
    );
  }, [firstName, valor, vencimento, situacao]);

  useEffect(() => {
    setMessage(defaultMessage());
  }, [defaultMessage]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/cobranca/reminder-templates?situation=${situacao}`);
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) setTemplates(data.templates || []);
      } catch {
        /* silencioso */
      }
    })();
  }, [situacao]);

  const onSelectTemplate = (val: string) => {
    if (val === "default") {
      setSelectedId("default");
      setMessage(defaultMessage());
      return;
    }
    const id = Number(val);
    setSelectedId(id);
    const t = templates.find((x) => x.id === id);
    if (t) setMessage(renderVars(t.body));
  };

  const send = async () => {
    if (!message.trim()) {
      setError("Mensagem vazia");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/cobranca/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: client.userId,
          asaasCustomerId: client.asaasCustomerId,
          message: message.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "Erro ao enviar");
      onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao enviar");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Enviar lembrete via WhatsApp</h3>
            <p className="text-sm text-gray-500">
              {fullName} · {valor} · vence {vencimento}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Situação: <span className="font-normal text-gray-500">{SIT_LABEL[situacao] || situacao}</span>
            </label>
            <select
              value={String(selectedId)}
              onChange={(e) => onSelectTemplate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#001A5E] focus:border-[#001A5E]"
            >
              <option value="default">Mensagem padrão</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} [{SIT_LABEL[t.situation] || t.situation}]
                </option>
              ))}
            </select>
            {templates.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">
                Nenhum modelo cadastrado para esta situação.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mensagem (edite antes de enviar)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={12}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono resize-y focus:ring-2 focus:ring-[#001A5E] focus:border-[#001A5E] whitespace-pre-wrap"
            />
            <p className="text-xs text-gray-400 mt-1">{message.length} caracteres</p>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>
          )}
        </div>

        <div className="px-5 py-4 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={send}
            disabled={sending || !message.trim()}
            className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {sending ? "Enviando..." : "Enviar WhatsApp"}
          </button>
        </div>
      </div>
    </div>
  );
}
