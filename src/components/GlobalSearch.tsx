/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Busca global (⌘K / Ctrl+K) sobre todos os leads da org. Navega p/ a conversa.
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, X } from "lucide-react";

type Result = { leadId: string; name: string; phone: string; conversationId: string | null };

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Atalho ⌘K / Ctrl+K abre; Esc fecha.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else { setQ(""); setResults([]); }
  }, [open]);

  // Busca com debounce.
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data.results ?? []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const go = useCallback((r: Result) => {
    setOpen(false);
    if (r.conversationId) router.push(`/chats/${r.conversationId}`);
    else router.push(`/leads?lead=${r.leadId}`);
  }, [router]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/40 flex items-start justify-center pt-[15vh] px-4"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 border-b">
          <Search className="h-4 w-4 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar cliente por nome ou telefone..."
            className="flex-1 py-3 text-sm outline-none"
          />
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          ) : (
            <button onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Fechar">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="max-h-[50vh] overflow-y-auto">
          {q.trim().length >= 2 && !loading && results.length === 0 && (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">Nenhum cliente encontrado</p>
          )}
          {results.map((r) => (
            <button
              key={r.leadId}
              onClick={() => go(r)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50 border-b border-gray-50"
            >
              <span className="text-sm font-medium text-gray-800 truncate">{r.name}</span>
              <span className="text-xs text-gray-400 shrink-0 ml-3">{r.phone}</span>
            </button>
          ))}
          {q.trim().length < 2 && (
            <p className="px-4 py-6 text-xs text-gray-400 text-center">
              Digite ao menos 2 caracteres · <kbd className="px-1 rounded bg-gray-100">Esc</kbd> fecha
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
