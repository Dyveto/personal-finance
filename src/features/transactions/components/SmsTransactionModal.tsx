"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  TransactionForm,
  type TransactionCreatedResult,
} from "./TransactionForm";
import type { AccountRow } from "@/features/accounts/actions/account-actions";
import type { CategoryRow } from "@/features/categories/actions/category-actions";
import {
  parseSmsTransaction,
  type SmsParseResult,
} from "@/lib/sms-transaction-parser";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Building2,
  HelpCircle,
} from "lucide-react";

interface SmsTransactionModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: AccountRow[];
  categories: CategoryRow[];
  onSuccess?: (result?: TransactionCreatedResult) => void;
}

export function SmsTransactionModal({
  isOpen,
  onOpenChange,
  accounts,
  categories,
  onSuccess,
}: SmsTransactionModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [rawText, setRawText] = useState("");
  const [includeSmsInNotes, setIncludeSmsInNotes] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<SmsParseResult | null>(null);

  const handleClose = useCallback(() => {
    setStep(1);
    setRawText("");
    setIncludeSmsInNotes(false);
    setErrorMsg(null);
    setParseResult(null);
    onOpenChange(false);
  }, [onOpenChange]);

  const handleNextStep = () => {
    const trimmed = rawText.trim();
    if (!trimmed) {
      setErrorMsg("Por favor pega el texto de la notificación o mensaje SMS.");
      return;
    }

    try {
      const mappedAccounts = accounts.map((acc) => ({
        id: acc.id,
        name: acc.name,
        lastFour: null,
      }));

      const result = parseSmsTransaction(trimmed, mappedAccounts);
      setParseResult(result);
      setErrorMsg(null);
      setStep(2);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Error inesperado al analizar el SMS.";
      setErrorMsg(message);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-[#F8FAFC] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
        {step === 1 ? (
          <div className="space-y-4">
            <DialogHeader>
              <div className="flex items-center justify-between gap-2">
                <DialogTitle className="font-heading font-bold text-slate-900 dark:text-[#F8FAFC] text-lg md:text-xl">
                  SMS de nueva transacción
                </DialogTitle>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-[#D4AF37] border border-amber-500/25 transition-transform duration-200 hover:scale-105 motion-reduce:transform-none">
                  <Sparkles className="w-3 h-3 text-amber-600 dark:text-[#D4AF37]" />
                  Paso 1 de 2
                </span>
              </div>
              <DialogDescription className="text-xs text-slate-500 dark:text-[#94A3B8] mt-1">
                Pega el texto del SMS o notificación bancaria para extraer automáticamente los datos del movimiento.
              </DialogDescription>

              {/* Barra de progreso al 50% */}
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 dark:text-[#94A3B8] font-medium">
                    Progreso del asistente
                  </span>
                  <span className="text-amber-600 dark:text-[#D4AF37] font-semibold">50%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 dark:bg-white/[0.08] rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 dark:bg-[#D4AF37] transition-all duration-300 ease-out motion-reduce:transition-none w-1/2" />
                </div>
              </div>
            </DialogHeader>

            {/* Formulario de captura de texto */}
            <div className="space-y-2 pt-2">
              <label
                htmlFor="sms-raw-text"
                className="text-xs font-semibold text-slate-700 dark:text-[#F8FAFC]"
              >
                Texto del SMS o Notificación
              </label>
              <textarea
                id="sms-raw-text"
                rows={5}
                value={rawText}
                onChange={(e) => {
                  setRawText(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="Ej: Bancolombia le informa compra por $45.000,00 en RESTAURANTE EL SOL con tarjeta *1234 el 20/11/2026..."
                className="w-full rounded-xl p-3 text-xs md:text-sm bg-slate-50 dark:bg-[#0B0F19] border border-slate-200 dark:border-white/[0.1] text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-400 dark:placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-amber-500/50 dark:focus:ring-[#D4AF37]/50 resize-y"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-[#94A3B8]">
                <span>Pega el mensaje recibido de Bancolombia, Nequi, Davivienda, etc.</span>
                <span>{rawText.length} caracteres</span>
              </div>

              {/* Checkbox para incluir texto SMS en notas */}
              <div className="flex items-center gap-2.5 pt-2">
                <input
                  id="include-sms-in-notes"
                  type="checkbox"
                  checked={includeSmsInNotes}
                  onChange={(e) => setIncludeSmsInNotes(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 dark:border-white/[0.2] bg-white dark:bg-[#0B0F19] text-amber-600 dark:text-[#D4AF37] focus:ring-2 focus:ring-amber-500/40 accent-amber-600 dark:accent-[#D4AF37] cursor-pointer transition-colors"
                />
                <label
                  htmlFor="include-sms-in-notes"
                  className="text-xs text-slate-700 dark:text-[#CBD5E1] cursor-pointer select-none font-medium hover:text-slate-900 dark:hover:text-[#F8FAFC] transition-colors"
                >
                  Incluir el mensaje original en las notas de la transacción
                </label>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl border border-rose-300 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Botones de acción */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-white/[0.08]">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="border-slate-200 dark:border-white/[0.1] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.05] rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={!rawText.trim()}
                onClick={handleNextStep}
                className="bg-amber-600 hover:bg-amber-700 text-white dark:bg-[#D4AF37] dark:hover:bg-[#C5A059] dark:text-slate-950 dark:font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all"
              >
                <span>Siguiente</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <DialogHeader>
              <div className="flex items-center justify-between gap-2">
                <DialogTitle className="font-heading font-bold text-slate-900 dark:text-[#F8FAFC] text-lg md:text-xl">
                  Confirmar Transacción
                </DialogTitle>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 transition-transform duration-200 hover:scale-105 motion-reduce:transform-none">
                  <CheckCircle2 className="w-3 h-3 text-[#10B981]" />
                  Paso 2 de 2
                </span>
              </div>
              <DialogDescription className="text-xs text-slate-500 dark:text-[#94A3B8] mt-1">
                Revisa los datos detectados del SMS, asigna la categoría y confirma el movimiento.
              </DialogDescription>

              {/* Barra de progreso al 100% */}
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 dark:text-[#94A3B8] font-medium">
                    Progreso del asistente
                  </span>
                  <span className="text-[#10B981] font-semibold">100% completado</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 dark:bg-white/[0.08] rounded-full overflow-hidden">
                  <div className="h-full bg-[#10B981] transition-all duration-300 ease-out motion-reduce:transition-none w-full" />
                </div>
              </div>
            </DialogHeader>

            {/* Barra de estado de detección y retorno al paso 1 */}
            <div className="flex flex-wrap items-center justify-between gap-2 py-1">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 dark:text-[#94A3B8] dark:hover:text-[#F8FAFC] transition-colors font-medium"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver al texto</span>
              </button>

              <div className="flex items-center gap-2">
                {parseResult?.detectedBank && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/[0.08]">
                    <Building2 className="w-3 h-3 text-slate-400" />
                    {parseResult.detectedBank}
                  </span>
                )}
                {parseResult?.accountMatched ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                    <CheckCircle2 className="w-3 h-3 text-[#10B981]" />
                    Cuenta vinculada
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                    <HelpCircle className="w-3 h-3 text-amber-500" />
                    Selecciona tu cuenta
                  </span>
                )}
              </div>
            </div>

            {/* Aviso informativo cuando la cuenta no fue vinculada automáticamente */}
            {!parseResult?.accountMatched && (
              <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-800/50 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-500" />
                <span>
                  No pudimos identificar la cuenta automáticamente. El selector de cuenta está enfocado para que la elijas a continuación.
                </span>
              </div>
            )}

            {/* Formulario de transacción pre-rellenado */}
            <TransactionForm
              accounts={accounts}
              categories={categories}
              prefillData={{
                account_id: parseResult?.matchedAccountId ?? "",
                category_id: "",
                amount: parseResult?.amount ?? "",
                transaction_type: parseResult?.type ?? "expense",
                transaction_date: parseResult?.date ?? undefined,
                description: "",
                notes: includeSmsInNotes ? rawText.trim() : "",
                autoFocusAccount: !parseResult?.accountMatched,
              }}
              onSuccess={(result) => {
                handleClose();
                onSuccess?.(result);
              }}
              onCancel={handleClose}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
