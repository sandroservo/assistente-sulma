/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Etiquetas / Listas (tags). São a mesma coisa: na inbox viram "Listas" (filtro),
 * no lead viram "Etiquetas". Aqui é a central: criar, renomear, mudar cor e apagar
 * — inclusive as que já têm clientes acoplados (o vínculo com os leads é removido junto).
 */

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tag as TagIcon, Loader2, Trash2, Pencil, Check, X } from "lucide-react";

type Tag = { id: string; name: string; color: string; leadCount?: number };

export function TagsCard() {
  const [list, setList] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [addName, setAddName] = useState("");
  const [addColor, setAddColor] = useState("#001A5E");
  const [addLoading, setAddLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#001A5E");
  const [savingEdit, setSavingEdit] = useState(false);

  async function fetchList() {
    setLoading(true);
    try {
      const res = await fetch("/api/tags");
      const data = await res.json();
      if (Array.isArray(data.tags)) setList(data.tags);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchList(); }, []);

  async function handleAdd(e?: React.FormEvent) {
    e?.preventDefault();
    const name = addName.trim();
    if (!name) return;
    setAddLoading(true);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color: addColor }),
      });
      if (res.ok) { setAddName(""); fetchList(); }
    } finally {
      setAddLoading(false);
    }
  }

  function startEdit(t: Tag) {
    setEditingId(t.id);
    setEditName(t.name);
    setEditColor(t.color);
  }

  async function handleSaveEdit(id: string) {
    const name = editName.trim();
    if (!name) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/tags/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color: editColor }),
      });
      if (res.ok) {
        setList((prev) => prev.map((t) => (t.id === id ? { ...t, name, color: editColor } : t)));
        setEditingId(null);
      }
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleRemove(t: Tag) {
    const msg = t.leadCount
      ? `Apagar "${t.name}"? Está em ${t.leadCount} cliente(s) — será removida de todos.`
      : `Apagar "${t.name}"?`;
    if (!confirm(msg)) return;
    setDeletingId(t.id);
    try {
      const res = await fetch(`/api/tags/${t.id}`, { method: "DELETE" });
      if (res.ok) setList((prev) => prev.filter((x) => x.id !== t.id));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TagIcon className="h-5 w-5" />
          Etiquetas / Listas
        </CardTitle>
        <CardDescription>
          Rótulos dos leads. Na inbox aparecem como &quot;Listas&quot; (filtro) e no lead como &quot;Etiquetas&quot;. Renomeie, mude a cor ou apague — mesmo as que já têm clientes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Adicionar etiqueta">
          <div className="space-y-1">
            <Label htmlFor="tag-name">Nome</Label>
            <Input
              id="tag-name"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
              placeholder="VIP"
              className="w-48"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tag-color">Cor</Label>
            <Input
              id="tag-color"
              type="color"
              value={addColor}
              onChange={(e) => setAddColor(e.target.value)}
              className="w-16 h-10 p-1"
            />
          </div>
          <Button type="button" onClick={handleAdd} disabled={addLoading || !addName.trim()}>
            {addLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar"}
          </Button>
        </div>

        <div className="border rounded-lg divide-y min-h-[80px]">
          {loading ? (
            <div className="p-4 flex items-center justify-center text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Carregando...
            </div>
          ) : list.length === 0 ? (
            <div className="p-4 text-gray-500 text-sm">
              Nenhuma etiqueta. Crie rótulos para organizar leads e filtrar a inbox.
            </div>
          ) : (
            list.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-2 gap-2">
                {editingId === t.id ? (
                  <>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Input
                        type="color"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        className="w-10 h-9 p-1 shrink-0"
                      />
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(t.id); if (e.key === "Escape") setEditingId(null); }}
                        className="flex-1 min-w-0"
                        autoFocus
                      />
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => handleSaveEdit(t.id)} disabled={savingEdit} className="text-green-600" title="Salvar">
                      {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setEditingId(null)} className="text-gray-400" title="Cancelar">
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex items-center gap-2 text-sm min-w-0">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                      <span className="truncate">{t.name}</span>
                      {t.leadCount ? <span className="text-xs text-gray-400 shrink-0">{t.leadCount} cliente{t.leadCount !== 1 ? "s" : ""}</span> : null}
                    </span>
                    <span className="flex items-center gap-1 shrink-0">
                      <Button type="button" variant="ghost" size="icon" onClick={() => startEdit(t)} className="text-gray-500 hover:text-gray-700" title="Renomear / cor">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => handleRemove(t)} disabled={deletingId === t.id} className="text-red-600 hover:text-red-700 hover:bg-red-50" title="Apagar etiqueta">
                        {deletingId === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </span>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
