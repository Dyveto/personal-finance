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
      if (res.success) {
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
        className="relative text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
        aria-label="Notificaciones y próximos pagos"
        aria-expanded={isOpen}
      >
        <Bell className="w-4 h-4" />
        {alertCount > 0 && (
          <span className="absolute 1 top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-900 animate-pulse">
            {alertCount > 9 ? "9+" : alertCount}
          </span>
        )}
      </Button>

      {/* Menú flotante / Popover de Notificaciones */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
          {/* Cabecera del Popover */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Notificaciones / Próximos Pagos
              </h3>
              {alertCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                  {alertCount}
                </span>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-6 w-6 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Cerrar notificaciones"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Cuerpo del Popover */}
          <div className="max-h-80 overflow-y-auto p-3 space-y-2">
            {isLoading && !hasLoaded ? (
              <div className="py-8 text-center text-slate-400 space-y-2">
                <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-600" />
                <p className="text-xs">Consultando fechas de corte y pagos...</p>
              </div>
            ) : alertCount === 0 ? (
              <div className="py-6 px-4 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  ¡Estás al día!
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
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
                          ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50"
                          : isDueToday
                          ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50"
                          : "bg-slate-50/70 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`p-1.5 rounded-lg ${
                              isOverdue
                                ? "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"
                                : isDueToday
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
                                : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
                            }`}
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white truncate max-w-[170px]">
                              {alert.cardName}
                            </p>
                            <p className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300">
                              {formatMoneyCOP(alert.amount)}
                            </p>
                          </div>
                        </div>

                        {/* Badge de vencimiento */}
                        <div className="text-right flex-shrink-0">
                          {isOverdue ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                              <AlertTriangle className="w-3 h-3" />
                              Venció hace {Math.abs(alert.daysRemaining)}d
                            </span>
                          ) : isDueToday ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              <Clock className="w-3 h-3" />
                              ¡Vence hoy!
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                              <Calendar className="w-3 h-3" />
                              En {alert.daysRemaining} días
                            </span>
                          )}
                          <p className="text-[10px] text-slate-400 mt-0.5">
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
          <div className="p-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-center">
            <Link
              href="/credit-cards"
              onClick={() => setIsOpen(false)}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 inline-flex items-center gap-1 transition-colors"
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
