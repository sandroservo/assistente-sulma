/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Emoji Picker leve — sem dependências externas, organizado por categorias
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

const EMOJI_CATEGORIES: { label: string; icon: string; emojis: string[] }[] = [
  {
    label: "Frequentes",
    icon: "🕐",
    emojis: ["😀", "😂", "❤️", "👍", "🙏", "😊", "🔥", "🎉", "💪", "✅", "👏", "😍", "🤝", "💡", "⭐", "🚀"],
  },
  {
    label: "Rostos",
    icon: "😀",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗",
      "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶", "😏",
      "😒", "🙄", "😬", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🥵", "🥶",
      "🥴", "😵", "🤯", "🤠", "🥳", "🥸", "😎", "🤓", "🧐", "😕", "😟", "🙁", "☹️", "😮", "😯", "😲",
      "😳", "🥺", "😦", "😧", "😨", "😰", "😥", "😢", "😭", "😱", "😖", "😣", "😞", "😓", "😩", "😫",
      "🥱", "😤", "😡", "😠", "🤬", "😈", "👿", "💀", "☠️", "💩", "🤡", "👹", "👺", "👻", "👽", "👾",
    ],
  },
  {
    label: "Gestos",
    icon: "👋",
    emojis: [
      "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆",
      "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️",
      "💅", "🤳", "💪", "🦾", "🦿", "🦵", "🦶", "👂", "🦻", "👃", "🧠", "🫀", "🫁", "🦷", "🦴", "👀",
    ],
  },
  {
    label: "Corações",
    icon: "❤️",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖",
      "💘", "💝", "💟", "♥️", "😍", "🥰", "😘", "💋", "💌", "🫶",
    ],
  },
  {
    label: "Objetos",
    icon: "💡",
    emojis: [
      "💡", "🔥", "⭐", "🌟", "✨", "⚡", "💥", "🎉", "🎊", "🎈", "🎁", "🏆", "🥇", "🥈", "🥉", "🎯",
      "💰", "💵", "💳", "📱", "💻", "📧", "📞", "📌", "📎", "🔑", "🔒", "🔓", "📊", "📈", "📉", "📋",
      "📝", "✏️", "📅", "🗓️", "📣", "📢", "🔔", "🔕", "⏰", "⏳", "💊", "🩺", "🧪", "🧬", "🔬", "🔭",
    ],
  },
  {
    label: "Natureza",
    icon: "🌿",
    emojis: [
      "🌸", "🌺", "🌻", "🌹", "🌷", "💐", "🌿", "☘️", "🍀", "🌱", "🌲", "🌳", "🌴", "🌵", "🌈", "☀️",
      "🌤️", "⛅", "🌧️", "⛈️", "❄️", "🌊", "🐶", "🐱", "🐭", "🦁", "🐻", "🐼", "🐨", "🐯", "🦊", "🐸",
    ],
  },
  {
    label: "Comida",
    icon: "🍕",
    emojis: [
      "🍕", "🍔", "🍟", "🌭", "🍿", "🧁", "🍰", "🎂", "🍩", "🍪", "🍫", "🍬", "☕", "🍵", "🧃", "🍷",
      "🍺", "🥂", "🍹", "🥤", "🍎", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🥝", "🍑", "🥑", "🥕",
    ],
  },
  {
    label: "Símbolos",
    icon: "✅",
    emojis: [
      "✅", "❌", "⭕", "❗", "❓", "‼️", "⁉️", "💯", "🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "⚫", "⚪",
      "🟤", "🔶", "🔷", "▶️", "⏸️", "⏹️", "⏺️", "⏭️", "⏮️", "🔀", "🔁", "🔂", "➡️", "⬅️", "⬆️", "⬇️",
      "↩️", "↪️", "🔄", "➕", "➖", "✖️", "➗", "♾️", "💲", "©️", "®️", "™️",
    ],
  },
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export default function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState(0);
  const [search, setSearch] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Fecha com Escape
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  // Filtra emojis pela busca (busca no label da categoria)
  const filteredCategories = search.trim()
    ? EMOJI_CATEGORIES.map((cat) => ({
        ...cat,
        emojis: cat.emojis, // Emojis não têm nomes aqui, mostramos todos ao buscar
      })).filter((cat) => cat.label.toLowerCase().includes(search.toLowerCase()))
    : EMOJI_CATEGORIES;

  // Se busca ativa, junta todos os emojis únicos
  const allEmojisFlat = search.trim()
    ? Array.from(
        new Set(EMOJI_CATEGORIES.flatMap((c) => c.emojis))
      )
    : null;

  return (
    <div
      ref={pickerRef}
      className="absolute bottom-12 left-0 z-50 w-[320px] bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden"
      role="dialog"
      aria-label="Seletor de emojis"
    >
      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <input
          type="text"
          placeholder="Buscar categoria..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#001A5E]/20 focus:border-[#001A5E]"
          aria-label="Buscar emojis"
          autoFocus
        />
      </div>

      {/* Category tabs */}
      {!search.trim() && (
        <div className="flex px-2 gap-0.5 border-b border-gray-100 pb-1">
          {EMOJI_CATEGORIES.map((cat, idx) => (
            <button
              key={cat.label}
              onClick={() => setActiveCategory(idx)}
              className={cn(
                "flex-1 py-1 text-center text-base rounded-md transition-colors",
                activeCategory === idx
                  ? "bg-[#E8EDF8]"
                  : "hover:bg-gray-100"
              )}
              title={cat.label}
              aria-label={cat.label}
            >
              {cat.icon}
            </button>
          ))}
        </div>
      )}

      {/* Emoji grid */}
      <div className="h-[240px] overflow-y-auto px-2 py-2">
        {search.trim() ? (
          // Mostra todos os emojis ao buscar
          <div>
            {filteredCategories.length > 0 ? (
              filteredCategories.map((cat) => (
                <div key={cat.label} className="mb-2">
                  <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider px-1 mb-1">
                    {cat.label}
                  </p>
                  <div className="grid grid-cols-8 gap-0.5">
                    {cat.emojis.map((emoji, i) => (
                      <button
                        key={`${cat.label}-${i}`}
                        onClick={() => {
                          onSelect(emoji);
                          onClose();
                        }}
                        className="w-9 h-9 flex items-center justify-center text-xl rounded-md hover:bg-gray-100 transition-colors"
                        aria-label={`Emoji ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              // Se não encontrou nada na busca, mostra todos
              <div className="grid grid-cols-8 gap-0.5">
                {allEmojisFlat?.map((emoji, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      onSelect(emoji);
                      onClose();
                    }}
                    className="w-9 h-9 flex items-center justify-center text-xl rounded-md hover:bg-gray-100 transition-colors"
                    aria-label={`Emoji ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          // Mostra a categoria ativa
          <div>
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider px-1 mb-1">
              {EMOJI_CATEGORIES[activeCategory].label}
            </p>
            <div className="grid grid-cols-8 gap-0.5">
              {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji, i) => (
                <button
                  key={i}
                  onClick={() => {
                    onSelect(emoji);
                  }}
                  className="w-9 h-9 flex items-center justify-center text-xl rounded-md hover:bg-gray-100 transition-colors"
                  aria-label={`Emoji ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
