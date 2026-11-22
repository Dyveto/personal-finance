"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  markExtractAsPaid,
  type MarkExtractAsPaidResult,
} from "@/features/credit-cards/actions/statement-actions";
import type { AccountRow } from "@/features/accounts/actions/account-actions";
import { formatMoneyCOP, roundMoney, compareMoney } from "@/lib/finance/money";
import { formatCivilDate } from "@/lib/finance/calendar";
import { breakdownFourPerThousand } from "@/lib/finance/four-per-thousand";
import {
  calculateStatementPaymentOptions,
  validateCustomPaymentAmount,
} from "@/lib/finance/statement-payments";
import type { ManagementFeeType, StatementPaymentType } from "@/types/database.types";
import {
  CreditCard,
  Wallet,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from "lucide-react";

interface PayStatementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  statementMonth: string; // "YYYY-MM"
  creditCardId: string;
  creditCardName: string;
  totalAmount: number | string; // Cuotas del período
  totalCardDebt?: number | string; // Deuda total acumulada de la tarjeta
  managementFeeAmount?: number | string | null;
  managementFeeType?: ManagementFeeType | null;
  hasUsageInPeriod?: boolean;
  paymentAccounts: AccountRow[];
  onSuccess?: (result: MarkExtractAsPaidResult) => void;
}

