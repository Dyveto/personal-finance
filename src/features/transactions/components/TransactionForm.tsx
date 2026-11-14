"use client";

import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AccountRow } from "@/features/accounts/actions/account-actions";
import type { CategoryRow } from "@/features/categories/actions/category-actions";
import {
  createTransaction,
  createInstallmentPurchase,
} from "@/features/transactions/actions/transaction-actions";
import { formatMoneyCOP, splitInstallments, roundMoney } from "@/lib/finance/money";
import { AlertCircle, CreditCard, Loader2, Sparkles } from "lucide-react";

const TransactionFormSchema = z
  .object({
    account_id: z.string().uuid("Selecciona una cuenta válida"),
    category_id: z.string().uuid("Selecciona una categoría válida"),
    description: z
      .string()
      .trim()
      .min(1, "La descripción es requerida")
      .max(255, "La descripción no puede exceder 255 caracteres"),
    amount: z
      .string()
      .trim()
      .min(1, "Ingresa un monto")
      .regex(/^\d+(\.\d{1,2})?$/, "Ingresa un monto válido (ej. 50000 o 2500.50)"),
    transaction_type: z.enum(["income", "expense"], {
      message: "Selecciona el tipo de transacción",
    }),
    transaction_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD)"),
    is_installment: z.boolean(),
    installment_count: z.string(),
    notes: z.string().trim().max(1000).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    const amt = parseFloat(data.amount || "0");
    if (isNaN(amt) || amt <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amount"],
        message: "El monto debe ser estrictamente mayor a 0",
      });
    }

    if (data.is_installment) {
      const count = parseInt(data.installment_count || "1", 10);
      if (isNaN(count) || count < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["installment_count"],
          message: "El número de cuotas debe ser al menos 1",
        });
      }
    }
  });

type TransactionFormValues = z.infer<typeof TransactionFormSchema>;

