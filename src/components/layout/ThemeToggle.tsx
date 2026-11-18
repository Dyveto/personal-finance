"use client";

import { useEffect, useState, useCallback } from "react";
import { Sun, Moon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  applyThemeToDOM,
  saveThemePreference,
  getThemePreference,
  dispatchThemeEvent,
  THEME_EVENT_NAME,
} from "@/lib/theme";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Sincronizar estado inicial desde el DOM / localStorage
  useEffect(() => {
    setMounted(true);

    const syncTheme = () => {
      try {
        const isDark = getThemePreference();
        setIsDarkMode(isDark);
        applyThemeToDOM(isDark);
      } catch {
        // Ignorar excepciones en entornos sin DOM o Storage
      }
    };

    syncTheme();

    // Sincronizar reactivamente entre instancias múltiples (desktop y mobile drawer)
    const handleThemeChangeEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ isDark: boolean }>;
      if (customEvent.detail && typeof customEvent.detail.isDark === "boolean") {
        setIsDarkMode(customEvent.detail.isDark);
      } else {
        syncTheme();
      }
    };

    window.addEventListener(THEME_EVENT_NAME, handleThemeChangeEvent);
    window.addEventListener("storage", syncTheme);

    return () => {
      window.removeEventListener(THEME_EVENT_NAME, handleThemeChangeEvent);
      window.removeEventListener("storage", syncTheme);
    };
  }, []);

  const handleToggle = useCallback((targetDark: boolean) => {
    setIsDarkMode(targetDark);
    applyThemeToDOM(targetDark);
    try {
      saveThemePreference(targetDark);
    } catch {
      // Ignorar excepciones de almacenamiento local
    }
    dispatchThemeEvent(targetDark);
  }, []);

  // Prevenir desajuste de hidratación inicial mientras monta
  if (!mounted) {
    return (
      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100 dark:bg-[#131B2E] border border-slate-200 dark:border-white/[0.08] transition-colors">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#8B5CF6]/15 border border-[#8B5CF6]/25 flex items-center justify-center text-[#8B5CF6]">
            <Moon className="w-3.5 h-3.5" />
          </div>
          <div className="text-left">
            <span className="text-xs font-semibold text-slate-800 dark:text-[#F8FAFC] block leading-tight">
              Modo Noche
            </span>
            <span className="text-[10px] text-slate-400 dark:text-[#94A3B8] block leading-tight">
              Oscuro
            </span>
          </div>
        </div>
        <div className="h-5 w-9 rounded-full bg-slate-300 dark:bg-slate-700 animate-pulse" />
      </div>
    );
  }

  return (
    <div
      onClick={() => handleToggle(!isDarkMode)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleToggle(!isDarkMode);
        }
      }}
      className={cn(
        "flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer select-none group",
        isDarkMode
          ? "bg-[#131B2E] hover:bg-[#1a233a] border-white/[0.08]"
          : "bg-white hover:bg-slate-50 border-slate-200 shadow-sm"
      )}
      aria-label={`Cambiar a ${isDarkMode ? "Modo Día" : "Modo Noche"}`}
    >
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-300",
            isDarkMode
              ? "bg-[#8B5CF6]/15 text-[#8B5CF6] border border-[#8B5CF6]/25 group-hover:bg-[#8B5CF6]/25"
              : "bg-amber-500/15 text-amber-600 border border-amber-500/25 group-hover:bg-amber-500/25"
          )}
        >
          {isDarkMode ? (
            <Moon className="w-3.5 h-3.5 transition-transform duration-300 group-hover:rotate-12" />
          ) : (
            <Sun className="w-3.5 h-3.5 transition-transform duration-300 group-hover:rotate-45" />
          )}
        </div>
        <div className="text-left">
          <span className="text-xs font-semibold text-slate-800 dark:text-[#F8FAFC] block leading-tight">
            {isDarkMode ? "Modo Noche" : "Modo Día"}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-[#94A3B8] block leading-tight">
            {isDarkMode ? "Tema oscuro activo" : "Tema claro activo"}
          </span>
        </div>
      </div>

      <div onClick={(e) => e.stopPropagation()}>
        <Switch
          checked={isDarkMode}
          onCheckedChange={handleToggle}
          aria-label="Alternar tema oscuro y claro"
        />
      </div>
    </div>
  );
}