export function PayStatementDialog({
  isOpen,
  onClose,
  statementMonth,
  creditCardId,
  creditCardName,
  totalAmount,
  totalCardDebt,
  managementFeeAmount,
  managementFeeType,
  hasUsageInPeriod = true,
  paymentAccounts,
  onSuccess,
}: PayStatementDialogProps) {
  const router = useRouter();

  // Filtrar solo cuentas de efectivo o bancos
  const eligibleAccounts = useMemo(() => {
    return paymentAccounts.filter(
      (a) => a.account_type === "bank" || a.account_type === "cash"
    );
  }, [paymentAccounts]);

  // Cálculo de opciones financieras (Mínimo, Total, Límite)
  const options = useMemo(() => {
    const debt = totalCardDebt !== undefined ? totalCardDebt : totalAmount;
    return calculateStatementPaymentOptions({
      periodInstallmentsTotal: totalAmount,
      totalCardDebt: debt,
      managementFeeAmount,
      managementFeeType,
      hasUsageInPeriod,
    });
  }, [totalAmount, totalCardDebt, managementFeeAmount, managementFeeType, hasUsageInPeriod]);

  // Modalidad seleccionada: "minimum" | "full" | "custom"
  const [paymentType, setPaymentType] = useState<StatementPaymentType>("minimum");
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    eligibleAccounts[0]?.id || ""
  );
  const [customAmountInput, setCustomAmountInput] = useState<string>(options.minimumPayment);
  const [paymentDate, setPaymentDate] = useState<string>(() => {
    const now = new Date();
    return formatCivilDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
  });
  const [notes, setNotes] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<MarkExtractAsPaidResult | null>(null);

  // Inicializar o ajustar montos según la modalidad elegida
  useEffect(() => {
    if (paymentType === "minimum") {
      setCustomAmountInput(options.minimumPayment);
    } else if (paymentType === "full") {
      setCustomAmountInput(options.fullPayment);
    }
  }, [paymentType, options.minimumPayment, options.fullPayment]);

  // Si cambia la lista de cuentas disponibles, seleccionar la primera
  useEffect(() => {
    if (!selectedAccountId && eligibleAccounts.length > 0) {
      setSelectedAccountId(eligibleAccounts[0].id);
    }
  }, [eligibleAccounts, selectedAccountId]);

  // Monto efectivo a pagar según modalidad
  const effectiveAmountStr = useMemo(() => {
    if (paymentType === "minimum") return options.minimumPayment;
    if (paymentType === "full") return options.fullPayment;
    return roundMoney(customAmountInput || "0");
  }, [paymentType, options.minimumPayment, options.fullPayment, customAmountInput]);

  const effectiveAmountNum = parseFloat(effectiveAmountStr) || 0;

  // Cuenta de pago seleccionada y cálculo de 4x1000
  const selectedAccount = useMemo(() => {
    return eligibleAccounts.find((a) => a.id === selectedAccountId);
  }, [eligibleAccounts, selectedAccountId]);

  const gmfBreakdown = useMemo(() => {
    const isTaxed = selectedAccount?.has_four_per_thousand ?? false;
    return breakdownFourPerThousand(effectiveAmountStr, isTaxed, "expense");
  }, [effectiveAmountStr, selectedAccount?.has_four_per_thousand]);

  const hasInsufficientFunds = useMemo(() => {
    if (!selectedAccount) return false;
    const balanceStr = roundMoney(selectedAccount.current_balance);
    return compareMoney(balanceStr, gmfBreakdown.totalAmount) < 0;
  }, [selectedAccount, gmfBreakdown.totalAmount]);

  // Validación de tope máximo de deuda
  const isCustomExceedingDebt = useMemo(() => {
    if (paymentType !== "custom") return false;
    return compareMoney(effectiveAmountStr, options.maxAllowedPayment) > 0;
  }, [paymentType, effectiveAmountStr, options.maxAllowedPayment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedAccountId) {
      setErrorMessage("Debes seleccionar una cuenta de origen (ahorros o efectivo) para el pago.");
      return;
    }

    if (effectiveAmountNum <= 0) {
      setErrorMessage("El monto a pagar debe ser mayor a 0 COP.");
      return;
    }

    if (paymentType === "custom") {
      const customValidation = validateCustomPaymentAmount(
        customAmountInput,
        options.maxAllowedPayment
      );
      if (!customValidation.isValid) {
        setErrorMessage(customValidation.error || "Monto de pago personalizado inválido.");
        return;
      }
    }

    if (hasInsufficientFunds) {
      const detail = gmfBreakdown.isTaxed
        ? `Se requieren ${formatMoneyCOP(gmfBreakdown.totalAmount)} (incluye 4x1000: ${formatMoneyCOP(gmfBreakdown.fourPerThousand)}).`
        : `Se requieren ${formatMoneyCOP(effectiveAmountStr)}.`;
      setErrorMessage(
        `Saldo insuficiente en ${selectedAccount?.name || "la cuenta seleccionada"}. ${detail} Saldo disponible: ${formatMoneyCOP(
          selectedAccount?.current_balance || 0
        )}.`
      );
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        statementMonth,
        creditCardAccountId: creditCardId,
        paymentAccountId: selectedAccountId,
        paymentType,
        amount: effectiveAmountNum,
        paymentDate,
        notes: notes.trim() ? notes : undefined,
      };

      let result;
      try {
        result = await markExtractAsPaid(payload);
      } catch (callErr) {
        const msg =
          callErr instanceof Error && callErr.message
            ? callErr.message
            : "Error de comunicación con el servidor al registrar el pago del extracto.";
        setErrorMessage(msg);
        setIsSubmitting(false);
        return;
      }

      if (!result || typeof result !== "object" || !("success" in result) || !result.success) {
        const errorMsg =
          result && typeof result === "object" && "error" in result && typeof result.error === "string"
            ? result.error
            : "No se recibió respuesta válida del servidor al registrar el pago del extracto.";
        setErrorMessage(errorMsg);
        setIsSubmitting(false);
        return;
      }

      setSuccessData(result.data);
      if (onSuccess) {
        onSuccess(result.data);
      }
      setIsSubmitting(false);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Error inesperado al registrar el pago del extracto.";
      setErrorMessage(msg);
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setErrorMessage(null);
    setSuccessData(null);
    router.refresh();
    onClose();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      handleClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-white/[0.08] shadow-[0_20px_60px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.6)] rounded-2xl text-slate-900 dark:text-[#F8FAFC]">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-600 dark:text-[#D4AF37]">
            <CreditCard className="w-5 h-5" />
            <DialogTitle className="text-lg font-heading font-bold text-slate-900 dark:text-[#F8FAFC]">
              Pagar Tarjeta de Crédito
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-600 dark:text-[#94A3B8]">
            Selecciona la modalidad de pago y la cuenta de origen para liquidar la obligación.
          </DialogDescription>
        </DialogHeader>

        {successData ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/25 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-heading font-bold text-slate-900 dark:text-[#F8FAFC]">
                ¡Pago Registrado con Éxito!
              </h4>
              <p className="text-xs text-slate-600 dark:text-[#94A3B8]">
                El extracto {statementMonth} de {creditCardName} por valor de{" "}
                <strong className="text-slate-900 dark:text-[#F8FAFC]">
                  {formatMoneyCOP(successData.amountPaid)}
                </strong>{" "}
                ha sido procesado y los saldos fueron actualizados en tiempo real.
              </p>
            </div>
            <div className="pt-2">
              <Button
                type="button"
                onClick={handleClose}
                className="w-full bg-[#10B981] hover:bg-[#059669] text-white text-xs font-semibold rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.25)] transition-all"
              >
                Aceptar
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            {errorMessage && (
              <div className="p-3 rounded-xl border border-[#F43F5E]/30 bg-[#F43F5E]/10 text-[#F43F5E] text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Resumen del Extracto y Deuda */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0B0F19]/60 border border-slate-200 dark:border-white/[0.08] flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-600 dark:text-[#94A3B8] uppercase tracking-wider">
                  Extracto {statementMonth}
                </p>
                <p className="text-sm font-heading font-bold text-slate-900 dark:text-[#F8FAFC]">
                  {creditCardName}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-semibold text-slate-600 dark:text-[#94A3B8] uppercase tracking-wider">
                  Deuda Total
                </p>
                <p className="text-base font-heading font-extrabold text-amber-600 dark:text-[#D4AF37]">
                  {formatMoneyCOP(options.maxAllowedPayment)}
                </p>
              </div>
            </div>

            {/* Selector de Modalidad de Pago: Mínimo / Total / Personalizado */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-900 dark:text-[#F8FAFC]">
                Modalidad de Pago
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {/* Opción Pago Mínimo */}
                <button
                  type="button"
                  onClick={() => setPaymentType("minimum")}
                  className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    paymentType === "minimum"
                      ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-[#D4AF37] ring-1 ring-amber-500/50"
                      : "border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-[#0B0F19]/40 text-slate-700 dark:text-[#94A3B8] hover:bg-slate-100 dark:hover:bg-white/[0.04]"
                  }`}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider block">
                    Pago Mínimo
                  </span>
                  <span className="text-xs font-heading font-bold block mt-1 truncate">
                    {formatMoneyCOP(options.minimumPayment)}
                  </span>
                  {options.managementFeeIncluded && (
                    <span className="text-[9px] text-amber-600 dark:text-[#D4AF37] block mt-0.5 truncate">
                      +{formatMoneyCOP(options.managementFeeApplied)} cuota
                    </span>
                  )}
                </button>

                {/* Opción Pago Total */}
                <button
                  type="button"
                  onClick={() => setPaymentType("full")}
                  className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    paymentType === "full"
                      ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-[#D4AF37] ring-1 ring-amber-500/50"
                      : "border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-[#0B0F19]/40 text-slate-700 dark:text-[#94A3B8] hover:bg-slate-100 dark:hover:bg-white/[0.04]"
                  }`}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider block">
                    Pago Total
                  </span>
                  <span className="text-xs font-heading font-bold block mt-1 truncate">
                    {formatMoneyCOP(options.fullPayment)}
                  </span>
                  <span className="text-[9px] text-slate-500 dark:text-[#94A3B8] block mt-0.5">
                    Deuda total
                  </span>
                </button>

                {/* Opción Personalizado */}
                <button
                  type="button"
                  onClick={() => setPaymentType("custom")}
                  className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    paymentType === "custom"
                      ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-[#D4AF37] ring-1 ring-amber-500/50"
                      : "border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-[#0B0F19]/40 text-slate-700 dark:text-[#94A3B8] hover:bg-slate-100 dark:hover:bg-white/[0.04]"
                  }`}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider block">
                    Otro Valor
                  </span>
                  <span className="text-xs font-heading font-bold block mt-1 truncate">
                    Personalizado
                  </span>
                  <span className="text-[9px] text-slate-500 dark:text-[#94A3B8] block mt-0.5">
                    Hasta total
                  </span>
                </button>
              </div>
            </div>

            {/* Input para Monto Personalizado */}
            {paymentType === "custom" && (
              <div className="space-y-1.5 p-3 rounded-xl bg-amber-500/[0.06] border border-amber-500/20">
                <div className="flex items-center justify-between">
                  <Label htmlFor="custom_amount" className="text-xs font-semibold text-slate-900 dark:text-[#F8FAFC]">
                    Ingresa el monto a pagar (COP)
                  </Label>
                  <span className="text-[10px] text-slate-500 dark:text-[#94A3B8]">
                    Máx: {formatMoneyCOP(options.maxAllowedPayment)}
                  </span>
                </div>
                <Input
                  id="custom_amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={Number(options.maxAllowedPayment)}
                  value={customAmountInput}
                  onChange={(e) => setCustomAmountInput(e.target.value)}
                  placeholder="0.00"
                  className="text-xs bg-white dark:bg-[#0B0F19] border-slate-300 dark:border-white/[0.1] text-slate-900 dark:text-[#F8FAFC] rounded-xl"
                  required
                />
                {isCustomExceedingDebt && (
                  <p className="text-[11px] font-medium text-[#F43F5E] flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    El monto no puede superar la deuda total ({formatMoneyCOP(options.maxAllowedPayment)}).
                  </p>
                )}
              </div>
            )}

            {/* Selector de Cuenta de Pago */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="payment_account" className="text-xs font-semibold text-slate-900 dark:text-[#F8FAFC]">
                  Cuenta de origen (Ahorros / Efectivo)
                </Label>
                {selectedAccount && (
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-[#94A3B8]">
                    Disponible:{" "}
                    <strong
                      className={
                        hasInsufficientFunds
                          ? "text-[#F43F5E]"
                          : "text-slate-900 dark:text-[#F8FAFC]"
                      }
                    >
                      {formatMoneyCOP(selectedAccount.current_balance)}
                    </strong>
                  </span>
                )}
              </div>
              <Select
                value={selectedAccountId}
                onValueChange={(val) => setSelectedAccountId(val)}
              >
                <SelectTrigger id="payment_account" className="w-full text-xs bg-white dark:bg-[#0B0F19] border-slate-300 dark:border-white/[0.1] text-slate-900 dark:text-[#F8FAFC] rounded-xl">
                  <SelectValue placeholder="Selecciona una cuenta de débito" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-[#131B2E] border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-[#F8FAFC]">
                  {eligibleAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id} className="text-xs text-slate-900 dark:text-[#F8FAFC] hover:bg-slate-100 dark:hover:bg-white/[0.05]">
                      {acc.name} ({acc.account_type === "bank" ? "Banco" : "Efectivo"} · Saldo:{" "}
                      {formatMoneyCOP(roundMoney(acc.current_balance))})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasInsufficientFunds && (
                <div className="p-2 rounded-lg bg-[#F43F5E]/10 border border-[#F43F5E]/20 text-[#F43F5E] text-[11px] flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>
                    Saldo insuficiente en la cuenta. Te faltan{" "}
                    {formatMoneyCOP(
                      Math.max(
                        0,
                        parseFloat(gmfBreakdown.totalAmount) - Number(selectedAccount?.current_balance || 0)
                      )
                    )}.
                  </span>
                </div>
              )}
            </div>

            {/* Desglose de Pago y 4x1000 según cuenta de origen */}
            {selectedAccount && effectiveAmountNum > 0 && (
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/80 dark:bg-[#0B0F19]/40 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-[#94A3B8]">Abono a la tarjeta:</span>
                  <span className="font-heading font-semibold text-slate-900 dark:text-[#F8FAFC]">
                    {formatMoneyCOP(gmfBreakdown.baseAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-600 dark:text-[#94A3B8]">Impuesto 4x1000 (0.4%):</span>
                    {gmfBreakdown.isTaxed ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        4X1000
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        Exenta
                      </span>
                    )}
                  </div>
                  <span
                    className={`font-heading font-semibold ${
                      gmfBreakdown.isTaxed
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-slate-500 dark:text-[#94A3B8]"
                    }`}
                  >
                    {gmfBreakdown.isTaxed ? `+${formatMoneyCOP(gmfBreakdown.fourPerThousand)}` : "$0 COP"}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-white/[0.08] flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-900 dark:text-[#F8FAFC]">
                    Total a descontar de {selectedAccount.name}:
                  </span>
                  <span className="font-heading text-sm text-slate-900 dark:text-[#F8FAFC]">
                    {formatMoneyCOP(gmfBreakdown.totalAmount)}
                  </span>
                </div>
              </div>
            )}

            {/* Fecha del Pago */}
            <div className="space-y-1.5">
              <Label htmlFor="payment_date" className="text-xs font-semibold text-slate-900 dark:text-[#F8FAFC]">
                Fecha de pago
              </Label>
              <Input
                id="payment_date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="text-xs bg-white dark:bg-[#0B0F19] border-slate-300 dark:border-white/[0.1] text-slate-900 dark:text-[#F8FAFC] rounded-xl"
                required
              />
            </div>

            {/* Notas opcionales */}
            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs font-semibold text-slate-900 dark:text-[#F8FAFC]">
                Notas <span className="text-slate-500 dark:text-[#94A3B8] font-normal">(Opcional)</span>
              </Label>
              <Input
                id="notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej. Pago PSE o débito automático"
                className="text-xs bg-white dark:bg-[#0B0F19] border-slate-300 dark:border-white/[0.1] text-slate-900 dark:text-[#F8FAFC] rounded-xl"
              />
            </div>

            <DialogFooter className="pt-2 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={isSubmitting}
                className="text-xs border-slate-300 dark:border-white/[0.08] bg-slate-50 dark:bg-[#0B0F19] text-slate-700 dark:text-[#F8FAFC] hover:bg-slate-100 dark:hover:bg-white/[0.05] rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || hasInsufficientFunds || isCustomExceedingDebt}
                className="text-xs bg-amber-600 hover:bg-amber-700 text-white dark:bg-[#D4AF37] dark:hover:bg-[#C5A059] dark:text-slate-950 dark:font-bold flex items-center gap-1.5 rounded-xl shadow-[0_0_15px_rgba(217,119,6,0.3)] dark:shadow-[0_0_15px_rgba(212,175,55,0.3)] transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Registrando...</span>
                  </>
                ) : hasInsufficientFunds ? (
                  <span>Saldo Insuficiente</span>
                ) : (
                  <>
                    <Wallet className="w-3.5 h-3.5" />
                    <span>Confirmar {formatMoneyCOP(effectiveAmountStr)}</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
