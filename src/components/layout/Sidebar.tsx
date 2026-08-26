/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  LayoutDashboard,
  MessageSquare,
  ClipboardList,
  Settings,
  BookOpen,
  Users,
  BarChart3,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  Contact,
  Menu,
  X,
  LayoutGrid,
  Megaphone,
  Workflow,
  TrendingUp,
} from "lucide-react";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/chats", icon: MessageSquare, label: "Chats" },
  { href: "/contacts", icon: Contact, label: "Contatos" },
  { href: "/kanban", icon: ClipboardList, label: "Kanban" },
  { href: "/info-cards", icon: LayoutGrid, label: "Cards Informativos" },
  { href: "/campaigns", icon: Megaphone, label: "Campanhas" },
  { href: "/flows", icon: Workflow, label: "Fluxos" },
  { href: "/knowledge", icon: BookOpen, label: "Conhecimento" },
  { href: "/users", icon: Users, label: "Usuários" },
  { href: "/reports", icon: BarChart3, label: "Relatórios" },
  { href: "/insights", icon: TrendingUp, label: "Insights" },
  { href: "/settings", icon: Settings, label: "Configurações" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Ao entrar no Kanban, menu recolhido (desktop)
  useEffect(() => {
    if (pathname.startsWith("/kanban")) {
      setCollapsed(true);
    }
  }, [pathname]);

  // Fecha menu mobile ao navegar
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Bloqueia scroll do body quando menu mobile está aberto
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const sidebarContent = (isMobile: boolean) => (
    <>
      <div className={cn("border-b border-gray-100 flex shrink-0", collapsed && !isMobile ? "p-2 justify-center" : "p-5 justify-center")}>
        <Link href="/" className={collapsed && !isMobile ? "flex justify-center w-10 h-10" : "flex justify-center"}>
          <Image
            src={collapsed && !isMobile ? "/assets/logo-mark.png" : "/assets/logo.png"}
            alt="Unisulma"
            width={collapsed && !isMobile ? 40 : 160}
            height={collapsed && !isMobile ? 40 : 56}
            className="object-contain"
          />
        </Link>
      </div>

      {!isMobile && (
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            "flex items-center gap-3 px-4 py-2.5 mx-3 mt-3 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-all",
            collapsed && "justify-center px-2 mx-2"
          )}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          {!collapsed && <span>Recolher</span>}
        </button>
      )}

      {(isMobile || !collapsed) && (
        <div className="px-4 pt-2">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium px-3 mb-2">
            Menu de Navegação
          </p>
        </div>
      )}

      <nav className="flex-1 px-3 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                    collapsed && !isMobile && "justify-center px-2",
                    isActive
                      ? "bg-[#001A5E] text-white"
                      : "text-gray-600 hover:bg-gray-50"
                  )}
                  title={collapsed && !isMobile ? item.label : undefined}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {(isMobile || !collapsed) && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={cn("rounded-xl bg-gray-50 shrink-0", collapsed && !isMobile ? "p-2 m-2 flex justify-center" : "p-4 m-3 mb-2")}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#001A5E] flex items-center justify-center text-white font-semibold text-sm shrink-0">
            S
          </div>
          {(isMobile || !collapsed) && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">Sulma Assistente</p>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <p className="text-xs text-gray-500">Online</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-3 pb-1">
        <ThemeToggle collapsed={collapsed && !isMobile} />
      </div>

      <div className="px-3 pb-4">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className={cn(
            "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium w-full text-gray-600 hover:bg-red-50 hover:text-red-600 transition-all duration-200",
            collapsed && !isMobile && "justify-center px-2"
          )}
          title={collapsed && !isMobile ? "Sair" : undefined}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {(isMobile || !collapsed) && <span>Sair</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Botão hamburger — mobile only (oculto dentro de conversa ativa) */}
      {!/^\/chats\/.+/.test(pathname) && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="fixed top-3 left-3 z-50 md:hidden p-2 rounded-lg bg-white border border-gray-200 shadow-sm text-gray-700"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {/* Sidebar desktop */}
      <aside
        className={cn(
          "hidden md:flex bg-white border-r border-gray-100 flex-col h-screen sticky top-0 transition-[width] duration-200",
          collapsed ? "w-[72px]" : "w-64"
        )}
      >
        {sidebarContent(false)}
      </aside>

      {/* Overlay mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white flex flex-col shadow-xl animate-in slide-in-from-left duration-200">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 p-2 rounded-lg hover:bg-gray-100 text-gray-500"
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent(true)}
          </aside>
        </div>
      )}
    </>
  );
}
