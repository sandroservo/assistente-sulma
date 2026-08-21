/**
 * Alerta global: a Sulma pediu uma consultora. Aparece em qualquer tela do painel.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Headphones, X } from "lucide-react";

type HandoffAlert = {
  conversationId: string;
  leadId?: string;
  name: string;
  reason: string;
};

function playAlertSound() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.value = 0.08;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.18);
    const o2 = ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.value = 1174;
    o2.connect(g);
    o2.start(ctx.currentTime + 0.2);
    o2.stop(ctx.currentTime + 0.38);
  } catch {
    /* ignore */
  }
}

export function ConsultantAlertHost() {
  const router = useRouter();
  const pathname = usePathname();
  const [alert, setAlert] = useState<HandoffAlert | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => undefined);
    }
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/conversations/stream");
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as {
            type?: string;
            conversationId?: string;
            leadId?: string;
            name?: string;
            reason?: string;
          };
          if (data.type !== "handoff" || !data.conversationId) return;
          if (pathname?.startsWith(`/chats/${data.conversationId}`)) return;
          const next: HandoffAlert = {
            conversationId: data.conversationId,
            leadId: data.leadId,
            name: data.name || "Lead",
            reason: data.reason || "A Sulma pediu uma consultora",
          };
          setAlert(next);
          playAlertSound();
          if ("Notification" in window && Notification.permission === "granted") {
            try {
              const n = new Notification(`Consultor: ${next.name}`, {
                body: next.reason,
                tag: `handoff-${next.conversationId}`,
              });
              n.onclick = () => {
                window.focus();
                router.push(`/chats/${next.conversationId}`);
                n.close();
              };
            } catch {
              /* ignore */
            }
          }
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => setAlert(null), 20000);
        } catch {
          /* ignore */
        }
      };
    } catch {
      /* ignore */
    }
    return () => {
      es?.close();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pathname, router]);

  if (!alert) return null;

  return (
    <div className="fixed top-4 left-1/2 z-[80] w-[min(100%-1.5rem,420px)] -translate-x-1/2">
      <div
        role="alert"
        className="rounded-2xl border-2 border-[#FFD600] bg-[#001A5E] text-white shadow-2xl overflow-hidden"
      >
        <div className="flex items-start gap-3 px-4 py-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFD600] text-[#001A5E]">
            <Headphones className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#FFD600]">
              Precisa de consultor
            </p>
            <p className="truncate text-sm font-bold">{alert.name}</p>
            <p className="mt-0.5 line-clamp-2 text-xs text-white/80">{alert.reason}</p>
            <button
              type="button"
              onClick={() => {
                router.push(`/chats/${alert.conversationId}`);
                setAlert(null);
              }}
              className="mt-2 rounded-lg bg-[#FFD600] px-3 py-1.5 text-xs font-bold text-[#001A5E] hover:bg-[#ffe44d]"
            >
              Atender agora
            </button>
          </div>
          <button
            type="button"
            onClick={() => setAlert(null)}
            className="rounded-full p-1 text-white/70 hover:bg-white/10"
            aria-label="Fechar alerta"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
