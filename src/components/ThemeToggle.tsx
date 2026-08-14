/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Alterna tema claro/escuro. Persiste em localStorage; aplica data-theme no <html>.
 */

"use client";

import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark");
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    localStorage.setItem("sulma_theme", next ? "dark" : "light");
  };

  return (
    <button
      onClick={toggle}
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium w-full text-gray-600 hover:bg-gray-100 transition-all duration-200",
        collapsed && "justify-center px-2"
      )}
      title={dark ? "Tema claro" : "Tema escuro"}
      aria-label={dark ? "Ativar tema claro" : "Ativar tema escuro"}
    >
      {dark ? <Sun className="h-5 w-5 shrink-0" /> : <Moon className="h-5 w-5 shrink-0" />}
      {!collapsed && <span>{dark ? "Tema claro" : "Tema escuro"}</span>}
    </button>
  );
}
