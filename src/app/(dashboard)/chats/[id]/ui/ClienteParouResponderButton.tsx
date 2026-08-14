/**
 * Ação "Cliente parou de responder": marca lead como Aguardando resposta
 * e agenda follow-ups (lembretes em 24h, 48h, 72h, 120h).
 */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircleOff, Loader2 } from "lucide-react";

interface ClienteParouResponderButtonProps {
  leadId: string;
  conversationId: string;
  className?: string;
  onToast?: (message: string, type: "success" | "error" | "info") => void;
}

export default function ClienteParouResponderButton({
  leadId,
  conversationId,
  className,
  onToast,
}: ClienteParouResponderButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/followups/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, conversationId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onToast?.(data.error ?? "Erro ao agendar", "error");
        return;
      }
      if (data.message === "followups already scheduled") {
        onToast?.("Já existem lembretes agendados para este lead.", "info");
      } else {
        onToast?.("Lead marcado como Aguardando resposta. Lembretes agendados.", "success");
      }
      window.location.reload();
    } catch (error) {
      console.error("Erro:", error);
      onToast?.("Erro ao marcar cliente parou de responder", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      className={className ?? "w-full"}
      onClick={handleClick}
      disabled={loading}
      title="Marcar como cliente parou de responder e agendar lembretes"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <MessageCircleOff className="h-4 w-4 mr-2" />
      )}
      Cliente parou de responder
    </Button>
  );
}
