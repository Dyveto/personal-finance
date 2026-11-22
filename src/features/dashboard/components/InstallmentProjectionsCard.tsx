"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { formatMoneyCOP } from "@/lib/finance/money";
import type { ProjectedInstallment } from "@/lib/finance/projections";
import type { CreditCardStatementRow } from "@/types/database.types";
import type { AccountRow } from "@/features/accounts/actions/account-actions";
import {
  revertStatementPayment,
  type MarkExtractAsPaidResult,
} from "@/features/credit-cards/actions/statement-actions";
import { PayStatementDialog } from "@/features/credit-cards/components/PayStatementDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  History,
  Wallet,
  CalendarCheck,
  Receipt,
  Sparkles,
  RotateCcw,
  AlertTriangle,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface InstallmentProjectionsCardProps {
  projections: ProjectedInstallment[];
  paymentAccounts?: AccountRow[];
  statements?: CreditCardStatementRow[];
  creditCards?: AccountRow[];
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
  creditCards = [],
  onStatementPaid,
}: InstallmentProjectionsCardProps) {
  const router = useRouter();

  // Modal de pago
  const [selectedGroupToPay, setSelectedGroupToPay] = useState<StatementGroup | null>(null);

  // Registro local optimista de pagos recientes
  const [optimisticPaidKeys, setOptimisticPaidKeys] = useState<Set<string>>(new Set());
  const [localPaidStatements, setLocalPaidStatements] = useState<CreditCardStatementRow[]>([]);

  // Estado para revertir pago
  const [statementToRevert, setStatementToRevert] = useState<{
    statementId: string;
    month: string;
    accountName: string;
    amount: number;
  } | null>(null);
  const [isReverting, setIsReverting] = useState(false);
  const [revertError, setRevertError] = useState<string | null>(null);

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
      const isPaid = paidKeysSet.has(group.key) || paidKeysSet.has(group.month);
      if (isPaid) {
        paid.push(group);
      } else {
        pending.push(group);
      }
    }

    return { pendingStatements: pending, paidStatements: paid };
  }, [groupedStatements, paidKeysSet]);

  const handlePaymentSuccess = (result: MarkExtractAsPaidResult) => {
    if (selectedGroupToPay) {
      setOptimisticPaidKeys((prev) => {
        const next = new Set(prev);
        next.add(selectedGroupToPay.key);
        next.add(selectedGroupToPay.month);
        return next;
      });
      setLocalPaidStatements((prev) => [result.statement, ...prev]);
    }

    if (onStatementPaid) {
      onStatementPaid(result);
    }
  };

  const handleConfirmRevert = async () => {
    if (!statementToRevert) return;
    setIsReverting(true);
    setRevertError(null);

    try {
      const res = await revertStatementPayment({ statementId: statementToRevert.statementId });
      if (!res.success) {
        setRevertError(res.error || "No se pudo revertir el pago.");
        setIsReverting(false);
        return;
      }

      // Eliminar de los estados optimistas locales
      setOptimisticPaidKeys((prev) => {
        const next = new Set(prev);
        next.delete(statementToRevert.month);
        return next;
      });
      setLocalPaidStatements((prev) => prev.filter((s) => s.id !== statementToRevert.statementId));
      setStatementToRevert(null);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error inesperado al revertir pago.";
      setRevertError(msg);
    } finally {
      setIsReverting(false);
    }
  };

  const toggleDetail = (key: string) => {
    setExpandedPaidKey((prev) => (prev === key ? null : key));
  };

  if (projections.length === 0) {
    return (
      <div className="p-8 border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#131B2E] rounded-2xl text-center space-y-3 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 dark:text-[#D4AF37] border border-amber-500/20 mx-auto flex items-center justify-center">
          <CalendarClock className="w-6 h-6" />
        </div>
        <h3 className="text-base font-heading font-bold text-slate-900 dark:text-[#F8FAFC]">
          No hay cuotas ni extractos proyectados
        </h3>
        <p className="text-xs text-slate-600 dark:text-[#94A3B8] max-w-sm mx-auto">
          No tienes transacciones activas en cuotas pendientes en tus tarjetas de crédito registradas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sección 1: Extractos Pendientes de Pago */}
      {pendingStatements.length === 0 ? (
        <div className="p-6 border border-[#10B981]/20 bg-[#10B981]/5 rounded-xl text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/25 mx-auto flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-heading font-bold text-slate-900 dark:text-[#F8FAFC]">
            ¡Estás al día! No tienes extractos pendientes de pago
          </h4>
          <p className="text-xs text-slate-600 dark:text-[#94A3B8] max-w-md mx-auto">
            Todos los extractos proyectados hasta la fecha han sido liquidados. Puedes consultar el
            historial de extractos pagados a continuación.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-heading font-bold text-slate-900 dark:text-[#F8FAFC] uppercase tracking-wider flex items-center gap-1.5">
              <span>Extractos Pendientes de Pago</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                {pendingStatements.length}
              </span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingStatements.map((group) => (
              <div
                key={group.key}
                className="p-4 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/80 dark:bg-[#0B0F19]/50 flex flex-col justify-between transition-all hover:border-amber-500/30 dark:hover:border-[#D4AF37]/30"
              >
                <div>
                  {/* Encabezado del extracto pendiente */}
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/[0.08] pb-2.5">
                    <div>
                      <span className="text-xs font-heading font-bold text-slate-900 dark:text-[#F8FAFC] uppercase tracking-wider block">
                        Extracto {group.month}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-[#94A3B8]">
                        {group.accountName}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-heading font-extrabold text-amber-600 dark:text-[#D4AF37] block">
                        {formatMoneyCOP(group.total)}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-[#94A3B8]">
                        {group.items.length} cuota{group.items.length > 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  {/* Lista de cuotas diferidas */}
                  <div className="py-2.5 space-y-1.5 max-h-36 overflow-y-auto">
                    {group.items.map((item, idx) => (
                      <div
                        key={`${item.transactionId}-${idx}`}
                        className="flex justify-between items-center text-xs py-1 border-b border-slate-200/50 dark:border-white/[0.04] last:border-0"
                      >
                        <span className="text-slate-700 dark:text-[#CBD5E1] truncate max-w-[160px]">
                          {item.description} (Cuota {item.installmentNumber}/{item.totalInstallments})
                        </span>
                        <span className="font-heading font-semibold text-slate-900 dark:text-[#F8FAFC] text-[11px]">
                          {formatMoneyCOP(item.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Botón de acción para pagar extracto */}
                <div className="pt-3 border-t border-slate-200 dark:border-white/[0.08] mt-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setSelectedGroupToPay(group)}
                    className="w-full text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white dark:bg-[#D4AF37] dark:hover:bg-[#C5A059] dark:text-slate-950 dark:font-bold rounded-xl shadow-[0_0_15px_rgba(217,119,6,0.25)] dark:shadow-[0_0_15px_rgba(212,175,55,0.25)] transition-all flex items-center justify-center gap-1.5"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>Pagar Extracto</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sección 2: Historial de Extractos Pagados (Acordeón colapsable) */}
      {paidStatements.length > 0 && (
        <div className="pt-2 border-t border-slate-200 dark:border-white/[0.08]">
          <button
            type="button"
            onClick={() => setIsHistoryOpen((prev) => !prev)}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-[#0B0F19]/40 hover:bg-slate-100 dark:hover:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] transition-all text-left"
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-600 dark:text-[#10B981]" />
              <span className="text-xs font-heading font-bold text-slate-900 dark:text-[#F8FAFC] uppercase tracking-wider">
                Historial de Extractos Pagados
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#10B981]/20 text-emerald-700 dark:text-[#10B981] border border-[#10B981]/30">
                {paidStatements.length}
              </span>
            </div>
            <div className="text-slate-500 dark:text-[#94A3B8]">
              {isHistoryOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {isHistoryOpen && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paidStatements.map((group) => {
                  const statementRecord = allStatements.find(
                    (s) =>
                      s.is_paid &&
                      s.statement_month === group.month &&
                      s.account_id === group.accountId
                  );
                  const isExpanded = expandedPaidKey === group.key;

                  return (
                    <div
                      key={group.key}
                      className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] dark:bg-[#10B981]/[0.02] flex flex-col justify-between transition-all"
                    >
                      <div>
                        {/* Encabezado del extracto pagado */}
                        <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                          <div>
                            <span className="text-xs font-heading font-bold text-slate-900 dark:text-[#F8FAFC] uppercase tracking-wider block">
                              Extracto {group.month}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-[#94A3B8]">
                              {group.accountName}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-heading font-extrabold text-slate-900 dark:text-[#F8FAFC] block">
                              {formatMoneyCOP(statementRecord?.paid_amount || statementRecord?.total_amount || group.total)}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-[#10B981]">
                              <CheckCircle2 className="w-3 h-3" /> Pagado
                            </span>
                          </div>
                        </div>

                        {/* Desglose interactivo de detalles de liquidación */}
                        {isExpanded ? (
                          <div className="mt-3 space-y-3 pt-1 border-t border-slate-200 dark:border-white/[0.08]">
                            <div className="p-3 rounded-xl bg-slate-100/90 dark:bg-[#0B0F19]/80 border border-slate-200 dark:border-white/[0.08] space-y-2 text-xs">
                              <div className="flex items-center gap-2 text-slate-600 dark:text-[#94A3B8]">
                                <CalendarCheck className="w-4 h-4 text-emerald-600 dark:text-[#10B981] flex-shrink-0" />
                                <span>
                                  <strong className="text-slate-900 dark:text-[#F8FAFC]">Fecha de pago:</strong>{" "}
                                  {formatPaymentDateTime(statementRecord?.paid_at)}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-slate-600 dark:text-[#94A3B8]">
                                <Wallet className="w-4 h-4 text-amber-600 dark:text-[#D4AF37] flex-shrink-0" />
                                <span>
                                  <strong className="text-slate-900 dark:text-[#F8FAFC]">Medio / Origen:</strong>{" "}
                                  {statementRecord?.notes || "Pago registrado"}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-slate-600 dark:text-[#94A3B8]">
                                <Receipt className="w-4 h-4 text-slate-600 dark:text-[#94A3B8] flex-shrink-0" />
                                <span>
                                  <strong className="text-slate-900 dark:text-[#F8FAFC]">Monto liquidado:</strong>{" "}
                                  {formatMoneyCOP(statementRecord?.paid_amount || statementRecord?.total_amount || group.total)}
                                </span>
                              </div>
                            </div>

                            {/* Detalle de cuotas cubiertas */}
                            <div className="space-y-1.5">
                              <p className="text-[11px] font-semibold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider">
                                Cuotas incluidas ({group.items.length})
                              </p>
                              <div className="divide-y divide-slate-200 dark:divide-white/[0.06]">
                                {group.items.map((item, idx) => (
                                  <div
                                    key={`${item.transactionId}-${idx}`}
                                    className="py-1.5 flex justify-between items-center text-xs"
                                  >
                                    <span className="text-slate-800 dark:text-[#F8FAFC] truncate max-w-[170px]">
                                      {item.description} (Cuota {item.installmentNumber}/
                                      {item.totalInstallments})
                                    </span>
                                    <span className="font-heading font-semibold text-slate-900 dark:text-[#F8FAFC]">
                                      {formatMoneyCOP(item.amount)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Acciones de reversión y contraer detalle */}
                            <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-200 dark:border-white/[0.06]">
                              {statementRecord && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setStatementToRevert({
                                      statementId: statementRecord.id,
                                      month: group.month,
                                      accountName: group.accountName,
                                      amount:
                                        statementRecord.paid_amount ||
                                        statementRecord.total_amount ||
                                        group.total,
                                    })
                                  }
                                  className="text-xs text-[#F43F5E] hover:text-[#F43F5E] hover:bg-[#F43F5E]/10 border-[#F43F5E]/30 rounded-xl flex items-center gap-1.5"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>Revertir Pago</span>
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => toggleDetail(group.key)}
                                className="text-xs h-7 border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0B0F19] text-slate-700 dark:text-[#F8FAFC] hover:bg-slate-50 dark:hover:bg-white/[0.05] rounded-xl ml-auto"
                              >
                                Contraer Detalle
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2.5">
                            <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] mb-2">
                              {group.items.length} cuota{group.items.length > 1 ? "s" : ""}{" "}
                              liquidada{group.items.length > 1 ? "s" : ""}
                            </p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleDetail(group.key)}
                              className="w-full h-7 text-xs font-semibold text-emerald-600 dark:text-[#10B981] hover:text-emerald-700 hover:bg-[#10B981]/10 rounded-xl flex items-center justify-center gap-1"
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
      {selectedGroupToPay && (() => {
        const matchedCard = creditCards?.find((c) => c.id === selectedGroupToPay.accountId);
        return (
          <PayStatementDialog
            isOpen={!!selectedGroupToPay}
            onClose={() => setSelectedGroupToPay(null)}
            statementMonth={selectedGroupToPay.month}
            creditCardId={selectedGroupToPay.accountId}
            creditCardName={selectedGroupToPay.accountName}
            totalAmount={selectedGroupToPay.total}
            totalCardDebt={matchedCard?.current_balance}
            managementFeeAmount={matchedCard?.management_fee}
            managementFeeType={matchedCard?.management_fee_type}
            paymentAccounts={paymentAccounts}
            onSuccess={handlePaymentSuccess}
          />
        );
      })()}

      {/* Diálogo de Confirmación para Revertir Pago */}
      {statementToRevert && (
        <Dialog
          open={!!statementToRevert}
          onOpenChange={(open) => !open && !isReverting && setStatementToRevert(null)}
        >
          <DialogContent className="sm:max-w-md bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-white/[0.08] shadow-[0_20px_60px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.6)] rounded-2xl text-slate-900 dark:text-[#F8FAFC]">
            <DialogHeader>
              <div className="flex items-center gap-2 text-[#F43F5E]">
                <RotateCcw className="w-5 h-5" />
                <DialogTitle className="text-lg font-heading font-bold text-slate-900 dark:text-[#F8FAFC]">
                  Revertir Pago de Extracto
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-slate-600 dark:text-[#94A3B8]">
                ¿Deseas revertir el pago del extracto {statementToRevert.month} de {statementToRevert.accountName}?
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs text-slate-700 dark:text-[#CBD5E1]">
              {revertError && (
                <div className="p-3 rounded-xl border border-[#F43F5E]/30 bg-[#F43F5E]/10 text-[#F43F5E] text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{revertError}</span>
                </div>
              )}
              <div className="p-3 rounded-xl bg-amber-500/[0.08] border border-amber-500/20 text-amber-800 dark:text-amber-200 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-[#D4AF37] flex-shrink-0" />
                  Efectos de la reversión:
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-600 dark:text-[#94A3B8]">
                  <li>El extracto volverá a quedar en estado <strong>Pendiente</strong>.</li>
                  <li>Se restaurará la deuda en la tarjeta por <strong>{formatMoneyCOP(statementToRevert.amount)}</strong>.</li>
                  <li>Se reembolsará el dinero a la cuenta de débito si se registró un egreso.</li>
                </ul>
              </div>
            </div>

            <DialogFooter className="pt-2 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStatementToRevert(null)}
                disabled={isReverting}
                className="text-xs border-slate-300 dark:border-white/[0.08] bg-slate-50 dark:bg-[#0B0F19] text-slate-700 dark:text-[#F8FAFC] hover:bg-slate-100 dark:hover:bg-white/[0.05] rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmRevert}
                disabled={isReverting}
                className="text-xs bg-[#F43F5E] hover:bg-[#E11D48] text-white font-semibold rounded-xl flex items-center gap-1.5 shadow-[0_0_15px_rgba(244,63,94,0.3)] transition-all"
              >
                {isReverting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Revirtiendo...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Confirmar Reversión</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
