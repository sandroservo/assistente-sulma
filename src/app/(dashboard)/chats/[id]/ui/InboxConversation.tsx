/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Lista de mensagens da conversa estilo WhatsApp com polling
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, Image as ImageIcon, FileText, Video, Bot, UserCheck, Reply, Pencil, Check, Contact, MessageSquare, Phone, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { formatPhone } from "@/lib/formatters";

const POLLING_INTERVAL = 15000;

interface Message {
  id: string;
  body: string | null;
  type: string;
  mediaUrl?: string | null;
  transcription?: string | null;
  direction: "in" | "out";
  createdAt: Date | string;
  sentByUserName?: string | null;
  providerId?: string | null;
  quotedMessageId?: string | null;
  status?: string | null;
  editedAt?: string | null;
  source?: string | null;
  sourceLabel?: string | null;
}

interface InboxConversationProps {
  conversationId: string;
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
    source?: string | null;
    sourceLabel?: string | null;
  }>;
  leadName?: string;
  leadPhone?: string;
  contactName?: string;
}

function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDateSeparator(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function shouldShowDateSeparator(
  current: Message,
  previous: Message | null
): boolean {
  if (!previous) return true;
  const currDate = new Date(current.createdAt).toDateString();
  const prevDate = new Date(previous.createdAt).toDateString();
  return currDate !== prevDate;
}

function ReadReceipt({ isOut, status }: { isOut: boolean; status?: string | null }) {
  if (!isOut) return null;
  const isRead = status === "read";
  const isDelivered = status === "delivered" || isRead;
  const fillColor = isRead ? "#53bdeb" : isDelivered ? "#8696a0" : "#8696a0";

  if (!isDelivered && status !== "delivered" && status !== "read") {
    return (
      <svg viewBox="0 0 12 11" width="12" height="11" className="inline-block ml-1 flex-shrink-0">
        <path
          d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.011-2.095a.463.463 0 0 0-.66.017.52.52 0 0 0 .016.678l2.34 2.438a.456.456 0 0 0 .327.146h.008a.456.456 0 0 0 .33-.157l6.532-8.054a.52.52 0 0 0-.007-.685z"
          fill={fillColor}
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 16 11" width="16" height="11" className="inline-block ml-1 flex-shrink-0">
      <path
        d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.011-2.095a.463.463 0 0 0-.66.017.52.52 0 0 0 .016.678l2.34 2.438a.456.456 0 0 0 .327.146h.008a.456.456 0 0 0 .33-.157l6.532-8.054a.52.52 0 0 0-.007-.685z"
        fill={fillColor}
      />
      <path
        d="M15.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-1.2-1.25-.66.814 1.86 1.938a.456.456 0 0 0 .327.146h.008a.456.456 0 0 0 .33-.157l6.532-8.054a.52.52 0 0 0-.007-.685z"
        fill={fillColor}
      />
    </svg>
  );
}

interface ContactData {
  fullName: string;
  phoneNumber: string;
  organization?: string | null;
}

function parseContactBody(body: string): ContactData[] | null {
  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].fullName) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function MessageTypeIcon({ type }: { type: string }) {
  switch (type) {
    case "audio":
      return <Mic className="h-3.5 w-3.5 inline mr-1" />;
    case "image":
      return <ImageIcon className="h-3.5 w-3.5 inline mr-1" />;
    case "video":
      return <Video className="h-3.5 w-3.5 inline mr-1" />;
    case "document":
      return <FileText className="h-3.5 w-3.5 inline mr-1" />;
    default:
      return null;
  }
}

export default function InboxConversation({
  conversationId,
  initialMessages,
  leadName = "",
  leadPhone = "",
  contactName = "",
}: InboxConversationProps) {
  const [messages, setMessages] = useState<Message[]>(
    initialMessages.map((m) => ({
      id: m.id,
      body: m.body ?? "",
      type: m.type ?? "text",
      mediaUrl: m.mediaUrl ?? null,
      transcription: m.transcription ?? null,
      direction: m.direction as "in" | "out",
      createdAt: m.createdAt,
      sentByUserName: m.sentByUserName ?? null,
      providerId: m.providerId ?? null,
      quotedMessageId: m.quotedMessageId ?? null,
      status: m.status ?? null,
      editedAt: m.editedAt ?? null,
      source: m.source ?? null,
      sourceLabel: m.sourceLabel ?? null,
    }))
  );
  const router = useRouter();
  const lastMessageTime = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const navigateToContact = useCallback(async (phone: string) => {
    try {
      const res = await fetch(`/api/contacts/find-conversation?phone=${encodeURIComponent(phone)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.conversationId) {
          router.push(`/chats/${data.conversationId}`);
          return;
        }
      }
      window.open(`https://wa.me/${phone.replace(/\D/g, "")}`, "_blank");
    } catch {
      window.open(`https://wa.me/${phone.replace(/\D/g, "")}`, "_blank");
    }
  }, [router]);

  useEffect(() => {
    const lastReal = [...messages].reverse().find((m) => !m.id.startsWith("tmp-"));
    if (lastReal) {
      lastMessageTime.current =
        typeof lastReal.createdAt === "string"
          ? lastReal.createdAt
          : new Date(lastReal.createdAt).toISOString();
    }
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchNewMessages = useCallback(async (full = false) => {
    try {
      const url =
        !full && lastMessageTime.current
          ? `/api/conversations/${conversationId}/messages?after=${encodeURIComponent(lastMessageTime.current)}`
          : `/api/conversations/${conversationId}/messages`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      if (data.ok && data.messages?.length > 0) {
        setMessages((prev) => {
          const existingMap = new Map(prev.filter((m) => !m.id.startsWith("tmp-")).map((m) => [m.id, m]));
          let changed = false;
          for (const incoming of data.messages as Message[]) {
            const existing = existingMap.get(incoming.id);
            if (existing) {
              if (existing.status !== incoming.status || existing.body !== incoming.body || existing.editedAt !== incoming.editedAt) {
                existingMap.set(incoming.id, { ...existing, ...incoming });
                changed = true;
              }
            } else {
              existingMap.set(incoming.id, incoming);
              changed = true;
            }
          }
          const hadOptimistic = prev.some((m) => m.id.startsWith("tmp-"));
          if (!changed && !hadOptimistic && prev.length === existingMap.size) return prev;
          return Array.from(existingMap.values()).sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        });
      }
    } catch {
      // ignore
    }
  }, [conversationId]);

  useEffect(() => {
    let es: EventSource | null = null;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => fetchNewMessages(true), 80);
    };
    try {
      es = new EventSource("/api/conversations/stream");
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.type === "ready") return;
          if (!data.conversationId || data.conversationId === conversationId) {
            refresh();
          }
        } catch {
          refresh();
        }
      };
    } catch {
      /* usa polling */
    }
    const interval = setInterval(() => fetchNewMessages(false), POLLING_INTERVAL);
    return () => {
      if (debounce) clearTimeout(debounce);
      clearInterval(interval);
      es?.close();
    };
  }, [conversationId, fetchNewMessages]);

  // Expõe fetch e envio otimista para o composer
  useEffect(() => {
    (window as any).__inboxRefetch = () => fetchNewMessages(true);
    (window as any).__inboxAddOptimistic = (msg: Message) => {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    };
    (window as any).__inboxRemoveOptimistic = (id: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    };
    (window as any).__inboxSetReply = (msg: Message | null) => {
      if (typeof (window as any).__composerSetReply === "function") {
        (window as any).__composerSetReply(msg);
      }
    };
    return () => {
      delete (window as any).__inboxRefetch;
      delete (window as any).__inboxAddOptimistic;
      delete (window as any).__inboxRemoveOptimistic;
      delete (window as any).__inboxSetReply;
    };
  }, [fetchNewMessages]);

  const handleReply = (msg: Message) => {
    if (typeof (window as any).__composerSetReply === "function") {
      (window as any).__composerSetReply(msg);
    }
  };

  const handleEdit = (msg: Message) => {
    if (typeof (window as any).__composerSetEdit === "function") {
      (window as any).__composerSetEdit(msg);
    }
  };

  const getQuotedMessage = (quotedId: string | null | undefined): Message | undefined => {
    if (!quotedId) return undefined;
    return messages.find((m) => m.id === quotedId);
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 py-3"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23f1f5f9' fill-opacity='0.6'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        backgroundColor: "#f0f2f5",
      }}
    >
      <div className="max-w-3xl mx-auto space-y-1">
        {messages.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-gray-400 bg-white/80 px-4 py-2 rounded-lg shadow-sm">
              Nenhuma mensagem ainda
            </p>
          </div>
        )}

        {messages.map((m, i) => {
          const prev = i > 0 ? messages[i - 1] : null;
          const showDate = shouldShowDateSeparator(m, prev);
          const isOut = m.direction === "out";
          const isMediaType = m.type !== "text" && m.type !== "contact";
          const isHuman = m.sentByUserName != null;
          const isMass = m.source === "campaign" || m.source === "broadcast";
          const quoted = getQuotedMessage(m.quotedMessageId);

          return (
            <div key={m.id}>
              {/* Date separator */}
              {showDate && (
                <div className="flex justify-center my-4">
                  <span className="bg-white/90 backdrop-blur-sm px-4 py-1.5 rounded-lg text-xs text-gray-600 shadow-sm font-medium">
                    {formatDateSeparator(m.createdAt)}
                  </span>
                </div>
              )}

              {/* Message bubble with avatar */}
              <div
                className={cn(
                  "flex mb-3 group",
                  isOut ? "justify-end" : "justify-start"
                )}
              >
                {/* Action buttons — aparecem em hover */}
                <div className={cn(
                  "flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity",
                  isOut ? "order-first mr-1" : "order-last ml-1"
                )}>
                  <button
                    onClick={() => handleReply(m)}
                    className="p-1.5 rounded-full hover:bg-gray-200/80 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Responder"
                    aria-label="Responder mensagem"
                  >
                    <Reply className="h-3.5 w-3.5" />
                  </button>
                  {isOut && m.type === "text" && !isMass && (
                    <button
                      onClick={() => handleEdit(m)}
                      className="p-1.5 rounded-full hover:bg-gray-200/80 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Editar"
                      aria-label="Editar mensagem"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div
                  className={cn(
                    "max-w-[75%] md:max-w-[65%] flex gap-2",
                    isOut ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  {/* Avatar */}
                  {isOut ? (
                    <div className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ring-2 ring-white shadow-sm",
                      isMass
                        ? "bg-gradient-to-br from-[#FFD600] to-[#F9A825] text-[#001A5E]"
                        : isHuman
                        ? "bg-gradient-to-br from-purple-500 to-purple-600 text-white"
                        : "bg-gradient-to-br from-[#001A5E] to-[#003080] text-white"
                    )}>
                      {isMass
                        ? <Megaphone className="w-4 h-4" />
                        : isHuman
                        ? m.sentByUserName!.split(" ")[0][0].toUpperCase()
                        : "Sulma"}
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold bg-gradient-to-br from-gray-400 to-gray-500 text-white ring-2 ring-white shadow-sm">
                      ?
                    </div>
                  )}

                  <div className="flex flex-col">
                    {/* Bubble */}
                    <div
                      className={cn(
                        "relative px-4 py-2.5 shadow-sm",
                        isOut
                          ? isMass
                            ? "bg-gradient-to-br from-[#001A5E] to-[#003080] text-white rounded-2xl rounded-tr-md ring-1 ring-[#FFD600]/40"
                            : isHuman
                            ? "bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-2xl rounded-tr-md"
                            : "bg-gradient-to-br from-[#001A5E] to-[#003080] text-white rounded-2xl rounded-tr-md"
                          : "bg-white text-gray-800 rounded-2xl rounded-tl-md"
                      )}
                    >
                      {isMass && (
                        <div className="mb-2 pb-2 border-b border-white/20">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#FFD600] flex items-center gap-1">
                            <Megaphone className="w-3 h-3" />
                            {m.source === "campaign"
                              ? `Campanha${m.sourceLabel ? `: ${m.sourceLabel}` : ""}`
                              : "Disparo em massa"}
                          </p>
                          <p className="text-[11px] text-white/90 mt-1 leading-snug">
                            Lead: <span className="font-semibold">{leadName || "sem nome"}</span>
                          </p>
                          <p className="text-[11px] text-white/80 leading-snug">
                            Contato: <span className="font-semibold">{contactName || leadName || "—"}</span>
                            {leadPhone ? ` · ${formatPhone(leadPhone)}` : ""}
                          </p>
                        </div>
                      )}

                      {/* Quoted message preview */}
                      {quoted && (
                        <div className={cn(
                          "mb-2 px-3 py-1.5 rounded-lg border-l-3 text-[11px] leading-snug",
                          isOut
                            ? "bg-white/15 border-white/50 text-white/80"
                            : "bg-gray-100 border-[#F9A825] text-gray-600"
                        )}>
                          <p className="font-semibold text-[10px] mb-0.5">
                            {quoted.direction === "out" ? (quoted.sentByUserName || "Sulma") : "Lead"}
                          </p>
                          <p className="line-clamp-2">{quoted.body || "Mídia"}</p>
                        </div>
                      )}

                      {/* Imagem inline */}
                      {m.type === "image" && m.mediaUrl && (
                        <div className="mb-2 -mx-2 -mt-1">
                          <img
                            src={m.mediaUrl}
                            alt="Imagem"
                            className="rounded-xl max-w-full max-h-72 object-cover cursor-pointer"
                            loading="lazy"
                            onClick={() => window.open(m.mediaUrl!, "_blank")}
                          />
                        </div>
                      )}

                      {/* Player de áudio */}
                      {m.type === "audio" && m.mediaUrl && (
                        <div className="mb-2 min-w-[220px]">
                          <audio
                            controls
                            preload="metadata"
                            className="w-full h-9 rounded-lg"
                            style={{ filter: isOut ? "invert(1) brightness(2)" : "none" }}
                          >
                            <source src={m.mediaUrl} />
                          </audio>
                        </div>
                      )}

                      {/* Transcrição abaixo de áudio/imagem */}
                      {isMediaType && m.transcription && (
                        <div className={cn(
                          "text-[11px] leading-snug italic mb-1 px-1 py-1 rounded-lg",
                          isOut ? "text-white/70 bg-white/10" : "text-gray-500 bg-gray-50"
                        )}>
                          <span className="font-semibold not-italic">
                            {m.type === "audio" ? "Transcrição: " : "IA: "}
                          </span>
                          {m.transcription}
                        </div>
                      )}

                      {/* Indicador de tipo para mídia sem URL (mensagens antigas) */}
                      {isMediaType && !m.mediaUrl && (
                        <span className={cn(
                          "inline-flex items-center text-xs font-medium mb-0.5",
                          isOut ? "text-white/80" :
                          m.type === "audio" ? "text-purple-600" :
                          m.type === "image" ? "text-blue-600" :
                          m.type === "video" ? "text-red-600" :
                          "text-gray-600"
                        )}>
                          <MessageTypeIcon type={m.type} />
                          {m.type === "audio" ? "Áudio" :
                           m.type === "image" ? "Imagem" :
                           m.type === "video" ? "Vídeo" :
                           "Documento"}
                        </span>
                      )}

                      {/* Card de contato (vCard) */}
                      {m.type === "contact" && m.body && (() => {
                        const contacts = parseContactBody(m.body);
                        if (!contacts) return (
                          <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">{m.body}</p>
                        );
                        return contacts.map((ct: ContactData, idx: number) => (
                          <div key={idx} className={cn(
                            "rounded-xl border p-3 min-w-[200px]",
                            isOut ? "bg-white/15 border-white/30" : "bg-gray-50 border-gray-200"
                          )}>
                            <div className="flex items-center gap-2 mb-2">
                              <div className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold",
                                isOut ? "bg-white/20 text-white" : "bg-[#E8EDF8] text-[#001A5E]"
                              )}>
                                {ct.fullName?.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() || "?"}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={cn("text-sm font-semibold truncate", isOut ? "text-white" : "text-gray-800")}>
                                  {ct.fullName}
                                </p>
                                <p className={cn("text-[11px] flex items-center gap-1", isOut ? "text-white/70" : "text-gray-500")}>
                                  <Phone className="h-3 w-3" />
                                  {ct.phoneNumber}
                                </p>
                                {ct.organization && (
                                  <p className={cn("text-[10px]", isOut ? "text-white/60" : "text-gray-400")}>
                                    {ct.organization}
                                  </p>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => navigateToContact(ct.phoneNumber)}
                              className={cn(
                                "w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                                isOut
                                  ? "bg-white/20 hover:bg-white/30 text-white"
                                  : "bg-[#001A5E] hover:bg-[#003080] text-white"
                              )}
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              Conversar
                            </button>
                          </div>
                        ));
                      })()}

                      {/* Texto da mensagem (oculta body genérico para mídia com URL e contatos) */}
                      {m.type !== "contact" && (!isMediaType || !m.mediaUrl) && m.body && (
                        <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">
                          {m.body}
                        </p>
                      )}

                      {/* Caption de imagem enviada */}
                      {m.type === "image" && m.mediaUrl && m.body && !m.body.startsWith("[") && (
                        <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words mt-1">
                          {m.body}
                        </p>
                      )}
                      <div className={cn(
                        "flex items-center gap-1 mt-1",
                        isOut ? "justify-end" : "justify-start"
                      )}>
                        {m.editedAt && (
                          <span className={cn(
                            "text-[9px] italic",
                            isOut ? "text-white/50" : "text-gray-400"
                          )}>
                            editada
                          </span>
                        )}
                        <span className={cn(
                          "text-[10px]",
                          isOut ? "text-white/70" : "text-gray-400"
                        )}>
                          {formatTime(m.createdAt)}
                        </span>
                        <ReadReceipt isOut={isOut} status={m.status} />
                      </div>
                    </div>
                    {/* Sender label below bubble */}
                    <p className={cn(
                      "text-[10px] text-gray-500 mt-1 px-1",
                      isOut ? "text-right" : "text-left"
                    )}>
                      {isOut
                        ? isMass
                          ? (m.source === "campaign" ? "Campanha" : "Disparo")
                          : m.sentByUserName || "Sulma"
                        : "Lead"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={scrollRef} />
      </div>
    </div>
  );
}
