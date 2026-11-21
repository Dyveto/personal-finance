"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Bell,
  X,
  CreditCard,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getPaymentAlerts,
  type PaymentAlert,
} from "@/features/credit-cards/actions/statement-actions";
import { formatMoneyCOP } from "@/lib/finance/money";

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [alerts, setAlerts] = useState<PaymentAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Cargar alertas de pago de tarjetas
  const loadAlerts = async () => {
    try {
      setIsLoading(true);
      const res = await getPaymentAlerts();
      if (res && typeof res === "object" && "success" in res && res.success) {
        setAlerts(res.data);
      }
    } catch {
      // Ignorar errores silenciosos en background
    } finally {
      setIsLoading(false);
      setHasLoaded(true);
    }
  };

  // Cargar alertas en el montaje inicial
  useEffect(() => {
    loadAlerts();
  }, []);

  // Recargar al abrir el popover
  const handleToggle = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      loadAlerts();
    }
  };

  // Cerrar al hacer clic fuera del popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const alertCount = alerts.length;

  return (
    <div className="relative" ref={popoverRef}>
      {/* Botón de la campana */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleToggle}
        className="relative text-slate-600 hover:text-slate-900 dark:text-[#94A3B8] dark:hover:text-[#F8FAFC] hover:bg-slate-100 dark:hover:bg-white/[0.05] rounded-xl"
        aria-label="Notificaciones y próximos pagos"
        aria-expanded={isOpen}
      >
        <Bell className="w-4 h-4" />
        {alertCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#F43F5E] text-[10px] font-bold text-white ring-2 ring-white dark:ring-[#0B0F19] animate-pulse">
            {alertCount > 9 ? "9+" : alertCount}
          </span>
        )}
      </Button>

      {/* Menú flotante / Popover de Notificaciones */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-white/[0.08] shadow-[0_10px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-50 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
          {/* Cabecera del Popover */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/[0.08] bg-slate-50/80 dark:bg-[#0B0F19]/40">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-600 dark:text-[#D4AF37]" />
              <h3 className="text-xs font-heading font-bold text-slate-900 dark:text-[#F8FAFC] uppercase tracking-wider">
                Notificaciones / Próximos Pagos
              </h3>
              {alertCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#F43F5E]/20 text-[#F43F5E] border border-[#F43F5E]/30">
                  {alertCount}
                </span>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-6 w-6 text-slate-500 hover:text-slate-900 dark:text-[#94A3B8] dark:hover:text-[#F8FAFC] hover:bg-slate-100 dark:hover:bg-white/[0.05]"
              aria-label="Cerrar notificaciones"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Cuerpo del Popover */}
          <div className="max-h-80 overflow-y-auto p-3 space-y-2">
            {isLoading && !hasLoaded ? (
              <div className="py-8 text-center text-slate-500 dark:text-[#94A3B8] space-y-2">
                <Loader2 className="w-5 h-5 animate-spin mx-auto text-amber-600 dark:text-[#D4AF37]" />
                <p className="text-xs">Consultando fechas de corte y pagos...</p>
              </div>
            ) : alertCount === 0 ? (
              <div className="py-6 px-4 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/25 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-heading font-bold text-slate-900 dark:text-[#F8FAFC]">
                  ¡Estás al día!
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-[#94A3B8]">
                  No hay pagos de tarjetas pendientes por ahora.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.map((alert) => {
                  const isOverdue = alert.status === "overdue";
                  const isDueToday = alert.status === "due_today";

                  return (
                    <div
                      key={alert.id}
                      className={`p-3 rounded-xl border text-xs transition-all ${
                        isOverdue
                          ? "bg-[#F43F5E]/10 border-[#F43F5E]/30"
                          : isDueToday
                          ? "bg-amber-500/10 border-amber-500/30"
                          : "bg-slate-50 dark:bg-[#0B0F19]/50 border-slate-200 dark:border-white/[0.06]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`p-1.5 rounded-lg ${
                              isOverdue
                                ? "bg-[#F43F5E]/20 text-[#F43F5E]"
                                : isDueToday
                                ? "bg-amber-500/20 text-amber-400"
                                : "bg-amber-500/15 text-amber-600 dark:text-[#D4AF37]"
                            }`}
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-[#F8FAFC] truncate max-w-[170px]">
                              {alert.cardName}
                            </p>
                            <p className="text-[11px] font-extrabold text-slate-900 dark:text-[#F8FAFC]">
                              {formatMoneyCOP(alert.amount)}
                            </p>
                          </div>
                        </div>

                        {/* Badge de vencimiento */}
                        <div className="text-right flex-shrink-0">
                          {isOverdue ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F43F5E]/20 text-[#F43F5E] border border-[#F43F5E]/30">
                              <AlertTriangle className="w-3 h-3" />
                              Venció hace {Math.abs(alert.daysRemaining)}d
                            </span>
                          ) : isDueToday ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              <Clock className="w-3 h-3" />
                              ¡Vence hoy!
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-[#D4AF37] border border-amber-500/25">
                              <Calendar className="w-3 h-3" />
                              En {alert.daysRemaining} días
                            </span>
                          )}
                          <p className="text-[10px] text-slate-500 dark:text-[#94A3B8] mt-0.5">
                            Límite: {alert.dueDate}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pie del Popover */}
          <div className="p-2.5 border-t border-slate-200 dark:border-white/[0.08] bg-slate-50/80 dark:bg-[#0B0F19]/40 text-center">
            <Link
              href="/credit-cards"
              onClick={() => setIsOpen(false)}
              className="text-xs font-semibold text-amber-600 hover:text-amber-700 dark:text-[#D4AF37] dark:hover:text-[#F3E5AB] inline-flex items-center gap-1 transition-colors"
            >
              <span>Ver y gestionar todas las tarjetas</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
