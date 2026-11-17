"use client";

import { useState } from "react";
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
import { formatMoneyCOP, roundMoney } from "@/lib/finance/money";
import { formatCivilDate } from "@/lib/finance/calendar";
import { CreditCard, Wallet, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";

interface PayStatementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  statementMonth: string; // "YYYY-MM"
  creditCardId: string;
  creditCardName: string;
  totalAmount: number | string;
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
  paymentAccounts,
  onSuccess,
}: PayStatementDialogProps) {
  const router = useRouter();

  // Valores de formulario
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    paymentAccounts[0]?.id || "none"
  );
  const [amountInput, setAmountInput] = useState<string>(
    typeof totalAmount === "number" ? String(totalAmount) : totalAmount
  );
  const [paymentDate, setPaymentDate] = useState<string>(() => {
    const now = new Date();
    return formatCivilDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
  });
  const [notes, setNotes] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<MarkExtractAsPaidResult | null>(null);

  const parsedAmount = parseFloat(amountInput) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (parsedAmount <= 0) {
      setErrorMessage("El monto a pagar debe ser mayor a 0.");
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        statementMonth,
        creditCardAccountId: creditCardId,
        paymentAccountId: selectedAccountId === "none" ? null : selectedAccountId,
        amount: parsedAmount,
        paymentDate,
        notes: notes.trim() ? notes : undefined,
      };

      const result = await markExtractAsPaid(payload);

      if (!result.success) {
        setErrorMessage(result.error);
        setIsSubmitting(false);
        return;
      }

      setSuccessData(result.data);
      if (onSuccess) {
        onSuccess(result.data);
      }
      setIsSubmitting(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error inesperado al registrar el pago del extracto.";
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
      <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <CreditCard className="w-5 h-5" />
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">
              Pagar Extracto de Tarjeta
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
            ¿Desde qué cuenta o medio de pago realizaste el pago de este extracto?
          </DialogDescription>
        </DialogHeader>

        {successData ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                ¡Pago Registrado con Éxito!
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                El extracto {statementMonth} de {creditCardName} por valor de{" "}
                <strong className="text-slate-800 dark:text-slate-200">
                  {formatMoneyCOP(successData.amountPaid)}
                </strong>{" "}
                ha sido liquidado y los saldos fueron actualizados.
              </p>
            </div>
            <div className="pt-2">
              <Button
                type="button"
                onClick={handleClose}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
              >
                Aceptar
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            {errorMessage && (
              <div className="p-3 rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Resumen del Extracto */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Extracto {statementMonth}
                </p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {creditCardName}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Total Cuotas
                </p>
                <p className="text-base font-extrabold text-indigo-600 dark:text-indigo-400">
                  {formatMoneyCOP(totalAmount)}
                </p>
              </div>
            </div>

            {/* Selector de Cuenta de Pago */}
            <div className="space-y-1.5">
              <Label htmlFor="payment_account" className="text-xs font-semibold">
                Cuenta o medio de pago
              </Label>
              <Select
                value={selectedAccountId}
                onValueChange={(val) => setSelectedAccountId(val)}
              >
                <SelectTrigger id="payment_account" className="w-full text-xs">
                  <SelectValue placeholder="Selecciona una cuenta de pago" />
                </SelectTrigger>
                <SelectContent>
                  {paymentAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id} className="text-xs">
                      {acc.name} ({acc.account_type === "bank" ? "Banco" : "Efectivo"} · Saldo:{" "}
                      {formatMoneyCOP(roundMoney(acc.current_balance))})
                    </SelectItem>
                  ))}
                  <SelectItem value="none" className="text-xs text-slate-400">
                    Solo marcar como pagado (sin descontar de ninguna cuenta)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-slate-400">
                Se registrará la salida del dinero de la cuenta seleccionada.
              </p>
            </div>

            {/* Monto a Liquidar */}
            <div className="space-y-1.5">
              <Label htmlFor="amount_input" className="text-xs font-semibold">
                Monto del pago (COP)
              </Label>
              <Input
                id="amount_input"
                type="number"
                step="0.01"
                min="0.01"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="0.00"
                className="text-xs"
                required
              />
            </div>

            {/* Fecha del Pago */}
            <div className="space-y-1.5">
              <Label htmlFor="payment_date" className="text-xs font-semibold">
                Fecha de pago
              </Label>
              <Input
                id="payment_date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="text-xs"
                required
              />
            </div>

            {/* Notas opcionales */}
            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs font-semibold">
                Notas <span className="text-slate-400 font-normal">(Opcional)</span>
              </Label>
              <Input
                id="notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej. Pago PSE o débito automático"
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={isSubmitting}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Registrando...</span>
                  </>
                ) : (
                  <>
                    <Wallet className="w-3.5 h-3.5" />
                    <span>Confirmar Pago</span>
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
