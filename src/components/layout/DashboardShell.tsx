"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Cerrar el drawer con la tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Prevenir scroll en el fondo cuando el menú móvil está abierto
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [mobileMenuOpen]);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-[#F8FAFC] overflow-hidden transition-colors duration-300">
      {/* Sidebar fijo en escritorio */}
      <div className="hidden md:flex md:flex-shrink-0">
        <Sidebar />
      </div>

      {/* Drawer móvil */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Menú móvil"
        >
          {/* Backdrop con desenfoque */}
          <div
            className="fixed inset-0 bg-slate-900/60 dark:bg-[#0B0F19]/80 backdrop-blur-md transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Contenido del drawer */}
          <div className="relative flex flex-col w-72 max-w-[80vw] h-full bg-white dark:bg-[#131B2E] border-r border-slate-200 dark:border-white/[0.08] shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {/* Botón de cierre */}
            <div className="absolute top-3 right-3 z-20">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-xl"
                aria-label="Cerrar menú móvil"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <Sidebar onNavigate={() => setMobileMenuOpen(false)} className="w-full border-r-0" />
          </div>
        </div>
      )}

      {/* Área principal de contenido */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-[#F8FAFC] transition-colors duration-300">
        <Header onMenuToggle={() => setMobileMenuOpen(true)} />

        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8 focus:outline-none">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
