/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Lista de exceção: números para a Sulma NÃO responder (ex.: pessoas da empresa).
 */

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserMinus, Loader2, Trash2 } from "lucide-react";

type ExcludedContact = {
  id: string;
  phone: string;
  name: string | null;
  createdAt: string;
};

export function ExcludedContactsCard() {
  const [list, setList] = useState<ExcludedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [addPhone, setAddPhone] = useState("");
  const [addName, setAddName] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function fetchList() {
    setLoading(true);
    try {
      const res = await fetch("/api/excluded-contacts");
      const data = await res.json();
      if (data.ok && Array.isArray(data.list)) {
        setList(data.list);
      }
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchList();
  }, []);

  async function handleAdd(e?: React.FormEvent) {
    e?.preventDefault();
    const phone = addPhone.trim();
    if (!phone) return;
    setAddLoading(true);
    setAddError(null);
    try {
      const res = await fetch("/api/excluded-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, name: addName.trim() || undefined }),
      });
      const data = await res.json();
      if (data.ok) {
        setAddPhone("");
        setAddName("");
        fetchList();
      } else {
        setAddError(data.error || "Erro ao adicionar");
      }
    } catch {
      setAddError("Erro ao adicionar");
    } finally {
      setAddLoading(false);
    }
  }

  async function handleRemove(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/excluded-contacts/${id}`, { method: "DELETE" });
      if (res.ok) {
        setList((prev) => prev.filter((c) => c.id !== id));
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserMinus className="h-5 w-5" />
          Lista de exceção
        </CardTitle>
        <CardDescription>
          Números para a Sulma <strong>não</strong> responder (ex.: pessoas da empresa, comerciais). Quem estiver na lista não receberá resposta automática da Sulma.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Adicionar à lista de exceção">
          <div className="space-y-1">
            <Label htmlFor="excluded-phone">Telefone</Label>
            <Input
              id="excluded-phone"
              value={addPhone}
              onChange={(e) => setAddPhone(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
              placeholder="11999999999 ou 5511999999999"
              className="w-48"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="excluded-name">Nome (opcional)</Label>
            <Input
              id="excluded-name"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
              placeholder="João - Comercial"
              className="w-40"
            />
          </div>
          <Button type="button" onClick={handleAdd} disabled={addLoading || !addPhone.trim()}>
            {addLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Adicionar"
            )}
          </Button>
        </div>
        {addError && (
          <p className="text-sm text-red-600">{addError}</p>
        )}

        <div className="border rounded-lg divide-y min-h-[80px]">
          {loading ? (
            <div className="p-4 flex items-center justify-center text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Carregando...
            </div>
          ) : list.length === 0 ? (
            <div className="p-4 text-gray-500 text-sm">
              Nenhum número na lista. Adicione telefones para a Sulma não responder.
            </div>
          ) : (
            list.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between px-4 py-2"
              >
                <span className="font-mono text-sm">{c.phone}</span>
                <span className="text-gray-600 text-sm">
                  {c.name || "—"}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(c.id)}
                  disabled={deletingId === c.id}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  title="Remover da lista"
                >
                  {deletingId === c.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
