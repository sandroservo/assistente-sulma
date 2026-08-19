"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type InfoCard = {
  id: string;
  title: string;
  filename: string;
  mimeType: string;
  imageUrl: string;
  createdAt: string | Date;
};

export function InfoCardsManager({ initialCards }: { initialCards: InfoCard[] }) {
  const [cards, setCards] = useState(initialCards);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function pickFile(next: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(next ? URL.createObjectURL(next) : null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !file) {
      setError("Preencha o nome e escolha uma imagem.");
      return;
    }
    setSaving(true);
    try {
      const body = new FormData();
      body.set("title", title.trim());
      body.set("file", file);
      const res = await fetch("/api/info-cards", { method: "POST", body });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Não foi possível cadastrar.");
        return;
      }
      setCards((prev) => [...prev, data.card]);
      setTitle("");
      pickFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch {
      setError("Erro ao cadastrar o card.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(card: InfoCard) {
    if (!confirm(`Excluir o card “${card.title}”?`)) return;
    setDeletingId(card.id);
    try {
      const res = await fetch(`/api/info-cards/${card.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Não foi possível excluir.");
        return;
      }
      setCards((prev) => prev.filter((c) => c.id !== card.id));
    } catch {
      setError("Erro ao excluir o card.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-800">Cards Informativos</h1>
        <p className="text-gray-500 text-sm mt-1">
          Cadastre imagens para enviar no chat. O que estiver aqui aparece na galeria da conversa.
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="bg-white border border-gray-200 rounded-2xl p-4 md:p-5 space-y-4"
      >
        <div className="grid gap-4 md:grid-cols-[1fr_220px] md:items-end">
          <div className="space-y-2">
            <Label htmlFor="card-title">Nome do card</Label>
            <Input
              id="card-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Grade curricular, Vestibular, Bolsas"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="card-file">Imagem</Label>
            <Input
              id="card-file"
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        {preview && (
          <div className="relative w-40 rounded-xl overflow-hidden border">
            <img src={preview} alt="Prévia" className="w-full h-24 object-cover" />
            <button
              type="button"
              onClick={() => {
                pickFile(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white"
              aria-label="Remover prévia"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" disabled={saving} className="bg-[#001A5E] hover:bg-[#003080]">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          <span className="ml-2">Cadastrar card</span>
        </Button>
      </form>

      {cards.length === 0 ? (
        <div className="border border-dashed border-gray-300 rounded-2xl py-16 text-center text-gray-500">
          Nenhum card cadastrado. Envie a primeira imagem acima.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {cards.map((card) => (
            <article
              key={card.id}
              className="group relative bg-white border border-gray-200 rounded-2xl overflow-hidden"
            >
              <img src={card.imageUrl} alt={card.title} className="w-full h-36 object-cover" />
              <div className="p-3 flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-gray-800 leading-snug">{card.title}</p>
                <button
                  type="button"
                  onClick={() => handleDelete(card)}
                  disabled={deletingId === card.id}
                  className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                  aria-label={`Excluir ${card.title}`}
                >
                  {deletingId === card.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
