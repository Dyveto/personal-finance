"use client";

import { useState, useMemo } from "react";
import { formatMoneyCOP } from "@/lib/finance/money";
import type { ProjectedInstallment } from "@/lib/finance/projections";
import type { CreditCardStatementRow } from "@/types/database.types";
import type { AccountRow } from "@/features/accounts/actions/account-actions";
import type { MarkExtractAsPaidResult } from "@/features/credit-cards/actions/statement-actions";
import { PayStatementDialog } from "@/features/credit-cards/components/PayStatementDialog";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  CalendarClock,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  History,
  Wallet,
  CalendarCheck,
  Receipt,
  Sparkles,
} from "lucide-react";

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

function formatPaymentDateTime(isoString: string | null | undefined): string {
  if (!isoString) return "Fecha no registrada";
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat("es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return isoString;
  }
}

export function InstallmentProjectionsCard({
  projections,
  paymentAccounts = [],
  statements = [],
  onStatementPaid,
}: InstallmentProjectionsCardProps) {
  // Modal de pago
  const [selectedGroupToPay, setSelectedGroupToPay] = useState<StatementGroup | null>(null);

  // Registro local optimista de pagos recientes
  const [optimisticPaidKeys, setOptimisticPaidKeys] = useState<Set<string>>(new Set());
  const [localPaidStatements, setLocalPaidStatements] = useState<CreditCardStatementRow[]>([]);

  // Estado del acordeón/colapsable del Historial de Pagados (cerrado por defecto)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Extracto pagado seleccionado para ver detalle interactivo
  const [expandedPaidKey, setExpandedPaidKey] = useState<string | null>(null);

  // Consolidar todos los extractos registrados (servidor + optimistas)
  const allStatements = useMemo(() => {
    return [...localPaidStatements, ...statements];
  }, [localPaidStatements, statements]);

  // Conjunto de claves de extractos pagados
  const paidKeysSet = useMemo(() => {
    const set = new Set<string>();
    for (const s of allStatements) {
      if (s.is_paid) {
        set.add(`${s.account_id}_${s.statement_month}`);
        set.add(s.statement_month);
      }
    }
    optimisticPaidKeys.forEach((key) => {
      set.add(key);
    });
    return set;
  }, [allStatements, optimisticPaidKeys]);

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

  // Separar en extractos pendientes y extractos pagados
  const { pendingStatements, paidStatements } = useMemo(() => {
    const pending: StatementGroup[] = [];
    const paid: StatementGroup[] = [];

    for (const group of groupedStatements) {
      const isPaid =
        paidKeysSet.has(group.key) ||
        paidKeysSet.has(group.month) ||
        paidKeysSet.has(`${group.accountId}_${group.month}`);

      if (isPaid) {
        paid.push(group);
      } else {
        pending.push(group);
      }
    }

    return { pendingStatements: pending, paidStatements: paid };
  }, [groupedStatements, paidKeysSet]);

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
      setLocalPaidStatements((prev) => [result.statement, ...prev]);
    }

    if (onStatementPaid) {
      onStatementPaid(result);
    }
  };

  const toggleDetail = (key: string) => {
    setExpandedPaidKey((prev) => (prev === key ? null : key));
  };

  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
      {/* Encabezado */}
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

      {/* SECCIÓN 1: EXTRACTOS PENDIENTES */}
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
      ) : pendingStatements.length === 0 ? (
        <div className="p-6 border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 rounded-xl text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            ¡Estás al día! No tienes extractos pendientes de pago
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Todos los extractos proyectados hasta la fecha han sido liquidados. Puedes consultar el
            historial de extractos pagados a continuación.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>Extractos Pendientes de Pago</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                {pendingStatements.length}
              </span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingStatements.map((group) => (
              <div
                key={group.key}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 flex flex-col justify-between transition-all hover:border-slate-300 dark:hover:border-slate-700 shadow-sm"
              >
                <div>
                  {/* Encabezado del extracto pendiente */}
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
                      <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                        Pendiente
                      </span>
                    </div>
                  </div>

                  {/* Listado de cuotas */}
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

                {/* Botón interactivo de Pago */}
                <div className="pt-3 mt-3 border-t border-slate-200/80 dark:border-slate-800/80">
                  <Button
                    size="sm"
                    onClick={() => handleOpenPayDialog(group)}
                    className="w-full h-8 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Marcar como Pagado</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECCIÓN 2: HISTORIAL DE EXTRACTOS PAGADOS (COLAPSABLE / ACORDEÓN) */}
      {paidStatements.length > 0 && (
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            className="w-full py-3 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/70 dark:hover:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Historial de Extractos Pagados
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                {paidStatements.length}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>{isHistoryOpen ? "Contraer historial" : "Ver extractos liquidados"}</span>
              {isHistoryOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </div>
          </button>

          {/* Contenido desplegable del historial */}
          {isHistoryOpen && (
            <div className="mt-3 space-y-3 animate-in fade-in-50 duration-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paidStatements.map((group) => {
                  const isExpanded = expandedPaidKey === group.key;
                  const statementRecord = allStatements.find(
                    (s) =>
                      s.is_paid &&
                      (s.statement_month === group.month ||
                        `${s.account_id}_${s.statement_month}` === group.key)
                  );

                  return (
                    <div
                      key={group.key}
                      className="p-4 rounded-xl border border-emerald-200/90 dark:border-emerald-900/60 bg-emerald-50/20 dark:bg-emerald-950/10 flex flex-col justify-between transition-all"
                    >
                      <div>
                        {/* Cabecera del extracto liquidado */}
                        <div className="flex items-center justify-between border-b border-emerald-100 dark:border-emerald-900/40 pb-2.5">
                          <div>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                              Extracto {group.month}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {group.accountName}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-xs font-extrabold text-slate-900 dark:text-white block">
                              {formatMoneyCOP(statementRecord?.total_amount || group.total)}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-3 h-3" /> Pagado
                            </span>
                          </div>
                        </div>

                        {/* Desglose interactivo de detalles de liquidación */}
                        {isExpanded ? (
                          <div className="mt-3 space-y-3 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                            <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                <CalendarCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                <span>
                                  <strong>Fecha de pago:</strong>{" "}
                                  {formatPaymentDateTime(statementRecord?.paid_at)}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                <Wallet className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                                <span>
                                  <strong>Medio / Origen:</strong>{" "}
                                  {statementRecord?.notes || "Pago registrado"}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                <Receipt className="w-4 h-4 text-slate-500 flex-shrink-0" />
                                <span>
                                  <strong>Monto liquidado:</strong>{" "}
                                  {formatMoneyCOP(statementRecord?.total_amount || group.total)}
                                </span>
                              </div>
                            </div>

                            {/* Detalle de cuotas cubiertas */}
                            <div className="space-y-1.5">
                              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                Cuotas incluidas ({group.items.length})
                              </p>
                              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                                {group.items.map((item, idx) => (
                                  <div
                                    key={`${item.transactionId}-${idx}`}
                                    className="py-1.5 flex justify-between items-center text-xs"
                                  >
                                    <span className="text-slate-700 dark:text-slate-300 truncate max-w-[170px]">
                                      {item.description} (Cuota {item.installmentNumber}/
                                      {item.totalInstallments})
                                    </span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                                      {formatMoneyCOP(item.amount)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Botón para contraer detalle */}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => toggleDetail(group.key)}
                              className="w-full text-xs h-7 mt-2"
                            >
                              Contraer Detalle
                            </Button>
                          </div>
                        ) : (
                          <div className="mt-2.5">
                            <p className="text-[11px] text-slate-400 mb-2">
                              {group.items.length} cuota{group.items.length > 1 ? "s" : ""}{" "}
                              liquidada{group.items.length > 1 ? "s" : ""}
                            </p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleDetail(group.key)}
                              className="w-full h-7 text-xs font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 hover:bg-emerald-100/60 dark:hover:bg-emerald-950/50 rounded-lg flex items-center justify-center gap-1"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                              <span>Ver Desglose de Pago</span>
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
