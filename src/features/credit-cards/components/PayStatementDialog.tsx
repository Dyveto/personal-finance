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
      <DialogContent className="sm:max-w-md bg-[#131B2E] border border-white/[0.08] shadow-[0_20px_60px_rgba(0,0,0,0.6)] rounded-2xl text-[#F8FAFC]">
        <DialogHeader>
          <div className="flex items-center gap-2 text-[#8B5CF6]">
            <CreditCard className="w-5 h-5" />
            <DialogTitle className="text-lg font-heading font-bold text-[#F8FAFC]">
              Pagar Extracto de Tarjeta
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-[#94A3B8]">
            ¿Desde qué cuenta o medio de pago realizaste el pago de este extracto?
          </DialogDescription>
        </DialogHeader>

        {successData ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/25 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-heading font-bold text-[#F8FAFC]">
                ¡Pago Registrado con Éxito!
              </h4>
              <p className="text-xs text-[#94A3B8]">
                El extracto {statementMonth} de {creditCardName} por valor de{" "}
                <strong className="text-[#F8FAFC]">
                  {formatMoneyCOP(successData.amountPaid)}
                </strong>{" "}
                ha sido liquidado y los saldos fueron actualizados.
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

            {/* Resumen del Extracto */}
            <div className="p-3.5 rounded-xl bg-[#0B0F19]/60 border border-white/[0.08] flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                  Extracto {statementMonth}
                </p>
                <p className="text-sm font-heading font-bold text-[#F8FAFC]">
                  {creditCardName}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                  Total Cuotas
                </p>
                <p className="text-base font-heading font-extrabold text-[#8B5CF6]">
                  {formatMoneyCOP(totalAmount)}
                </p>
              </div>
            </div>

            {/* Selector de Cuenta de Pago */}
            <div className="space-y-1.5">
              <Label htmlFor="payment_account" className="text-xs font-semibold text-[#F8FAFC]">
                Cuenta o medio de pago
              </Label>
              <Select
                value={selectedAccountId}
                onValueChange={(val) => setSelectedAccountId(val)}
              >
                <SelectTrigger id="payment_account" className="w-full text-xs bg-[#0B0F19] border-white/[0.1] text-[#F8FAFC] rounded-xl">
                  <SelectValue placeholder="Selecciona una cuenta de pago" />
                </SelectTrigger>
                <SelectContent className="bg-[#131B2E] border-white/[0.08] text-[#F8FAFC]">
                  {paymentAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id} className="text-xs text-[#F8FAFC] hover:bg-white/[0.05]">
                      {acc.name} ({acc.account_type === "bank" ? "Banco" : "Efectivo"} · Saldo:{" "}
                      {formatMoneyCOP(roundMoney(acc.current_balance))})
                    </SelectItem>
                  ))}
                  <SelectItem value="none" className="text-xs text-[#94A3B8] hover:bg-white/[0.05]">
                    Solo marcar como pagado (sin descontar de ninguna cuenta)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-[#94A3B8]">
                Se registrará la salida del dinero de la cuenta seleccionada.
              </p>
            </div>

            {/* Monto a Liquidar */}
            <div className="space-y-1.5">
              <Label htmlFor="amount_input" className="text-xs font-semibold text-[#F8FAFC]">
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
                className="text-xs bg-[#0B0F19] border-white/[0.1] text-[#F8FAFC] rounded-xl"
                required
              />
            </div>

            {/* Fecha del Pago */}
            <div className="space-y-1.5">
              <Label htmlFor="payment_date" className="text-xs font-semibold text-[#F8FAFC]">
                Fecha de pago
              </Label>
              <Input
                id="payment_date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="text-xs bg-[#0B0F19] border-white/[0.1] text-[#F8FAFC] rounded-xl"
                required
              />
            </div>

            {/* Notas opcionales */}
            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs font-semibold text-[#F8FAFC]">
                Notas <span className="text-[#94A3B8] font-normal">(Opcional)</span>
              </Label>
              <Input
                id="notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej. Pago PSE o débito automático"
                className="text-xs bg-[#0B0F19] border-white/[0.1] text-[#F8FAFC] rounded-xl"
              />
            </div>

            <DialogFooter className="pt-2 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={isSubmitting}
                className="text-xs border-white/[0.08] bg-[#0B0F19] text-[#F8FAFC] hover:bg-white/[0.05] rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="text-xs bg-[#8B5CF6] hover:bg-[#7C3AED] text-white flex items-center gap-1.5 rounded-xl shadow-[0_0_15px_rgba(139,92,246,0.3)] transition-all"
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
