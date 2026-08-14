/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  BookOpen,
  Loader2,
  Filter,
} from "lucide-react";

interface KnowledgeItem {
  id: string;
  category: string;
  title: string;
  content: string;
  keywords: string | null;
  priority: number;
  active: boolean;
}

interface Props {
  initialItems: KnowledgeItem[];
  categories: string[];
}

const CATEGORY_LABELS: Record<string, string> = {
  planos: "📋 Planos",
  "check-ups": "🩺 Check-ups",
  regras: "📜 Regras",
  atendimento: "🏥 Atendimento",
  links: "🔗 Links",
  pagamento: "💳 Pagamento",
  carencia: "⏳ Carência",
  locais: "📍 Locais",
  faq: "❓ FAQ",
};

// Cores suaves e agradáveis: fundo pastel + texto escuro
const CATEGORY_COLORS: Record<string, string> = {
  planos: "bg-sky-200 text-sky-800 border border-sky-300/50",
  "check-ups": "bg-emerald-200 text-emerald-800 border border-emerald-300/50",
  regras: "bg-rose-200 text-rose-800 border border-rose-300/50",
  atendimento: "bg-violet-200 text-violet-800 border border-violet-300/50",
  links: "bg-amber-200 text-amber-800 border border-amber-300/50",
  pagamento: "bg-yellow-100 text-amber-800 border border-amber-200/50",
  carencia: "bg-slate-200 text-slate-700 border border-slate-300/50",
  locais: "bg-teal-200 text-teal-800 border border-teal-300/50",
  faq: "bg-indigo-100 text-indigo-800 border border-indigo-200/50",
};

const BADGE_FALLBACK = "bg-slate-200 text-slate-700 border border-slate-300/50";

export function KnowledgeManager({ initialItems, categories }: Props) {
  const [items, setItems] = useState<KnowledgeItem[]>(initialItems);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    category: "",
    title: "",
    content: "",
    keywords: "",
    priority: 5,
  });

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      search === "" ||
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.content.toLowerCase().includes(search.toLowerCase()) ||
      item.keywords?.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      filterCategory === "all" || item.category === filterCategory;

    return matchesSearch && matchesCategory;
  });

  const groupedItems = filteredItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, KnowledgeItem[]>);

  function resetForm() {
    setFormData({
      category: "",
      title: "",
      content: "",
      keywords: "",
      priority: 5,
    });
    setEditingItem(null);
  }

  function openEditForm(item: KnowledgeItem) {
    setFormData({
      category: item.category,
      title: item.title,
      content: item.content,
      keywords: item.keywords || "",
      priority: item.priority,
    });
    setEditingItem(item);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const url = editingItem
        ? `/api/knowledge/${editingItem.id}`
        : "/api/knowledge";
      const method = editingItem ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const data = await res.json();

        if (editingItem) {
          setItems(items.map((i) => (i.id === editingItem.id ? data.item : i)));
        } else {
          setItems([data.item, ...items]);
        }

        setShowForm(false);
        resetForm();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(item: KnowledgeItem) {
    if (!confirm(`Tem certeza que deseja excluir "${item.title}"?`)) return;

    try {
      const res = await fetch(`/api/knowledge/${item.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setItems(items.filter((i) => i.id !== item.id));
      }
    } catch (error) {
      console.error("Erro ao excluir:", error);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Base de Conhecimento</h1>
          <p className="text-gray-500">
            {items.length} itens • Gerencie as informações da Sulma
          </p>
        </div>

        <Dialog open={showForm} onOpenChange={(open) => {
          setShowForm(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-[#001A5E] hover:bg-[#003080]">
              <Plus className="h-4 w-4 mr-2" />
              Novo Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? "Editar Item" : "Novo Item"}
              </DialogTitle>
              <DialogDescription>
                {editingItem
                  ? "Edite as informações abaixo"
                  : "Adicione um novo conhecimento para a Sulma"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Categoria</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(v) => setFormData({ ...formData, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planos">📋 Planos</SelectItem>
                      <SelectItem value="check-ups">🩺 Check-ups</SelectItem>
                      <SelectItem value="regras">📜 Regras</SelectItem>
                      <SelectItem value="atendimento">🏥 Atendimento</SelectItem>
                      <SelectItem value="links">🔗 Links</SelectItem>
                      <SelectItem value="pagamento">💳 Pagamento</SelectItem>
                      <SelectItem value="faq">❓ FAQ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Prioridade (1-10)</Label>
                  <Input
                    id="priority"
                    type="number"
                    min={1}
                    max={10}
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: parseInt(e.target.value) || 5 })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Plano Rotina - R$ 37,90/mês"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Conteúdo</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Descreva detalhadamente..."
                  rows={8}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="keywords">Palavras-chave (separadas por vírgula)</Label>
                <Input
                  id="keywords"
                  value={formData.keywords}
                  onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                  placeholder="Ex: rotina, básico, 37,90"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !formData.category || !formData.title}
                  className="flex-1 bg-[#001A5E] hover:bg-[#003080]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : editingItem ? (
                    "Salvar Alterações"
                  ) : (
                    "Criar Item"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtros */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Pesquisar por título, conteúdo ou palavras-chave..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[200px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filtrar categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {CATEGORY_LABELS[cat] || cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista em Accordion */}
      {Object.keys(groupedItems).length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-gray-300 mb-4" />
            <p className="text-gray-500 text-center">
              {search || filterCategory !== "all"
                ? "Nenhum item encontrado com os filtros aplicados."
                : "Nenhum item na base de conhecimento."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-2" defaultValue={Object.keys(groupedItems)}>
          {Object.entries(groupedItems).map(([category, categoryItems]) => (
            <AccordionItem
              key={category}
              value={category}
              className="border rounded-lg px-4"
            >
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <Badge className={CATEGORY_COLORS[category] || BADGE_FALLBACK}>
                    {CATEGORY_LABELS[category] || category}
                  </Badge>
                  <span className="text-sm text-gray-500">
                    {categoryItems.length} {categoryItems.length === 1 ? "item" : "itens"}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2">
                  {categoryItems.map((item) => (
                    <div
                      key={item.id}
                      className="bg-gray-50 rounded-lg p-4 border"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-800 mb-1">
                            {item.title}
                          </h4>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-4">
                            {item.content}
                          </p>
                          {item.keywords && (
                            <div className="mt-2 flex gap-1 flex-wrap">
                              {item.keywords.split(",").map((kw, i) => (
                                <span
                                  key={`${item.id}-kw-${i}`}
                                  className="px-2 py-0.5 bg-white border text-gray-500 text-xs rounded"
                                >
                                  {kw.trim()}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditForm(item)}
                            className="h-8 w-8 p-0"
                          >
                            <Pencil className="h-4 w-4 text-gray-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(item)}
                            className="h-8 w-8 p-0 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
