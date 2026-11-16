"use client";

import { useState, useMemo } from "react";
import { formatMoneyCOP } from "@/lib/finance/money";
import type { ProjectedInstallment } from "@/lib/finance/projections";
import type { CreditCardStatementRow } from "@/types/database.types";
import type { AccountRow } from "@/features/accounts/actions/account-actions";
import type { MarkExtractAsPaidResult } from "@/features/credit-cards/actions/statement-actions";
import { PayStatementDialog } from "@/features/credit-cards/components/PayStatementDialog";
import { Button } from "@/components/ui/button";
import { CreditCard, CalendarClock, ShieldCheck, CheckCircle2 } from "lucide-react";

interface InstallmentProjectionsCardProps {
  projections: ProjectedInstallment[];
  paymentAccounts?: AccountRow[];
  statements?: CreditCardStatementRow[];
  onStatementPaid?: (result: MarkExtractAsPaidResult) => void;
}

interface StatementGroup {
  key: string;
  month: string;
  accountId: string;
  accountName: string;
  total: number;
  items: ProjectedInstallment[];
}

export function InstallmentProjectionsCard({
  projections,
  paymentAccounts = [],
  statements = [],
  onStatementPaid,
}: InstallmentProjectionsCardProps) {
  // Estado para el modal de pago de extracto
  const [selectedGroupToPay, setSelectedGroupToPay] = useState<StatementGroup | null>(null);

  // Registro local optimista de extractos pagados
  const [optimisticPaidKeys, setOptimisticPaidKeys] = useState<Set<string>>(new Set());

  // Conjunto de claves de extractos pagados a partir de los datos de base de datos
  const dbPaidKeys = useMemo(() => {
    const set = new Set<string>();
    for (const s of statements) {
      if (s.is_paid) {
        set.add(`${s.account_id}_${s.statement_month}`);
        set.add(s.statement_month);
      }
    }
    return set;
  }, [statements]);

  // Agrupar proyecciones por tarjeta y mes de extracto ("accountId_YYYY-MM")
  const groupedStatements = useMemo(() => {
    const map = new Map<string, StatementGroup>();

    for (const proj of projections) {
      const accountId = proj.accountId || "default";
      const key = `${accountId}_${proj.statementMonth}`;
      const amt = parseFloat(proj.amount);

      const existing = map.get(key);
      if (existing) {
        existing.total += amt;
        existing.items.push(proj);
      } else {
        map.set(key, {
          key,
          month: proj.statementMonth,
          accountId,
          accountName: proj.accountName,
          total: amt,
          items: [proj],
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [projections]);

  const handleOpenPayDialog = (group: StatementGroup) => {
    setSelectedGroupToPay(group);
  };

  const handlePaymentSuccess = (result: MarkExtractAsPaidResult) => {
    if (selectedGroupToPay) {
      setOptimisticPaidKeys((prev) => {
        const next = new Set(prev);
        next.add(selectedGroupToPay.key);
        next.add(selectedGroupToPay.month);
        next.add(`${selectedGroupToPay.accountId}_${selectedGroupToPay.month}`);
        return next;
      });
    }

    if (onStatementPaid) {
      onStatementPaid(result);
    }
  };

  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>Proyección de Cuotas y Próximos Pagos</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Calendario de cuotas diferidas en tarjetas según fechas de corte y límites de pago.
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
          <ShieldCheck className="w-4 h-4" />
          <span>Invariante: Sin pérdida de centavos</span>
        </div>
      </div>

      {groupedStatements.length === 0 ? (
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
          {groupedStatements.map((group) => {
            const isPaid =
              optimisticPaidKeys.has(group.key) ||
              optimisticPaidKeys.has(group.month) ||
              optimisticPaidKeys.has(`${group.accountId}_${group.month}`) ||
              dbPaidKeys.has(group.key) ||
              dbPaidKeys.has(`${group.accountId}_${group.month}`) ||
              dbPaidKeys.has(group.month);

            return (
              <div
                key={group.key}
                className={`p-4 rounded-xl border flex flex-col justify-between transition-colors ${
                  isPaid
                    ? "border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60"
                }`}
              >
                <div>
                  {/* Encabezado del extracto */}
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                        Extracto {group.month}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {group.accountName}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 block">
                        {formatMoneyCOP(group.total)}
                      </span>
                      {isPaid ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" /> Pagado
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                          Pendiente
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Listado de cuotas incluidas en el extracto */}
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
                            Cuota {item.installmentNumber}/{item.totalInstallments}
                          </span>
                          <span>Vence: {item.paymentDueDate}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Botón interactivo de Pago de Extracto */}
                <div className="pt-3 mt-3 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
                  {isPaid ? (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold w-full justify-center py-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Extracto Liquidado</span>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleOpenPayDialog(group)}
                      className="w-full h-8 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99]"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Marcar como Pagado</span>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Diálogo emergente para liquidar el pago */}
      {selectedGroupToPay && (
        <PayStatementDialog
          isOpen={!!selectedGroupToPay}
          onClose={() => setSelectedGroupToPay(null)}
          statementMonth={selectedGroupToPay.month}
          creditCardId={selectedGroupToPay.accountId}
          creditCardName={selectedGroupToPay.accountName}
          totalAmount={selectedGroupToPay.total}
          paymentAccounts={paymentAccounts}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}
