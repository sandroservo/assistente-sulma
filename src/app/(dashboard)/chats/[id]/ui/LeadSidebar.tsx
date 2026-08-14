/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Sidebar direita do inbox — informações do lead, score, tags e ações
 */

"use client";

import { useState } from "react";
import {
  X,
  Phone,
  Mail,
  MapPin,
  Bot,
  UserCheck,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import HandoffButton from "./HandoffButton";
import ClienteParouResponderButton from "./ClienteParouResponderButton";
import LeadActions from "./LeadActions";
import { LeadAvatar } from "@/components/LeadAvatar";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface LeadSidebarProps {
  lead: {
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
    tags: Tag[];
  };
  conversationId: string;
  isOpen: boolean;
  onClose: () => void;
  onToast?: (message: string, type: "success" | "error" | "info") => void;
}

function getScoreLabel(score: number) {
  if (score >= 800) return { label: "Muito quente", emoji: "🔥🔥", color: "bg-red-500" };
  if (score >= 600) return { label: "Quente", emoji: "🔥", color: "bg-orange-500" };
  if (score >= 400) return { label: "Morno", emoji: "🌡️", color: "bg-yellow-500" };
  if (score >= 200) return { label: "Frio", emoji: "❄️", color: "bg-blue-400" };
  return { label: "Muito frio", emoji: "🥶", color: "bg-gray-400" };
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    NOVO: "Novo",
    EM_ATENDIMENTO: "Em Atendimento",
    CONSCIENTIZADO: "Conscientizado",
    QUALIFICADO: "Qualificado",
    LEAD_FRIO: "Lead Frio",
    PROPOSTA_ENVIADA: "Proposta Enviada",
    EM_NEGOCIACAO: "Em Negociação",
    AGUARDANDO_RESPOSTA: "Aguardando Resposta",
    FECHADO: "Fechado",
    PERDIDO: "Perdido",
    HUMANO_SOLICITADO: "Aguardando Humano",
    HUMANO_EM_ATENDIMENTO: "Humano Atendendo",
  };
  return map[status] || status;
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

export default function LeadSidebar({
  lead,
  conversationId,
  isOpen,
  onClose,
  onToast,
}: LeadSidebarProps) {
  const scoreInfo = getScoreLabel(lead.leadScore);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 md:relative md:inset-auto md:z-auto flex">
      {/* Backdrop mobile */}
      <div className="flex-1 bg-black/40 md:hidden" onClick={onClose} />
    <div className="w-[300px] md:w-[320px] min-w-[300px] md:min-w-[320px] border-l bg-white flex flex-col h-full overflow-y-auto ml-auto md:ml-0">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-gray-50/80 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Detalhes do Lead</h3>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-gray-200 transition-colors"
          aria-label="Fechar painel de detalhes"
        >
          <X className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      {/* Profile */}
      <div className="px-4 py-5 flex flex-col items-center text-center">
        <LeadAvatar
          leadId={lead.id}
          avatarUrl={lead.avatarUrl}
          name={lead.name || lead.pushName}
          phone={lead.phone}
          size="lg"
          className="mb-3"
        />
        <h3 className="text-base font-semibold text-gray-900">
          {lead.name || lead.pushName || "Sem nome"}
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">{lead.phone}</p>

        <div className="flex items-center gap-2 mt-2">
          <Badge variant="outline" className="text-xs">
            {getStatusLabel(lead.status)}
          </Badge>
          <div className={cn(
            "flex items-center gap-1 text-xs px-2 py-0.5 rounded-full",
            lead.ownerType === "human"
              ? "bg-green-100 text-green-700"
              : "bg-blue-100 text-blue-700"
          )}>
            {lead.ownerType === "human" ? (
              <><UserCheck className="h-3 w-3" /> Humano</>
            ) : (
              <><Bot className="h-3 w-3" /> Sulma</>
            )}
          </div>
        </div>
      </div>

      <Separator />

      {/* Lead Score */}
      {lead.leadScore > 0 && (
        <>
          <div className="px-4 py-3">
            <p className="text-xs font-medium text-gray-500 mb-2">Lead Score</p>
            <div className="flex items-center gap-3">
              <div className={cn(
                "text-lg font-bold px-3 py-1 rounded-lg text-white",
                scoreInfo.color
              )}>
                {lead.leadScore}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {scoreInfo.emoji} {scoreInfo.label}
                </p>
                <p className="text-[11px] text-gray-400">de 1.000 pontos</p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", scoreInfo.color)}
                style={{ width: `${Math.min(100, lead.leadScore / 10)}%` }}
              />
            </div>
          </div>
          <Separator />
        </>
      )}

      {/* Contact info */}
      <div className="px-4 py-3 space-y-2">
        <p className="text-xs font-medium text-gray-500 mb-1">Contato</p>
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <Phone className="h-3.5 w-3.5 text-gray-400" />
          <span>{lead.phone}</span>
        </div>
        {lead.email && (
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <Mail className="h-3.5 w-3.5 text-gray-400" />
            <span>{lead.email}</span>
          </div>
        )}
        {lead.city && (
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <MapPin className="h-3.5 w-3.5 text-gray-400" />
            <span>{lead.city}</span>
          </div>
        )}
      </div>

      <Separator />

      {/* Actions */}
      <div className="px-4 py-3 space-y-2">
        <HandoffButton
          leadId={lead.id}
          isHuman={lead.ownerType === "human"}
          onToast={onToast}
        />
        <ClienteParouResponderButton
          leadId={lead.id}
          conversationId={conversationId}
          onToast={onToast}
        />
      </div>

      <Separator />

      {/* Lead Actions (name, reminders, tags) */}
      <div className="px-4 py-3">
        <LeadActions
          leadId={lead.id}
          leadName={lead.name}
          leadTags={lead.tags}
          organizationId={lead.organizationId}
        />
      </div>

      {/* Summary */}
      {lead.summary && (
        <>
          <Separator />
          <div className="px-4 py-3">
            <p className="text-xs font-medium text-gray-500 mb-1">Resumo da Sulma</p>
            <p className="text-sm text-gray-600 leading-relaxed">{lead.summary}</p>
          </div>
        </>
      )}
    </div>
    </div>
  );
}
