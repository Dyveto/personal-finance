"use client";

import { Menu, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { BrandLogo } from "@/components/shared/BrandLogo";

interface HeaderProps {
  onMenuToggle?: () => void;
  title?: string;
}

export function Header({ onMenuToggle, title = "Dashboard Financiero" }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between h-16 px-4 md:px-8 border-b border-slate-200 dark:border-white/[0.08] bg-white/80 dark:bg-[#0B0F19]/80 backdrop-blur-md transition-colors">
      <div className="flex items-center gap-3">
        {/* Mobile menu trigger */}
        <Button
          variant="outline"
          size="icon"
          onClick={onMenuToggle}
          className="md:hidden text-slate-700 dark:text-[#F8FAFC] border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#131B2E] hover:bg-slate-100 dark:hover:bg-[#1a233a]"
          aria-label="Abrir menú de navegación"
        >
          <Menu className="w-5 h-5" />
        </Button>

        <div className="md:hidden flex items-center">
          <BrandLogo variant="icon" size="sm" href="/" priority />
        </div>

        <div>
          <h1 className="text-base md:text-lg font-heading font-bold text-slate-900 dark:text-[#F8FAFC] leading-tight">
            {title}
          </h1>
          <span className="text-[11px] text-slate-500 dark:text-[#94A3B8] hidden sm:block">
            Moneda: COP · Zona horaria: America/Bogota
          </span>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 md:gap-3">
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#10B981]/10 border border-[#10B981]/20 text-[#10B981] text-xs font-semibold">
          <Wallet className="w-3.5 h-3.5" />
          <span>COP Activo</span>
        </div>

        <NotificationBell />
      </div>
    </header>
  );
}