interface TransactionFormProps {
  accounts: AccountRow[];
  categories: CategoryRow[];
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function TransactionForm({
  accounts,
  categories,
  onSuccess,
  onCancel,
}: TransactionFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  // Fecha civil actual en Colombia (YYYY-MM-DD)
  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(TransactionFormSchema),
    defaultValues: {
      account_id: accounts[0]?.id || "",
      category_id: "",
      description: "",
      amount: "",
      transaction_type: "expense",
      transaction_date: todayStr,
      is_installment: false,
      installment_count: "1",
      notes: "",
    },
  });

  const selectedAccountId = watch("account_id");
  const selectedType = watch("transaction_type");
  const isInstallment = watch("is_installment");
  const currentAmount = watch("amount");
  const currentInstallments = watch("installment_count");

  // Identificar si la cuenta seleccionada es Tarjeta de Crédito
  const selectedAccount = useMemo(() => {
    return accounts.find((acc) => acc.id === selectedAccountId);
  }, [accounts, selectedAccountId]);

  const isCreditCard = selectedAccount?.account_type === "credit_card";

  // Filtrar categorías según el tipo de transacción seleccionado
  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => cat.category_type === selectedType);
  }, [categories, selectedType]);

  // Cálculo en vivo de cuotas para previsualización
  const installmentPreview = useMemo(() => {
    if (!isCreditCard || !isInstallment) return null;
    const amt = parseFloat(currentAmount);
    const count = parseInt(currentInstallments, 10);
    if (isNaN(amt) || amt <= 0 || isNaN(count) || count < 1) return null;

    try {
      const splits = splitInstallments(roundMoney(amt), count);
      return {
        count,
        first: splits[0],
        remaining: splits.length > 1 ? splits[1] : splits[0],
        total: roundMoney(amt),
      };
    } catch {
      return null;
    }
  }, [isCreditCard, isInstallment, currentAmount, currentInstallments]);

  // Si se selecciona tarjeta de crédito, forzar tipo de transacción a "gasto"
  const handleAccountChange = (accId: string) => {
    setValue("account_id", accId, { shouldValidate: true });
    const acc = accounts.find((a) => a.id === accId);
    if (acc?.account_type === "credit_card" && selectedType === "income") {
      setValue("transaction_type", "expense", { shouldValidate: true });
      setValue("category_id", "");
    }
  };

  const onSubmit = async (values: TransactionFormValues) => {
    try {
      setServerError(null);
      const count = parseInt(values.installment_count || "1", 10);
      const isInstallmentActive = isCreditCard && values.is_installment && count > 1;

      if (isInstallmentActive) {
        // Compra diferida en Tarjeta de Crédito
        const payload = {
          account_id: values.account_id,
          category_id: values.category_id,
          description: values.description,
          amount: parseFloat(values.amount),
          transaction_date: values.transaction_date,
          installment_count: count,
          notes: values.notes || null,
        };

        const result = await createInstallmentPurchase(payload);
        if (!result.success) {
          setServerError(result.error);
          return;
        }
      } else {
        // Transacción estándar
        const payload = {
          account_id: values.account_id,
          category_id: values.category_id,
          description: values.description,
          amount: parseFloat(values.amount),
          transaction_type: values.transaction_type,
          transaction_date: values.transaction_date,
          is_installment: false,
          installment_count: 1,
          notes: values.notes || null,
        };

        const result = await createTransaction(payload);
        if (!result.success) {
          setServerError(result.error);
          return;
        }
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al procesar la transacción";
      setServerError(msg);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <div className="p-3.5 rounded-lg border border-rose-300 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      {/* Tipo de Transacción (Selector Ingreso / Gasto) */}
      <div className="space-y-1.5">
        <Label>Tipo de Movimiento</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={selectedType === "expense" ? "default" : "outline"}
            onClick={() => {
              setValue("transaction_type", "expense", { shouldValidate: true });
              setValue("category_id", "");
            }}
            className={`w-full text-xs font-bold ${
              selectedType === "expense" ? "bg-rose-600 hover:bg-rose-700 text-white" : ""
            }`}
          >
            Gasto / Compra
          </Button>

          <Button
            type="button"
            disabled={isCreditCard}
            variant={selectedType === "income" ? "default" : "outline"}
            onClick={() => {
              setValue("transaction_type", "income", { shouldValidate: true });
              setValue("category_id", "");
              setValue("is_installment", false);
            }}
            className={`w-full text-xs font-bold ${
              selectedType === "income" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""
            } ${isCreditCard ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            Ingreso
          </Button>
        </div>
        {isCreditCard && (
          <p className="text-[11px] text-slate-400">
            * Las tarjetas de crédito solo admiten registros de gasto o compras.
          </p>
        )}
      </div>

      {/* Selector de Cuenta */}
      <div className="space-y-1.5">
        <Label htmlFor="account_id">Cuenta de Origen / Pago</Label>
        <Select value={selectedAccountId} onValueChange={handleAccountChange}>
          <SelectTrigger id="account_id">
            <SelectValue placeholder="Selecciona una cuenta" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((acc) => (
              <SelectItem key={acc.id} value={acc.id}>
                {acc.name} (
                {acc.account_type === "credit_card"
                  ? "Tarjeta de Crédito"
                  : acc.account_type === "bank"
                  ? "Banco"
                  : "Efectivo"}
                )
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.account_id && (
          <p className="text-xs text-rose-500">{errors.account_id.message}</p>
        )}
      </div>

      {/* Monto y Fecha */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="amount">Monto (COP)</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            placeholder="Ej. 100000"
            {...register("amount")}
          />
          {errors.amount && <p className="text-xs text-rose-500">{errors.amount.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="transaction_date">Fecha</Label>
          <Input id="transaction_date" type="date" {...register("transaction_date")} />
          {errors.transaction_date && (
            <p className="text-xs text-rose-500">{errors.transaction_date.message}</p>
          )}
        </div>
      </div>

      {/* Selector de Categoría */}
      <div className="space-y-1.5">
        <Label htmlFor="category_id">Categoría</Label>
        <Select
          value={watch("category_id")}
          onValueChange={(val) => setValue("category_id", val, { shouldValidate: true })}
        >
          <SelectTrigger id="category_id">
            <SelectValue placeholder="Selecciona una categoría" />
          </SelectTrigger>
          <SelectContent>
            {filteredCategories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.category_id && (
          <p className="text-xs text-rose-500">{errors.category_id.message}</p>
        )}
      </div>

      {/* Descripción */}
      <div className="space-y-1.5">
        <Label htmlFor="description">Descripción</Label>
        <Input
          id="description"
          placeholder="Ej. Compra supermercado, Cena restaurante, Gasolina"
          {...register("description")}
        />
        {errors.description && (
          <p className="text-xs text-rose-500">{errors.description.message}</p>
        )}
      </div>

      {/* Sección Opcional de Cuotas (Habilitada solo para Tarjetas de Crédito) */}
      {isCreditCard && (
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <Label htmlFor="is_installment" className="font-semibold text-xs cursor-pointer">
                Diferir compra a cuotas
              </Label>
            </div>
            <input
              id="is_installment"
              type="checkbox"
              className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
              checked={isInstallment}
              onChange={(e) => setValue("is_installment", e.target.checked)}
            />
          </div>

          {isInstallment && (
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800 animate-in fade-in-50 duration-150">
              <div className="space-y-1.5">
                <Label htmlFor="installment_count" className="text-xs">
                  Número de Cuotas
                </Label>
                <Select
                  value={currentInstallments}
                  onValueChange={(val) => setValue("installment_count", val)}
                >
                  <SelectTrigger id="installment_count">
                    <SelectValue placeholder="Selecciona cuotas" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 6, 9, 12, 18, 24, 36].map((num) => (
                      <SelectItem key={num} value={String(num)}>
                        {num} {num === 1 ? "cuota (pago directo)" : "cuotas mensuales"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.installment_count && (
                  <p className="text-xs text-rose-500">{errors.installment_count.message}</p>
                )}
              </div>

              {/* Previsualización en vivo de la distribución de cuotas */}
              {installmentPreview && installmentPreview.count > 1 && (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Distribución Exacta de Cuotas (Sin Pérdida de Centavos)</span>
                  </div>
                  <div className="text-emerald-900 dark:text-emerald-200 pt-1 flex justify-between">
                    <span>Cuota 1 (con ajuste de residuo):</span>
                    <span className="font-bold">{formatMoneyCOP(installmentPreview.first)}</span>
                  </div>
                  <div className="text-emerald-900 dark:text-emerald-200 flex justify-between">
                    <span>Cuotas 2 a {installmentPreview.count}:</span>
                    <span className="font-bold">{formatMoneyCOP(installmentPreview.remaining)} c/u</span>
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px] pt-1 border-t border-emerald-200 dark:border-emerald-800/40 flex justify-between">
                    <span>Suma total consolidada:</span>
                    <span className="font-bold">{formatMoneyCOP(installmentPreview.total)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Notas opcionales */}
      <div className="space-y-1.5">
        <Label htmlFor="notes">
          Notas <span className="text-xs text-slate-400 font-normal">(Opcional)</span>
        </Label>
        <Input id="notes" placeholder="Notas adicionales o referencia" {...register("notes")} />
      </div>

      {/* Botones de Acción */}
      <div className="flex items-center justify-end gap-2.5 pt-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
        )}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Guardando...
            </>
          ) : (
            "Registrar Transacción"
          )}
        </Button>
      </div>
    </form>
  );
}
