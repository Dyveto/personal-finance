"use client";

import { Sparkles, Layers, RotateCcw, X, Save, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WelcomeHubBannerProps {
  visibleCount: number;
  totalCount: number;
  isSaving: boolean;
  saveFeedback: string | null;
  onOpenManager: () => void;
  onReset: () => void;
  onCancel: () => void;
  onSave: () => void;
}

export function WelcomeHubBanner({
  visibleCount,
  totalCount,
  isSaving,
  saveFeedback,
  onOpenManager,
  onReset,
  onCancel,
  onSave,
}: WelcomeHubBannerProps) {
  return (
    <div className="space-y-3">
      {/* Mensaje de confirmación temporal si existe */}
      {saveFeedback && (
        <div className="p-3.5 rounded-xl border border-[#10B981]/40 bg-[#10B981]/15 text-[#10B981] flex items-center gap-2.5 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-semibold">{saveFeedback}</span>
        </div>
      )}

      {/* Banner Principal PS5 Welcome Hub */}
      <div className="surface-card p-5 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-50/90 via-white to-amber-50/90 dark:from-[#0E1526]/95 dark:via-[#131B2E]/95 dark:to-[#0E1526]/95 shadow-[0_0_30px_rgba(217,119,6,0.18)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-600 dark:text-[#D4AF37] shadow-[0_0_15px_rgba(217,119,6,0.4)] flex-shrink-0">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-heading font-bold text-slate-900 dark:text-[#F8FAFC] tracking-tight">
                  Modo Personalización (Welcome Hub)
                </h3>
                <span className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-[#D4AF37] border border-amber-500/30">
                  {visibleCount} de {totalCount} visibles
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-0.5">
                Arrastra las secciones o usa las flechas para reorganizar el espacio. Guarda tus cambios para sincronizarlos con tu perfil.
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenManager}
              className="rounded-xl border-slate-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.05] hover:bg-slate-100 dark:hover:bg-white/[0.1] text-xs font-semibold text-slate-800 dark:text-[#F8FAFC]"
            >
              <Layers className="w-3.5 h-3.5 mr-1.5 text-amber-600 dark:text-[#D4AF37]" />
              Gestionar Secciones
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onReset}
              className="rounded-xl border-slate-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.05] hover:bg-slate-100 dark:hover:bg-white/[0.1] text-xs font-semibold text-slate-600 dark:text-slate-300"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Restablecer
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Cancelar
            </Button>

            <Button
              type="button"
              size="sm"
              disabled={isSaving}
              onClick={onSave}
              className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white dark:bg-[#D4AF37] dark:hover:bg-[#C5A059] dark:text-slate-950 dark:font-bold text-xs font-semibold shadow-[0_0_20px_rgba(217,119,6,0.35)] flex items-center gap-1.5"
            >
              {isSaving ? (
                <>
                  <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Guardar Cambios</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
