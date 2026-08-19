"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Workflow, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Flow = { id: string; name: string; active: boolean; updatedAt: string | Date };

export function FlowsList({ initialFlows }: { initialFlows: Flow[] }) {
  const router = useRouter();
  const [flows, setFlows] = useState(initialFlows);
  const [creating, setCreating] = useState(false);

  async function create() {
    setCreating(true);
    try {
      const res = await fetch("/api/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Novo fluxo" }),
      });
      const data = await res.json();
      if (data.ok) router.push(`/flows/${data.flow.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Excluir este fluxo?")) return;
    await fetch(`/api/flows/${id}`, { method: "DELETE" });
    setFlows((prev) => prev.filter((f) => f.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fluxos</h1>
          <p className="text-sm text-muted-foreground">Editor visual de chatbot (MVP).</p>
        </div>
        <Button onClick={create} disabled={creating}>
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Novo fluxo
        </Button>
      </div>

      <div className="space-y-2">
        {flows.length === 0 && <p className="text-sm text-muted-foreground">Nenhum fluxo ainda.</p>}
        {flows.map((f) => (
          <div key={f.id} className="flex items-center justify-between rounded-lg border p-4">
            <button className="flex items-center gap-3 text-left" onClick={() => router.push(`/flows/${f.id}`)}>
              <Workflow className="h-5 w-5 text-[#001A5E]" />
              <div>
                <span className="font-medium">{f.name}</span>
                <p className="text-xs text-muted-foreground">
                  Atualizado {new Date(f.updatedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                </p>
              </div>
            </button>
            <div className="flex items-center gap-2">
              {f.active ? <Badge className="bg-green-100 text-green-700">Ativo</Badge> : <Badge className="bg-gray-200 text-gray-600">Inativo</Badge>}
              <Button size="sm" variant="outline" onClick={() => remove(f.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
