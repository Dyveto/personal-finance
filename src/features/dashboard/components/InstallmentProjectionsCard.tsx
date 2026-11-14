"use client";

import { useMemo } from "react";
import { formatMoneyCOP } from "@/lib/finance/money";
import type { ProjectedInstallment } from "@/lib/finance/projections";
import { CreditCard, CalendarClock, ShieldCheck } from "lucide-react";

interface InstallmentProjectionsCardProps {
  projections: ProjectedInstallment[];
}

export function InstallmentProjectionsCard({
  projections,
}: InstallmentProjectionsCardProps) {
  // Agrupar proyecciones por mes de extracto ("YYYY-MM")
  const groupedByMonth = useMemo(() => {
    const map = new Map<string, { month: string; total: number; items: ProjectedInstallment[] }>();

    for (const proj of projections) {
      const existing = map.get(proj.statementMonth);
      const amt = parseFloat(proj.amount);
      if (existing) {
        existing.total += amt;
        existing.items.push(proj);
      } else {
        map.set(proj.statementMonth, {
          month: proj.statementMonth,
          total: amt,
          items: [proj],
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [projections]);

  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>Proyección de Cuotas y Próximos Pagos</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Calendario de cuotas diferidas en tarjetas según fechas de corte y límites de pago
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
          <ShieldCheck className="w-4 h-4" />
          <span>Invariante: Sin pérdida de centavos</span>
        </div>
      </div>

      {groupedByMonth.length === 0 ? (
        <div className="p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center">
          <CreditCard className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            No tienes compras diferidas a cuotas activas
          </p>
          <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
            Cuando registres una compra a cuotas en una tarjeta de crédito, sus extractos futuros
            se proyectarán matemáticamente aquí sin duplicar transacciones.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
          {groupedByMonth.map((group) => (
            <div
              key={group.month}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Extracto {group.month}
                  </span>
                  <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
                    {formatMoneyCOP(group.total)}
                  </span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800/80 mt-2">
                  {group.items.map((item, idx) => (
                    <div key={`${item.transactionId}-${idx}`} className="py-2 text-xs">
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white truncate">
                          {item.description}
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 flex-shrink-0">
                          {formatMoneyCOP(item.amount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-0.5">
                        <span>
                          {item.accountName} · Cuota {item.installmentNumber}/{item.totalInstallments}
                        </span>
                        <span>Vence: {item.paymentDueDate}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
