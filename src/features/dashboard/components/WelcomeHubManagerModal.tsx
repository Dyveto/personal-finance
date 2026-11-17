"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  ChevronUp,
  ChevronDown,
  Layers,
  RotateCcw,
  Check,
  Wallet,
  BarChart3,
  CalendarClock,
  CreditCard,
  Clock,
} from "lucide-react";

export interface WidgetMeta {
  id: string;
  name: string;
  description: string;
  icon: "wallet" | "bar-chart" | "calendar" | "credit-card" | "clock";
}

export const WIDGET_METADATA: Record<string, WidgetMeta> = {
  kpi_summary: {
    id: "kpi_summary",
    name: "Métricas Principales (KPIs)",
    description: "Dinero disponible, deuda total en tarjetas y cupo crediticio consolidado",
    icon: "wallet",
  },
  financial_charts: {
    id: "financial_charts",
    name: "Gráficos Financieros Interactivos",
    description: "Flujo de ingresos vs. gastos con filtros temporales y porcentaje por categorías",
    icon: "bar-chart",
  },
  installment_projections: {
    id: "installment_projections",
    name: "Proyecciones y Extractos",
    description: "Cuotas diferidas a futuro y control de pagos mensuales de tarjetas",
    icon: "calendar",
  },
  active_accounts: {
    id: "active_accounts",
    name: "Cuentas y Tarjetas Activas",
    description: "Saldos bancarios, efectivo y límites de crédito por entidad",
    icon: "credit-card",
  },
  recent_transactions: {
    id: "recent_transactions",
    name: "Transacciones Recientes",
    description: "Historial de los últimos movimientos de ingresos, gastos y cuotas",
    icon: "clock",
  },
};

function renderWidgetIcon(icon: WidgetMeta["icon"]) {
  switch (icon) {
    case "wallet":
      return <Wallet className="w-4 h-4 text-[#10B981]" />;
    case "bar-chart":
      return <BarChart3 className="w-4 h-4 text-[#8B5CF6]" />;
    case "calendar":
      return <CalendarClock className="w-4 h-4 text-[#EC4899]" />;
    case "credit-card":
      return <CreditCard className="w-4 h-4 text-[#F43F5E]" />;
    case "clock":
      return <Clock className="w-4 h-4 text-[#06B6D4]" />;
  }
}

interface WelcomeHubManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  widgetOrder: string[];
  visibleWidgets: string[];
  onMoveWidget: (id: string, direction: "up" | "down") => void;
  onToggleVisibility: (id: string) => void;
  onShowAll: () => void;
  onResetDefaults: () => void;
}

export function WelcomeHubManagerModal({
  open,
  onOpenChange,
  widgetOrder,
  visibleWidgets,
  onMoveWidget,
  onToggleVisibility,
  onShowAll,
  onResetDefaults,
}: WelcomeHubManagerModalProps) {
  const visibleSet = new Set(visibleWidgets);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#131B2E] border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-[#F8FAFC] rounded-2xl shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 flex items-center justify-center text-[#8B5CF6]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-heading font-bold text-slate-900 dark:text-[#F8FAFC]">
                Gestionar Secciones del Dashboard
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-[#94A3B8] mt-0.5">
                Personaliza qué secciones ver y en qué orden según tus prioridades financieras.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Lista de Secciones Ordenadas */}
        <div className="divide-y divide-slate-100 dark:divide-white/[0.06] my-2">
          {widgetOrder.map((id, index) => {
            const meta = WIDGET_METADATA[id] || {
              id,
              name: id,
              description: "Sección modular del dashboard",
              icon: "wallet",
            };
            const isVisible = visibleSet.has(id);
            const isFirst = index === 0;
            const isLast = index === widgetOrder.length - 1;

            return (
              <div
                key={id}
                className="py-3 flex items-center justify-between gap-3 transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.02] px-2 rounded-xl"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-white/[0.08] text-slate-600 dark:text-[#94A3B8] text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {index + 1}
                  </span>

                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] flex items-center justify-center flex-shrink-0">
                    {renderWidgetIcon(meta.icon)}
                  </div>

                  <div className="min-w-0">
                    <h4 className="text-sm font-heading font-semibold text-slate-900 dark:text-[#F8FAFC] truncate">
                      {meta.name}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-[#94A3B8] truncate">
                      {meta.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Flechas de ordenamiento */}
                  <div className="flex items-center">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={isFirst}
                      onClick={() => onMoveWidget(id, "up")}
                      className="h-7 w-7 text-slate-400 hover:text-[#8B5CF6] disabled:opacity-20"
                      title="Subir posición"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={isLast}
                      onClick={() => onMoveWidget(id, "down")}
                      className="h-7 w-7 text-slate-400 hover:text-[#8B5CF6] disabled:opacity-20"
                      title="Bajar posición"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Switch de visibilidad */}
                  <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-white/[0.08]">
                    <Switch
                      checked={isVisible}
                      onCheckedChange={() => onToggleVisibility(id)}
                      title={isVisible ? "Visible en Dashboard" : "Oculto en Dashboard"}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-white/[0.08]">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onShowAll}
              className="text-xs font-semibold rounded-xl border-slate-200 dark:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-white/[0.05]"
            >
              Mostrar todas
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onResetDefaults}
              className="text-xs font-semibold rounded-xl border-slate-200 dark:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-white/[0.05]"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Restablecer
            </Button>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-semibold shadow-[0_0_15px_rgba(139,92,246,0.3)] flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            Listo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
