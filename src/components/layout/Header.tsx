"use client";

import { Menu, Bell, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  onMenuToggle?: () => void;
  title?: string;
}

export function Header({ onMenuToggle, title = "Dashboard Financiero" }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between h-16 px-4 md:px-8 border-b border-slate-200 bg-white/80 dark:bg-slate-900/80 dark:border-slate-800 backdrop-blur-md transition-colors">
      <div className="flex items-center gap-3">
        {/* Mobile menu trigger */}
        <Button
          variant="outline"
          size="icon"
          onClick={onMenuToggle}
          className="md:hidden text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700"
          aria-label="Abrir menú de navegación"
        >
          <Menu className="w-5 h-5" />
        </Button>

        <div>
          <h1 className="text-base md:text-lg font-bold text-slate-900 dark:text-white leading-tight">
            {title}
          </h1>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
            Moneda: COP · Zona horaria: America/Bogota
          </span>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 md:gap-3">
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
          <Wallet className="w-3.5 h-3.5" />
          <span>COP Activo</span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          aria-label="Notificaciones"
        >
          <Bell className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
