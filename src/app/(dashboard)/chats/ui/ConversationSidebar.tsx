/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Sidebar de conversas estilo WhatsApp Web — busca, avatars, preview, unread, score
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, Bot, UserCheck, MessageSquare, X, MessageCircle, Pin, PinOff, Bell, BellOff, ChevronDown, Plus, MailOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { LeadAvatar } from "@/components/LeadAvatar";

interface Conversation {
  id: string;
  leadId: string;
  name: string | null;
  pushName: string | null;
  avatarUrl: string | null;
  phone: string;
  status: string;
  convStatus?: string; // atendimento: open | closed
  isPinned?: boolean;
  sectorId?: string | null;
  sectorName?: string | null;
  sectorColor?: string | null;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  ownerType: string;
  leadScore: number;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessageBody: string | null;
  lastMessageType: string;
  lastMessageDirection: string;
  tags?: { id: string; name: string; color: string }[];
}

type FilterTab = "abertas" | "nao-lidas" | "encerradas" | "todas";
interface Sector { id: string; name: string; color: string; }

interface ConversationSidebarProps {
  initialConversations: Conversation[];
  currentUserId?: string | null;
  sectors?: Sector[];
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

function getScoreColor(score: number): string {
  if (score >= 800) return "bg-red-500";
  if (score >= 600) return "bg-orange-500";
  if (score >= 400) return "bg-yellow-500";
  if (score >= 200) return "bg-blue-400";
  return "bg-gray-400";
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) {
    return date.toLocaleDateString("pt-BR", { weekday: "short" });
  }
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function getMessagePreview(conv: Conversation): string {
  if (!conv.lastMessageBody) return "Sem mensagens";

  const prefix = conv.lastMessageDirection === "out" ? "Você: " : "";

  if (conv.lastMessageType === "audio") return `${prefix}🎤 Áudio`;
  if (conv.lastMessageType === "image") return `${prefix}📷 Imagem`;
  if (conv.lastMessageType === "video") return `${prefix}🎬 Vídeo`;
  if (conv.lastMessageType === "document") return `${prefix}📄 Documento`;
  if (conv.lastMessageType === "contact") {
    try {
      const parsed = JSON.parse(conv.lastMessageBody);
      if (Array.isArray(parsed) && parsed[0]?.fullName) {
        return `${prefix}📇 ${parsed.map((c: { fullName: string }) => c.fullName).join(", ")}`;
      }
    } catch { /* fallback abaixo */ }
    return `${prefix}📇 Contato`;
  }

  const body = conv.lastMessageBody;
  if (body.startsWith("[Áudio")) return `${prefix}🎤 Áudio`;
  if (body.startsWith("[Imagem")) return `${prefix}📷 Imagem`;
  if (body.startsWith("[Vídeo")) return `${prefix}🎬 Vídeo`;
  if (body.startsWith("[Documento")) return `${prefix}📄 Documento`;

  return `${prefix}${body.length > 50 ? body.slice(0, 50) + "…" : body}`;
}

/**
 * Toca um som curto de notificação usando Web Audio API
 */
function playNotificationSound() {
  try {
    if (localStorage.getItem("vi_sound_muted") === "1") return;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  } catch {
    // Web Audio não disponível
  }
}

export default function ConversationSidebar({
  initialConversations,
  currentUserId = null,
  sectors = [],
}: ConversationSidebarProps) {
  const [conversations, setConversations] = useState(initialConversations);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("abertas");
  const [tagFilter, setTagFilter] = useState<string | null>(null); // lista (tag) selecionada
  const [listMenuOpen, setListMenuOpen] = useState(false);
  const [orgTags, setOrgTags] = useState<{ id: string; name: string; color: string }[]>([]);
  const listMenuRef = useRef<HTMLDivElement>(null);

  // Carrega todas as tags da org (inclui listas ainda sem conversa).
  useEffect(() => {
    fetch("/api/tags").then((r) => r.json()).then((d) => setOrgTags(d.tags || [])).catch(() => {});
  }, []);
  // Fecha o menu ao clicar fora.
  useEffect(() => {
    if (!listMenuOpen) return;
    const onDoc = (e: MouseEvent) => { if (listMenuRef.current && !listMenuRef.current.contains(e.target as Node)) setListMenuOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [listMenuOpen]);

  const createList = async () => {
    const name = prompt("Nome da nova lista:")?.trim();
    if (!name) return;
    try {
      const res = await fetch("/api/tags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const d = await res.json();
      const tag = d.tag || d;
      if (tag?.id) { setOrgTags((prev) => [...prev.filter((t) => t.id !== tag.id), { id: tag.id, name: tag.name, color: tag.color }]); setTagFilter(tag.id); }
    } catch { /* ignore */ }
    setListMenuOpen(false);
  };
  const [sectorFilter, setSectorFilter] = useState<string>("todos"); // todos | <sectorId>
  const [onlyMine, setOnlyMine] = useState(false);
  const [muted, setMuted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const prevUnreadMapRef = useRef<Map<string, number>>(new Map());
  const isFirstFetchRef = useRef(true);
  const [toastConv, setToastConv] = useState<Conversation | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Extrai o ID da conversa ativa do pathname
  const activeId = pathname.startsWith("/chats/")
    ? pathname.split("/chats/")[1]?.split("/")[0] ?? null
    : null;

  // Pede permissão de notificação ao montar
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    setMuted(localStorage.getItem("vi_sound_muted") === "1");
    // Inicializa mapa de unreads com dados iniciais
    const map = new Map<string, number>();
    initialConversations.forEach((c) => map.set(c.id, c.unreadCount));
    prevUnreadMapRef.current = map;
  }, []);

  // Dispara notificação de browser + som + toast in-app
  const fireNotification = useCallback((conv: Conversation) => {
    playNotificationSound();
    const displayName = conv.name || conv.pushName || conv.phone;
    const body = getMessagePreview(conv);

    // Toast in-app
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastConv(conv);
    toastTimerRef.current = setTimeout(() => setToastConv(null), 5000);

    // Browser notification
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        const n = new Notification(`Nova mensagem de ${displayName}`, {
          body,
          icon: conv.avatarUrl || "/assets/logo.png",
          tag: conv.id,
        });
        n.onclick = () => {
          window.focus();
          router.push(`/chats/${conv.id}`);
          n.close();
        };
      } catch {
        // fallback: nada (mobile pode não suportar new Notification)
      }
    }
  }, [router]);

  // Polling para atualizar lista de conversas
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      if (!res.ok) return;
      const data = await res.json();
      if (data.conversations) {
        const incoming = data.conversations as Conversation[];

        // Detecta novas mensagens não lidas (pula primeiro fetch)
        if (!isFirstFetchRef.current) {
          const prevMap = prevUnreadMapRef.current;
          for (const conv of incoming) {
            const prevUnread = prevMap.get(conv.id) ?? 0;
            // Notifica se unread subiu E não é a conversa ativa
            if (conv.unreadCount > prevUnread && conv.id !== activeId) {
              fireNotification(conv);
              break; // Notifica só 1 por ciclo para não spammar
            }
          }
        }
        isFirstFetchRef.current = false;

        // Atualiza mapa de unreads
        const newMap = new Map<string, number>();
        incoming.forEach((c) => newMap.set(c.id, c.unreadCount));
        prevUnreadMapRef.current = newMap;

        setConversations(incoming);
      }
    } catch {
      // silently ignore
    }
  }, [activeId, fireNotification]);

  // Realtime via SSE (mensagem nova/encerrar/pin aparecem na hora).
  // Polling como fallback (intervalo maior) caso o SSE caia.
  useEffect(() => {
    let es: EventSource | null = null;
    let debounce: NodeJS.Timeout | null = null;
    const refresh = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(fetchConversations, 250);
    };
    try {
      es = new EventSource("/api/conversations/stream");
      es.onmessage = () => refresh();
      es.onerror = () => { /* mantém polling */ };
    } catch { /* sem SSE, usa polling */ }

    const interval = setInterval(fetchConversations, 15000);
    return () => {
      if (debounce) clearTimeout(debounce);
      clearInterval(interval);
      es?.close();
    };
  }, [fetchConversations]);

  // Fixar / desafixar conversa.
  const togglePin = useCallback(async (conv: Conversation) => {
    const next = !conv.isPinned;
    setConversations((prev) => prev.map((c) => (c.id === conv.id ? { ...c, isPinned: next } : c)));
    try {
      await fetch(`/api/conversations/${conv.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPinned: next }),
      });
    } catch { /* rollback via próximo fetch */ }
  }, []);

  // Atualiza título da aba com contagem de não lidas
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  useEffect(() => {
    document.title = totalUnread > 0
      ? `(${totalUnread}) Conversas — Sulma Assistente`
      : "Conversas — Sulma Assistente";
    return () => { document.title = "Sulma Assistente"; };
  }, [totalUnread]);

  const isClosed = (c: Conversation) => c.convStatus === "closed";

  // Filtra por aba + busca
  const filtered = conversations.filter((c) => {
    if (tagFilter) {
      // Modo "lista": mostra todas as conversas com a tag (ignora aberto/encerrado).
      if (!c.tags?.some((t) => t.id === tagFilter)) return false;
    } else {
      if (tab === "abertas" && isClosed(c)) return false;
      if (tab === "encerradas" && !isClosed(c)) return false;
      if (tab === "nao-lidas" && (c.unreadCount === 0 || isClosed(c))) return false;
    }
    if (sectorFilter !== "todos" && c.sectorId !== sectorFilter) return false;
    if (onlyMine && c.assignedUserId !== currentUserId) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (c.name?.toLowerCase().includes(q)) ||
      (c.pushName?.toLowerCase().includes(q)) ||
      c.phone.includes(q)
    );
  });

  // Ordena: fixadas primeiro, depois não-lidas, depois por data
  const sorted = [...filtered].sort((a, b) => {
    if (!!a.isPinned !== !!b.isPinned) return a.isPinned ? -1 : 1;
    if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
    if (b.unreadCount > 0 && a.unreadCount === 0) return 1;
    return (
      new Date(b.lastMessageAt ?? 0).getTime() -
      new Date(a.lastMessageAt ?? 0).getTime()
    );
  });

  const counts = {
    abertas: conversations.filter((c) => !isClosed(c)).length,
    naoLidas: conversations.filter((c) => c.unreadCount > 0 && !isClosed(c)).length,
    encerradas: conversations.filter(isClosed).length,
    todas: conversations.length,
  };
  const TABS: { key: FilterTab; label: string; count: number }[] = [
    { key: "abertas", label: "Abertas", count: counts.abertas },
    { key: "nao-lidas", label: "Não lidas", count: counts.naoLidas },
    { key: "encerradas", label: "Encerradas", count: counts.encerradas },
    { key: "todas", label: "Todas", count: counts.todas },
  ];

  // Listas = tags (todas da org) + contagem de conversas por tag.
  const tagCount = new Map<string, number>();
  for (const c of conversations) for (const t of c.tags ?? []) tagCount.set(t.id, (tagCount.get(t.id) ?? 0) + 1);
  // União: tags da org (inclui listas vazias) + tags que já chegam nas conversas
  // via polling — assim etiqueta nova criada no lead aparece na hora, sem reload.
  const base = Array.from(new Map([...orgTags, ...conversations.flatMap((c) => c.tags ?? [])].map((t) => [t.id, t] as const)).values());
  const allTags = base
    .map((t) => ({ ...t, count: tagCount.get(t.id) ?? 0 }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const activeTag = allTags.find((t) => t.id === tagFilter) || null;

  return (
    <>
    <div className={cn(
      "border-r bg-white flex flex-col h-full",
      "w-full md:w-[340px] md:min-w-[340px]",
      activeId ? "hidden md:flex" : "flex"
    )}>
      {/* Header */}
      <div className="px-4 pt-12 md:pt-3 py-3 border-b bg-gray-50/80">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Conversas</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {conversations.length} conversa{conversations.length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={() => {
                const next = !muted;
                setMuted(next);
                localStorage.setItem("vi_sound_muted", next ? "1" : "0");
              }}
              className="p-1 rounded hover:bg-gray-200 text-gray-400"
              title={muted ? "Ativar som de notificação" : "Silenciar som de notificação"}
              aria-label={muted ? "Ativar som" : "Silenciar som"}
            >
              {muted ? <BellOff className="h-4 w-4 text-gray-500" /> : <Bell className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar conversa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#001A5E]/20 focus:border-[#001A5E] transition-colors"
            aria-label="Buscar conversa por nome ou telefone"
          />
        </div>
        {/* Filtros — uma linha, chips compactos + dropdown de listas */}
        <div className="flex gap-1 mt-2 items-center">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "px-2 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors flex items-center gap-1",
                tab === t.key ? "bg-[#001A5E] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
              title={t.count > 0 ? `${t.label}: ${t.count}` : t.label}
            >
              <span>{t.label}</span>
              {t.count > 0 && (
                <span className={cn(
                  "text-[9px] font-bold rounded-full px-1 min-w-[15px] text-center",
                  tab === t.key ? "bg-white/25" : "bg-gray-300/60 text-gray-700"
                )}>{t.count > 99 ? "99+" : t.count}</span>
              )}
            </button>
          ))}
        </div>
        {/* Listas (tags) — linha própria, dentro do painel */}
        <div className="relative mt-2" ref={listMenuRef}>
          <button onClick={() => setListMenuOpen((o) => !o)}
            className={cn("w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border", activeTag ? "text-white border-transparent" : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100")}
            style={activeTag ? { backgroundColor: activeTag.color } : undefined}>
            {activeTag ? <span className="w-2 h-2 rounded-full bg-white shrink-0" /> : <MessageSquare className="h-3.5 w-3.5" />}
            <span className="flex-1 text-left truncate">{activeTag ? activeTag.name : "Listas"}</span>
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {listMenuOpen && (
            <div className="absolute left-0 right-0 mt-1 z-30 bg-white rounded-xl shadow-lg border border-gray-200 py-1 max-h-80 overflow-y-auto">
              <button onClick={() => { setTagFilter(null); setTab("todas"); setListMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50 text-gray-700"><MessageSquare className="h-4 w-4 text-gray-400" /> <span className="flex-1 text-left">Todas as conversas</span></button>
              <button onClick={() => { setTagFilter(null); setTab("nao-lidas"); setListMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50 text-gray-700"><MailOpen className="h-4 w-4 text-gray-400" /> <span className="flex-1 text-left">Não lidas</span>{counts.naoLidas > 0 && <span className="text-xs text-gray-400">{counts.naoLidas > 99 ? "99+" : counts.naoLidas}</span>}</button>
              {allTags.length > 0 && <div className="my-1 border-t border-gray-100" />}
              {allTags.map((tg) => (
                <button key={tg.id} onClick={() => { setTagFilter(tg.id); setListMenuOpen(false); }} className={cn("w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50", tagFilter === tg.id ? "bg-gray-50 font-semibold text-gray-900" : "text-gray-700")}><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tg.color }} /><span className="flex-1 text-left truncate">{tg.name}</span>{tg.count > 0 && <span className="text-xs text-gray-400">{tg.count > 99 ? "99+" : tg.count}</span>}</button>
              ))}
              <div className="my-1 border-t border-gray-100" />
              <button onClick={createList} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50 text-gray-700"><Plus className="h-4 w-4 text-gray-500" /> <span>Nova lista</span></button>
            </div>
          )}
        </div>
        {/* Filtro por setor + minhas conversas */}
        {(sectors.length > 0 || currentUserId) && (
          <div className="flex gap-1.5 mt-2 items-center">
            {sectors.length > 0 && (
              <select
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
                className="flex-1 min-w-0 px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#001A5E]/20"
                aria-label="Filtrar por setor"
              >
                <option value="todos">Todos os setores</option>
                {sectors.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
            {currentUserId && (
              <button
                onClick={() => setOnlyMine((v) => !v)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                  onlyMine ? "bg-[#001A5E] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                Minhas
              </button>
            )}
          </div>
        )}
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <MessageSquare className="h-10 w-10 text-gray-300 mb-3" />
            <p className="text-sm text-gray-400 text-center">
              {search ? "Nenhuma conversa encontrada" : "Nenhuma conversa ainda"}
            </p>
          </div>
        )}

        {sorted.map((conv) => {
          const isActive = conv.id === activeId;
          const displayName = conv.name || conv.pushName || conv.phone;

          return (
            <button
              key={conv.id}
              onClick={() => router.push(`/chats/${conv.id}`)}
              className={cn(
                "group w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-gray-50 hover:bg-gray-50",
                isActive && "bg-[#EEF2FF]/80 hover:bg-[#EEF2FF]/80 border-l-2 border-l-[#001A5E]",
                isClosed(conv) && "opacity-60"
              )}
              aria-label={`Conversa com ${displayName}`}
              aria-current={isActive ? "page" : undefined}
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <LeadAvatar
                  leadId={conv.leadId}
                  avatarUrl={conv.avatarUrl}
                  name={conv.name || conv.pushName}
                  phone={conv.phone}
                  size="md"
                />
                {/* Owner indicator */}
                <div
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border-2 border-white",
                    conv.ownerType === "human" ? "bg-green-500" : "bg-blue-500"
                  )}
                  title={conv.ownerType === "human" ? "Atendimento humano" : "Sulma (Bot)"}
                >
                  {conv.ownerType === "human" ? (
                    <UserCheck className="h-2.5 w-2.5 text-white" />
                  ) : (
                    <Bot className="h-2.5 w-2.5 text-white" />
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={cn(
                    "text-sm truncate flex items-center gap-1",
                    conv.unreadCount > 0 ? "font-bold text-gray-900" : "font-medium text-gray-800"
                  )}>
                    {conv.isPinned && <Pin className="h-3 w-3 text-[#001A5E] shrink-0 fill-[#001A5E]" />}
                    {isClosed(conv) && <span className="text-[9px] px-1 rounded bg-gray-200 text-gray-500 shrink-0">encerrada</span>}
                    <span className="truncate">{displayName}</span>
                  </span>
                  <span className="flex items-center gap-1 flex-shrink-0 ml-2">
                    {/* Pin toggle (span pra não aninhar button) */}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); togglePin(conv); }}
                      className={cn(
                        "p-0.5 rounded hover:bg-gray-200 text-gray-400",
                        conv.isPinned ? "opacity-100 text-[#001A5E]" : "opacity-0 group-hover:opacity-100"
                      )}
                      title={conv.isPinned ? "Desafixar" : "Fixar"}
                    >
                      {conv.isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                    </span>
                    <span className={cn(
                      "text-[11px]",
                      conv.unreadCount > 0 ? "text-[#001A5E] font-semibold" : "text-gray-400"
                    )}>
                      {formatTime(conv.lastMessageAt)}
                    </span>
                  </span>
                </div>

                <div className="flex items-center justify-between mt-0.5">
                  <p className={cn(
                    "text-xs truncate pr-2",
                    conv.unreadCount > 0 ? "text-gray-700 font-medium" : "text-gray-500"
                  )}>
                    {getMessagePreview(conv)}
                  </p>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Setor */}
                    {conv.sectorName && (
                      <span
                        className="flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full text-gray-600 bg-gray-100"
                        title={`Setor: ${conv.sectorName}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: conv.sectorColor || "#999" }} />
                        {conv.sectorName}
                      </span>
                    )}
                    {/* Atendente designado */}
                    {conv.assignedUserName && (
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700"
                        title={`Atendente: ${conv.assignedUserName}`}
                      >
                        {getInitials(conv.assignedUserName, "")}
                      </span>
                    )}
                    {/* Lead Score mini badge */}
                    {conv.leadScore > 0 && (
                      <span
                        className={cn(
                          "text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white",
                          getScoreColor(conv.leadScore)
                        )}
                        title={`Lead Score: ${conv.leadScore}`}
                      >
                        {conv.leadScore}
                      </span>
                    )}

                    {/* Unread badge */}
                    {conv.unreadCount > 0 && (
                      <span className="bg-[#001A5E] text-white text-[10px] font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1.5">
                        {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>

    {/* Toast de nova mensagem */}
    {(() => {
      const tc = toastConv;
      if (!tc) return null;
      return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-6 md:bottom-6 z-[70] animate-in slide-in-from-bottom-4 fade-in duration-300 w-[calc(100%-2rem)] max-w-sm">
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border border-[#C5D0E8] bg-white cursor-pointer hover:bg-[#EEF2FF] transition-colors"
            onClick={() => {
              router.push(`/chats/${tc.id}`);
              setToastConv(null);
            }}
            role="alert"
          >
            <LeadAvatar
              leadId={tc.leadId}
              avatarUrl={tc.avatarUrl}
              name={tc.name || tc.pushName}
              phone={tc.phone}
              size="md"
              className="shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">
                {tc.name || tc.pushName || tc.phone}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {getMessagePreview(tc)}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <MessageCircle className="h-4 w-4 text-[#001A5E]" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setToastConv(null);
                }}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-400"
                aria-label="Fechar notificação"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      );
    })()}
    </>
  );
}
