/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 * 
 * Componente Kanban de Leads estilo Amo Vidas
 * Com busca, abas, edição e exclusão
 * Aprimorado: Resumo, Prioridade, Tempo na Etapa, Origem, Responsável
 */

"use client";

import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import Link from "next/link";
import {
  MessageSquare, Phone, Loader2, Search, Pencil, Trash2, X, Tag as TagIcon,
  ArrowUp, ArrowDown, Minus, Clock, Instagram, Send, User, MessageCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Responsible {
  name: string | null;
  avatar: string | null;
}

interface Lead {
  id: string;
  name: string | null;
  pushName: string | null;
  phone: string;
  status: string;
  ownerType: string;
  category: string;
  summary: string | null;
  priority: string; // low, medium, high
  source: string; // whatsapp, instagram, manual
  leadScore: number;
  updatedAt: string;
  createdAt: string;
  conversationId: string | null;
  tags: Tag[];
  responsible: Responsible | null;
}

interface LeadsKanbanProps {
  initialLeads: Lead[];
  initialHasMore?: boolean;
}

const COLUMNS = [
  {
    id: "NOVO",
    title: "Novo",
    bgColor: "bg-[#EEF2FF]",
    headerBg: "bg-[#E8EDF8]",
    borderColor: "border-[#C5D0E8]",
    badgeColor: "bg-[#001A5E]"
  },
  {
    id: "EM_ATENDIMENTO",
    title: "Em Atendimento",
    bgColor: "bg-orange-50",
    headerBg: "bg-orange-100",
    borderColor: "border-orange-200",
    badgeColor: "bg-orange-500"
  },
  {
    id: "CONSCIENTIZADO",
    title: "Conscientizado",
    bgColor: "bg-cyan-50",
    headerBg: "bg-cyan-100",
    borderColor: "border-cyan-200",
    badgeColor: "bg-cyan-500"
  },
  {
    id: "QUALIFICADO",
    title: "Qualificado",
    bgColor: "bg-blue-50",
    headerBg: "bg-blue-100",
    borderColor: "border-blue-200",
    badgeColor: "bg-blue-500"
  },
  {
    id: "FECHADO",
    title: "Fechado",
    bgColor: "bg-green-50",
    headerBg: "bg-green-100",
    borderColor: "border-green-200",
    badgeColor: "bg-green-500"
  },
  {
    id: "PERDIDO",
    title: "Perdido",
    bgColor: "bg-red-50",
    headerBg: "bg-red-100",
    borderColor: "border-red-200",
    badgeColor: "bg-red-500"
  },
  {
    id: "LEAD_FRIO",
    title: "Lead Frio",
    bgColor: "bg-slate-50",
    headerBg: "bg-slate-100",
    borderColor: "border-slate-200",
    badgeColor: "bg-slate-500"
  },
  {
    id: "HUMANO_SOLICITADO",
    title: "Aguardando Humano",
    bgColor: "bg-yellow-50",
    headerBg: "bg-yellow-100",
    borderColor: "border-yellow-200",
    badgeColor: "bg-yellow-500"
  },
];

const CATEGORIES = [
  { id: "todos", label: "Todos" },
  { id: "geral", label: "Geral" },
  { id: "rotina", label: "Cliente Rotina" },
  { id: "especializado", label: "Cliente Especializado" },
  { id: "cobertura_total", label: "Cliente Cobertura Total" },
];

const POLLING_INTERVAL = 60000; // 60 segundos

const PAGE_SIZE = 20;

export function LeadsKanban({ initialLeads, initialHasMore = false }: LeadsKanbanProps) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("todos");
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [deletingLead, setDeletingLead] = useState<Lead | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const columnScrollRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const columnSentinelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [mounted, setMounted] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const leadsLengthRef = useRef(initialLeads.length);
  const initialCountRef = useRef(initialLeads.length);
  const isFirstRender = useRef(true);
  const fetchLeadsRef = useRef<((replace?: boolean) => Promise<void>) | null>(null);
  const loadMoreRef = useRef<(() => Promise<void>) | null>(null);
  useEffect(() => { leadsLengthRef.current = leads.length; }, [leads.length]);
  useEffect(() => setMounted(true), []);

  const fetchLeads = useCallback(async (replace = true, search = searchQuery, category = activeCategory) => {
    try {
      const currentLength = leadsLengthRef.current;
      const skip = replace ? 0 : currentLength;
      const take = replace ? Math.max(currentLength, initialCountRef.current, PAGE_SIZE) : PAGE_SIZE;
      const params = new URLSearchParams({
        skip: String(skip),
        take: String(take),
      });
      if (search) params.set("search", search);
      if (category && category !== "todos") params.set("category", category);

      const res = await fetch(`/api/leads?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (replace) {
          setLeads((prev) => {
            const incoming = data.leads as Lead[];
            const prevMap = new Map(prev.map((l) => [l.id, l]));
            const incomingIds = new Set(incoming.map((l) => l.id));

            let changed = false;

            const merged = incoming.map((nl) => {
              const old = prevMap.get(nl.id);
              if (old && old.status === nl.status && old.updatedAt === nl.updatedAt && old.category === nl.category && old.name === nl.name) {
                return old;
              }
              changed = true;
              return nl;
            });

            const removed = prev.some((l) => !incomingIds.has(l.id));
            const added = incoming.some((l) => !prevMap.has(l.id));

            if (!changed && !removed && !added && prev.length === merged.length) {
              return prev;
            }

            return merged;
          });
        } else {
          setLeads((prev) => {
            const existingIds = new Set(prev.map((l) => l.id));
            const newLeads = data.leads.filter((l: Lead) => !existingIds.has(l.id));
            return [...prev, ...newLeads];
          });
        }
        setHasMore(data.hasMore ?? false);
      }
    } catch (error) {
      console.error("Erro ao buscar leads:", error);
    }
  }, [searchQuery, activeCategory]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        skip: String(leadsLengthRef.current),
        take: String(PAGE_SIZE),
      });
      if (searchQuery) params.set("search", searchQuery);
      if (activeCategory && activeCategory !== "todos") params.set("category", activeCategory);

      const res = await fetch(`/api/leads?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLeads((prev) => {
            const existingIds = new Set(prev.map((l) => l.id));
            const newLeads = data.leads.filter((l: Lead) => !existingIds.has(l.id));
            return [...prev, ...newLeads];
          });
        setHasMore(data.hasMore ?? false);
      }
    } catch (error) {
      console.error("Erro ao carregar mais leads:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, searchQuery, activeCategory]);

  // Mantém refs atualizadas para evitar recriação de intervals/observers
  useEffect(() => { fetchLeadsRef.current = fetchLeads; }, [fetchLeads]);
  useEffect(() => { loadMoreRef.current = loadMore; }, [loadMore]);

  // Debounced search — pula o primeiro render (já temos initialLeads)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      fetchLeads(true, searchQuery, activeCategory);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, activeCategory]);

  // Polling estável — usa ref para não recriar o interval
  useEffect(() => {
    const interval = setInterval(() => fetchLeadsRef.current?.(true), POLLING_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // IntersectionObserver estável — usa ref para não recriar observers
  useEffect(() => {
    if (!mounted) return;
    const observers: IntersectionObserver[] = [];
    COLUMNS.forEach((col) => {
      const root = columnScrollRefs.current[col.id];
      const sentinel = columnSentinelRefs.current[col.id];
      if (!root || !sentinel) return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) loadMoreRef.current?.();
        },
        { root, rootMargin: "200px", threshold: 0 }
      );
      observer.observe(sentinel);
      observers.push(observer);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, [mounted]);

  const getLeadsByStatus = (status: string) => {
    return leads.filter((lead) => lead.status === status);
  };

  const updateLeadStatus = async (leadId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/leads/${leadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        console.error("Erro ao atualizar status do lead");
        fetchLeads();
      }
    } catch (error) {
      console.error("Erro ao atualizar lead:", error);
      fetchLeads();
    }
  };

  const handleDeleteLead = async () => {
    if (!deletingLead) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/leads/${deletingLead.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setLeads((prev) => prev.filter((l) => l.id !== deletingLead.id));
        setDeletingLead(null);
      }
    } catch (error) {
      console.error("Erro ao excluir lead:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveLead = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingLead) return;
    setIsSaving(true);
    const formData = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/api/leads/${editingLead.id}/update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          category: formData.get("category"),
          email: formData.get("email") || null,
          city: formData.get("city") || null,
          priority: formData.get("priority"),
          notes: formData.get("notes") || null,
          tagIds: selectedTags,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setLeads((prev) =>
          prev.map((l) => (l.id === editingLead.id ? { ...l, ...data.lead } : l))
        );
        setEditingLead(null);
      }
    } catch (error) {
      console.error("Erro ao salvar lead:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Busca tags disponíveis e inicializa tags do lead ao abrir modal de edição
  useEffect(() => {
    if (!editingLead) return;
    setSelectedTags(editingLead.tags.map((t) => t.id));
    fetch("/api/tags")
      .then((r) => r.json())
      .then((d) => setAvailableTags(d.tags || []))
      .catch(() => {});
  }, [editingLead]);

  function toggleTag(tagId: string) {
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  }

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    setLeads((prev) => {
      const newLeads = [...prev];

      const sourceLeads = newLeads.filter((l) => l.status === source.droppableId);
      const movedLead = sourceLeads[source.index];

      if (!movedLead) return prev;

      const updatedLead = { ...movedLead, status: destination.droppableId };

      const withoutMoved = newLeads.filter((l) => l.id !== draggableId);

      const destLeads = withoutMoved.filter((l) => l.status === destination.droppableId);
      const otherLeads = withoutMoved.filter((l) => l.status !== destination.droppableId);

      destLeads.splice(destination.index, 0, updatedLead);

      return [...otherLeads, ...destLeads];
    });

    if (source.droppableId !== destination.droppableId) {
      updateLeadStatus(draggableId, destination.droppableId);
    }
  };

  // Helpers de Visualização
  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("55") && cleaned.length >= 12) {
      const ddd = cleaned.slice(2, 4);
      const rest = cleaned.slice(4);
      return rest.length === 9
        ? `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`
        : `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
    }
    if (cleaned.length === 11) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    if (cleaned.length === 10) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    return phone;
  };

  const getTimeInStage = (updatedAt: string) => {
    const diff = Date.now() - new Date(updatedAt).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
  };

  const getPriorityInfo = (priority: string) => {
    switch (priority) {
      case "high": return { icon: ArrowUp, color: "text-red-500 bg-red-50" };
      case "low": return { icon: ArrowDown, color: "text-green-500 bg-green-50" };
      default: return { icon: Minus, color: "text-yellow-500 bg-yellow-50" };
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "whatsapp": return <MessageCircle className="w-3 h-3" />;
      case "instagram": return <Instagram className="w-3 h-3" />;
      default: return <User className="w-3 h-3" />;
    }
  };

  return (
    <>
      {/* Barra de busca e abas */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap shrink-0",
                activeCategory === cat.id
                  ? "bg-[#001A5E] text-white shadow-md"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-[#F9A825] hover:text-[#003080]"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou telefone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#001A5E] focus:ring-2 focus:ring-[#EEF2FF] outline-none transition-all text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {!mounted ? (
        <div className="flex items-center justify-center p-12 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin mr-2" />
          <span className="text-lg">Carregando Kanban...</span>
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-2 pb-4 min-h-0 overflow-x-auto snap-x snap-mandatory md:grid md:grid-cols-8 scrollbar-hide">
            {COLUMNS.map((column) => {
              const columnLeads = getLeadsByStatus(column.id);
              return (
                <div
                  key={column.id}
                  className={cn(
                    "rounded-xl border flex flex-col snap-start",
                    "w-[75vw] min-w-[75vw] sm:w-[45vw] sm:min-w-[45vw] md:w-auto md:min-w-0",
                    column.bgColor,
                    column.borderColor
                  )}
                >
                  <div className={cn(
                    "px-3 md:px-4 py-2.5 md:py-3 rounded-t-xl flex items-center justify-between shrink-0",
                    column.headerBg
                  )}>
                    <h3 className="font-semibold text-gray-800 text-sm md:text-base truncate">{column.title}</h3>
                    <span className={cn(
                      "text-white text-sm font-medium px-2.5 py-0.5 rounded-full",
                      column.badgeColor
                    )}>
                      {columnLeads.length}
                    </span>
                  </div>

                  <div
                    ref={(el) => { columnScrollRefs.current[column.id] = el; }}
                    className="overflow-y-auto max-h-[calc(100vh-280px)] md:max-h-[calc(100vh-250px)] min-h-[120px] flex-1 scrollbar-hide"
                  >
                    <Droppable droppableId={column.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={cn(
                            "p-3 space-y-3 min-h-[100px] transition-colors",
                            snapshot.isDraggingOver && "bg-opacity-70"
                          )}
                        >
                          {columnLeads.length === 0 && !snapshot.isDraggingOver ? (
                            <div className="text-center py-8 text-gray-400 text-sm">
                              Nenhum lead
                            </div>
                          ) : (
                            columnLeads.map((lead, index) => {
                              const PriorityIcon = getPriorityInfo(lead.priority).icon;

                              return (
                                <Draggable
                                  key={lead.id}
                                  draggableId={lead.id}
                                  index={index}
                                >
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      className={cn(
                                        "bg-white rounded-lg p-3 shadow-sm border border-gray-100 transition-shadow cursor-grab active:cursor-grabbing group relative",
                                        snapshot.isDragging
                                          ? "shadow-lg ring-2 ring-[#C5D0E8]"
                                          : "hover:shadow-md"
                                      )}
                                    >
                                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingLead(lead);
                                          }}
                                          className="p-1.5 rounded-md bg-gray-100 hover:bg-blue-100 text-gray-500 hover:text-blue-600 transition-colors"
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setDeletingLead(lead);
                                          }}
                                          className="p-1.5 rounded-md bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-600 transition-colors"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>

                                      {/* Header: Prioridade + Nome + Avatar Responsável */}
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                          <div className={cn("p-1 rounded-full shrink-0", getPriorityInfo(lead.priority).color)}>
                                            <PriorityIcon className="w-3 h-3" />
                                          </div>
                                          <h4 className="font-medium text-gray-800 truncate text-sm">
                                            {lead.name || lead.pushName || "Sem nome"}
                                          </h4>
                                        </div>

                                        {lead.responsible && (
                                          <div className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center shrink-0 overflow-hidden text-[10px] font-bold text-gray-500" title={lead.responsible.name || "Responsável"}>
                                            {lead.responsible.avatar ? (
                                              <img src={lead.responsible.avatar} alt="R" className="w-full h-full object-cover" />
                                            ) : (
                                              (lead.responsible.name?.[0] || "?").toUpperCase()
                                            )}
                                          </div>
                                        )}
                                      </div>

                                      {/* Resumo */}
                                      {lead.summary && (
                                        <p className="text-xs text-gray-500 mb-2 line-clamp-2">
                                          {lead.summary}
                                        </p>
                                      )}

                                      {/* Tags */}
                                      {lead.tags && lead.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mb-2">
                                          {lead.tags.slice(0, 3).map((tag) => (
                                            <span
                                              key={tag.id}
                                              className="text-[9px] font-medium px-1.5 py-0.5 rounded-full text-white"
                                              style={{ backgroundColor: tag.color }}
                                            >
                                              {tag.name}
                                            </span>
                                          ))}
                                          {lead.tags.length > 3 && (
                                            <span className="text-[9px] text-gray-400">+{lead.tags.length - 3}</span>
                                          )}
                                        </div>
                                      )}

                                      {/* Lead Score Badge */}
                                      {lead.leadScore > 0 && (
                                        <div className="flex items-center gap-1.5 mb-1">
                                          <div className={cn(
                                            "text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white",
                                            lead.leadScore >= 800 ? "bg-red-500" :
                                            lead.leadScore >= 600 ? "bg-orange-500" :
                                            lead.leadScore >= 400 ? "bg-yellow-500" :
                                            lead.leadScore >= 200 ? "bg-blue-400" :
                                            "bg-gray-400"
                                          )}>
                                            {lead.leadScore}
                                          </div>
                                          <span className="text-[10px] text-gray-400">
                                            {lead.leadScore >= 800 ? "🔥 Muito quente" :
                                             lead.leadScore >= 600 ? "🔥 Quente" :
                                             lead.leadScore >= 400 ? "🌡️ Morno" :
                                             lead.leadScore >= 200 ? "❄️ Frio" :
                                             "🥶 Muito frio"}
                                          </span>
                                        </div>
                                      )}

                                      {/* Footer: Origem + Telefone + Tempo na Etapa */}
                                      <div className="flex items-center justify-between text-xs text-gray-400 mt-1 pt-2 border-t border-gray-50">
                                        <div className="flex items-center gap-2">
                                          {getSourceIcon(lead.source)}
                                          <span>{formatPhone(lead.phone)}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <Clock className="w-3 h-3" />
                                          <span>{getTimeInStage(lead.updatedAt)}</span>
                                        </div>
                                      </div>

                                      {/* Link para conversa (área clicável transparente para não interferir no drag) */}
                                      {lead.conversationId && (
                                        <Link href={`/chats/${lead.conversationId}`} className="absolute inset-x-0 bottom-0 top-12 z-0" />
                                      )}
                                    </div>
                                  )}
                                </Draggable>
                              );
                            })
                          )}
                          {provided.placeholder}
                          <div
                            ref={(el) => { columnSentinelRefs.current[column.id] = el; }}
                            className="flex justify-center items-center py-4 min-h-[48px]"
                          >
                            {loadingMore && (
                              <Loader2 className="w-5 h-5 animate-spin text-[#001A5E]" />
                            )}
                            {!hasMore && leads.length > 0 && !loadingMore && (
                              <p className="text-xs text-gray-400">Todos carregados</p>
                            )}
                          </div>
                        </div>
                      )}
                    </Droppable>
                  </div>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      )}

      {/* Modal de Edição */}
      {editingLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-800">Editar Lead</h2>
              <button
                onClick={() => setEditingLead(null)}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveLead} className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                  <input
                    id="edit-name"
                    type="text"
                    name="name"
                    defaultValue={editingLead.name || editingLead.pushName || ""}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#001A5E] focus:ring-2 focus:ring-[#EEF2FF] outline-none text-sm"
                    placeholder="Nome do contato"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                  <input
                    type="text"
                    value={formatPhone(editingLead.phone)}
                    disabled
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="edit-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    id="edit-email"
                    type="email"
                    name="email"
                    defaultValue={(editingLead as any).email || ""}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#001A5E] focus:ring-2 focus:ring-[#EEF2FF] outline-none text-sm"
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div>
                  <label htmlFor="edit-city" className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
                  <input
                    id="edit-city"
                    type="text"
                    name="city"
                    defaultValue={(editingLead as any).city || ""}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#001A5E] focus:ring-2 focus:ring-[#EEF2FF] outline-none text-sm"
                    placeholder="Cidade"
                  />
                </div>
                <div>
                  <label htmlFor="edit-priority" className="block text-sm font-medium text-gray-700 mb-1">Prioridade</label>
                  <select
                    id="edit-priority"
                    name="priority"
                    defaultValue={editingLead.priority || "low"}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#001A5E] focus:ring-2 focus:ring-[#EEF2FF] outline-none text-sm"
                  >
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="edit-category" className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                <select
                  id="edit-category"
                  name="category"
                  defaultValue={editingLead.category || "geral"}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#001A5E] focus:ring-2 focus:ring-[#EEF2FF] outline-none text-sm"
                >
                  <option value="geral">Geral</option>
                  <option value="rotina">Cliente Rotina</option>
                  <option value="especializado">Cliente Especializado</option>
                  <option value="cobertura_total">Cliente Cobertura Total</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Etiquetas</label>
                <div className="flex flex-wrap gap-1.5">
                  {availableTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={cn(
                        "text-xs px-2.5 py-1 rounded-full font-medium transition-all border",
                        selectedTags.includes(tag.id)
                          ? "text-white border-transparent"
                          : "text-gray-600 border-gray-200 hover:border-[#F9A825]"
                      )}
                      style={selectedTags.includes(tag.id) ? { backgroundColor: tag.color } : {}}
                    >
                      {tag.name}
                    </button>
                  ))}
                  {availableTags.length === 0 && (
                    <span className="text-xs text-gray-400">Nenhuma etiqueta disponível</span>
                  )}
                </div>
              </div>
              <div>
                <label htmlFor="edit-notes" className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea
                  id="edit-notes"
                  name="notes"
                  defaultValue={(editingLead as any).notes || ""}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#001A5E] focus:ring-2 focus:ring-[#EEF2FF] outline-none resize-none text-sm"
                  placeholder="Anotações sobre o lead..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingLead(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[#001A5E] hover:bg-[#003080] text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSaving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {deletingLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Excluir Lead?</h2>
              <p className="text-gray-500 mb-6">
                Tem certeza que deseja excluir <strong>{deletingLead.name || deletingLead.pushName || "este lead"}</strong>?
                Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingLead(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteLead}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isDeleting ? "Excluindo..." : "Excluir"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
