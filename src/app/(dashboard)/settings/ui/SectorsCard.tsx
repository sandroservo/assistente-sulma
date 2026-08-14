/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Setores/filas de atendimento (Vendas, Suporte, Financeiro...).
 */

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Layers, Loader2, Trash2 } from "lucide-react";

type Sector = { id: string; name: string; color: string };

export function SectorsCard() {
  const [list, setList] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [addName, setAddName] = useState("");
  const [addColor, setAddColor] = useState("#001A5E");
  const [addLoading, setAddLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function fetchList() {
    setLoading(true);
    try {
      const res = await fetch("/api/sectors");
      const data = await res.json();
      if (Array.isArray(data.sectors)) setList(data.sectors);
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
      const res = await fetch("/api/sectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color: addColor }),
      });
      if (res.ok) { setAddName(""); fetchList(); }
    } finally {
      setAddLoading(false);
    }
  }

  async function handleRemove(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/sectors/${id}`, { method: "DELETE" });
      if (res.ok) setList((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Setores / filas
        </CardTitle>
        <CardDescription>
          Filas de atendimento para rotear conversas (ex.: Vendas, Suporte, Financeiro). Atribua o setor na conversa e filtre a inbox por setor.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Adicionar setor">
          <div className="space-y-1">
            <Label htmlFor="sector-name">Nome</Label>
            <Input
              id="sector-name"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
              placeholder="Vendas"
              className="w-48"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sector-color">Cor</Label>
            <Input
              id="sector-color"
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
              Nenhum setor. Adicione filas para organizar o atendimento.
            </div>
          ) : (
            list.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-2">
                <span className="flex items-center gap-2 text-sm">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.name}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(s.id)}
                  disabled={deletingId === s.id}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  title="Excluir setor"
                >
                  {deletingId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
