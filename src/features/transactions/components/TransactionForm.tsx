"use client";

import { useState, useMemo, useEffect } from "react";
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
  updateTransaction,
  type TransactionRow,
} from "@/features/transactions/actions/transaction-actions";
import { formatMoneyCOP, splitInstallments, roundMoney } from "@/lib/finance/money";
import { AlertCircle, CreditCard, Loader2, Sparkles } from "lucide-react";

const TransactionFormSchema = z
  .object({
    account_id: z.string().uuid("Selecciona una cuenta válida"),
    category_id: z.string().optional(),
    new_category_name: z.string().trim().max(100).optional(),
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

    // Debe existir category_id o new_category_name
    if (!data.category_id && (!data.new_category_name || data.new_category_name.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["category_id"],
        message: "Selecciona una categoría o ingresa una nueva",
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

export type TransactionCreatedResult =
  | TransactionRow
  | { transaction: TransactionRow; installments: string[] };

export interface TransactionPrefillData {
  account_id?: string;
  category_id?: string;
  new_category_name?: string;
  description?: string;
  amount?: string;
  transaction_type?: "income" | "expense";
  transaction_date?: string;
  is_installment?: boolean;
  installment_count?: string;
  notes?: string;
  autoFocusAccount?: boolean;
}

interface TransactionFormProps {
  accounts: AccountRow[];
  categories: CategoryRow[];
  initialData?: TransactionRow;
  prefillData?: TransactionPrefillData;
  onSuccess?: (result?: TransactionCreatedResult) => void;
  onCancel?: () => void;
}

export function TransactionForm({
  accounts,
  categories,
  initialData,
  prefillData,
  onSuccess,
  onCancel,
}: TransactionFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const isEditing = Boolean(initialData);

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
      account_id:
        initialData?.account_id ??
        (prefillData?.account_id !== undefined ? prefillData.account_id : accounts[0]?.id || ""),
      category_id: initialData?.category_id || prefillData?.category_id || "",
      new_category_name: prefillData?.new_category_name || "",
      description: initialData?.description || prefillData?.description || "",
      amount: initialData?.amount ? initialData.amount.toString() : prefillData?.amount || "",
      transaction_type: initialData?.transaction_type || prefillData?.transaction_type || "expense",
      transaction_date: initialData?.transaction_date || prefillData?.transaction_date || todayStr,
      is_installment: initialData?.is_installment ?? prefillData?.is_installment ?? false,
      installment_count: initialData?.installment_count ? initialData.installment_count.toString() : prefillData?.installment_count || "1",
      notes: initialData?.notes || prefillData?.notes || "",
    },
  });

  // Sincronizar prefillData si cambia dinámicamente
  useEffect(() => {
    if (prefillData) {
      if (prefillData.account_id !== undefined) setValue("account_id", prefillData.account_id);
      if (prefillData.category_id !== undefined) setValue("category_id", prefillData.category_id);
      if (prefillData.description !== undefined) setValue("description", prefillData.description);
      if (prefillData.amount !== undefined) setValue("amount", prefillData.amount);
      if (prefillData.transaction_type !== undefined) setValue("transaction_type", prefillData.transaction_type);
      if (prefillData.transaction_date !== undefined) setValue("transaction_date", prefillData.transaction_date);
      if (prefillData.notes !== undefined) setValue("notes", prefillData.notes);
    }
  }, [prefillData, setValue]);

  // Auto-focus en el selector de cuenta si autoFocusAccount es verdadero
  useEffect(() => {
    if (prefillData?.autoFocusAccount) {
      const timer = setTimeout(() => {
        const trigger = document.getElementById("account_id");
        if (trigger) {
          trigger.focus();
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [prefillData?.autoFocusAccount]);

  const selectedAccountId = watch("account_id");
  const selectedType = watch("transaction_type");
  const isInstallment = watch("is_installment");
  const currentAmount = watch("amount");
  const currentInstallments = watch("installment_count");
  const currentCategoryId = watch("category_id");

  // Identificar si la cuenta seleccionada es Tarjeta de Crédito
  const selectedAccount = useMemo(() => {
    return accounts.find((acc) => acc.id === selectedAccountId);
  }, [accounts, selectedAccountId]);

  const isCreditCard = selectedAccount?.account_type === "credit_card";

  // Filtrar categorías según el tipo de transacción seleccionado
  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => cat.category_type === selectedType && cat.is_active !== false);
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
      setIsCustomCategory(false);
    }
  };

  const onSubmit = async (values: TransactionFormValues) => {
    try {
      setServerError(null);
      const count = parseInt(values.installment_count || "1", 10);
      const isInstallmentActive = isCreditCard && values.is_installment && count > 1;

      const newCategoryTrimmed = isCustomCategory && values.new_category_name?.trim()
        ? values.new_category_name.trim()
        : undefined;

      const categoryIdVal = !isCustomCategory && values.category_id
        ? values.category_id
        : undefined;

      let createdOrUpdated: TransactionCreatedResult | undefined;

      if (initialData) {
        // Edición de transacción existente
        const payload = {
          account_id: values.account_id,
          category_id: categoryIdVal,
          new_category_name: newCategoryTrimmed,
          description: values.description,
          amount: parseFloat(values.amount),
          transaction_type: values.transaction_type,
          transaction_date: values.transaction_date,
          installment_count: isInstallmentActive ? count : 1,
          notes: values.notes || null,
        };

        const result = await updateTransaction(initialData.id, payload);
        if (!result.success) {
          setServerError(result.error);
          return;
        }
        createdOrUpdated = result.data;
      } else if (isInstallmentActive) {
        // Compra diferida en Tarjeta de Crédito
        const payload = {
          account_id: values.account_id,
          category_id: categoryIdVal,
          new_category_name: newCategoryTrimmed,
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
        createdOrUpdated = result.data;
      } else {
        // Transacción estándar
        const payload = {
          account_id: values.account_id,
          category_id: categoryIdVal,
          new_category_name: newCategoryTrimmed,
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
        createdOrUpdated = result.data;
      }

      if (onSuccess) {
        onSuccess(createdOrUpdated);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al procesar la transacción";
      setServerError(msg);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <div className="p-3.5 rounded-xl border border-rose-300 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 1. PRIMER CAMPO: SELECTOR DE CUENTA DE ORIGEN / PAGO          */}
      {/* ------------------------------------------------------------- */}
      <div className="space-y-1.5">
        <Label htmlFor="account_id" className="text-xs font-semibold text-slate-700 dark:text-[#F8FAFC]">
          Cuenta de Origen / Pago
        </Label>
        <Select value={selectedAccountId} onValueChange={handleAccountChange}>
          <SelectTrigger id="account_id" className="bg-slate-50 dark:bg-[#0B0F19] border-slate-200 dark:border-white/[0.1] text-xs">
            <SelectValue placeholder="Selecciona una cuenta" />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-white/[0.1] text-slate-900 dark:text-[#F8FAFC]">
            {accounts.map((acc) => (
              <SelectItem key={acc.id} value={acc.id} className="text-xs">
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

      {/* ------------------------------------------------------------- */}
      {/* 2. SEGUNDO CAMPO: SELECTOR DE TIPO DE MOVIMIENTO              */}
      {/* ------------------------------------------------------------- */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-700 dark:text-[#F8FAFC]">
          Tipo de Movimiento
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={selectedType === "expense" ? "default" : "outline"}
            onClick={() => {
              setValue("transaction_type", "expense", { shouldValidate: true });
              setValue("category_id", "");
              setIsCustomCategory(false);
            }}
            className={`w-full text-xs font-bold rounded-xl transition-all ${
              selectedType === "expense"
                ? "bg-[#F43F5E] hover:bg-rose-600 text-white shadow-[0_0_12px_rgba(244,63,94,0.3)]"
                : "border-slate-200 dark:border-white/[0.1] text-slate-600 dark:text-[#94A3B8]"
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
              setIsCustomCategory(false);
            }}
            className={`w-full text-xs font-bold rounded-xl transition-all ${
              selectedType === "income"
                ? "bg-[#10B981] hover:bg-emerald-600 text-white shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                : "border-slate-200 dark:border-white/[0.1] text-slate-600 dark:text-[#94A3B8]"
            } ${isCreditCard ? "opacity-40 cursor-not-allowed" : ""}`}
          >
            Ingreso
          </Button>
        </div>
        {isCreditCard && (
          <p className="text-[11px] text-slate-500 dark:text-[#94A3B8]">
            * Las tarjetas de crédito solo admiten compras o registros de gasto.
          </p>
        )}
      </div>

      {/* Monto y Fecha */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="amount" className="text-xs font-semibold text-slate-700 dark:text-[#F8FAFC]">
            Monto (COP)
          </Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            placeholder="Ej. 100000"
            className="bg-slate-50 dark:bg-[#0B0F19] border-slate-200 dark:border-white/[0.1] text-xs"
            {...register("amount")}
          />
          {errors.amount && <p className="text-xs text-rose-500">{errors.amount.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="transaction_date" className="text-xs font-semibold text-slate-700 dark:text-[#F8FAFC]">
            Fecha
          </Label>
          <Input
            id="transaction_date"
            type="date"
            className="bg-slate-50 dark:bg-[#0B0F19] border-slate-200 dark:border-white/[0.1] text-xs"
            {...register("transaction_date")}
          />
          {errors.transaction_date && (
            <p className="text-xs text-rose-500">{errors.transaction_date.message}</p>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* CATEGORÍA CON SOPORTE PERSONALIZADO AL VUELO                  */}
      {/* ------------------------------------------------------------- */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="category_id" className="text-xs font-semibold text-slate-700 dark:text-[#F8FAFC]">
            Categoría
          </Label>
          <button
            type="button"
            onClick={() => {
              const nextState = !isCustomCategory;
              setIsCustomCategory(nextState);
              if (nextState) {
                setValue("category_id", "");
                setValue("new_category_name", "");
              } else {
                setValue("new_category_name", "");
              }
            }}
            className="text-[11px] text-[#8B5CF6] hover:text-[#A78BFA] font-medium flex items-center gap-1 transition-colors"
          >
            {isCustomCategory ? "Elegir categoría existente" : "+ Nueva categoría"}
          </button>
        </div>

        {!isCustomCategory ? (
          <Select
            value={currentCategoryId}
            onValueChange={(val) => {
              if (val === "__ADD_NEW__") {
                setIsCustomCategory(true);
                setValue("category_id", "");
                setValue("new_category_name", "");
              } else {
                setValue("category_id", val, { shouldValidate: true });
              }
            }}
          >
            <SelectTrigger id="category_id" className="bg-slate-50 dark:bg-[#0B0F19] border-slate-200 dark:border-white/[0.1] text-xs">
              <SelectValue placeholder="Selecciona una categoría..." />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-white/[0.1] text-slate-900 dark:text-[#F8FAFC]">
              {filteredCategories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id} className="text-xs">
                  {cat.name}
                </SelectItem>
              ))}
              <SelectItem
                value="__ADD_NEW__"
                className="text-[#8B5CF6] font-semibold border-t border-slate-100 dark:border-white/[0.08] mt-1 pt-1.5 text-xs"
              >
                + Añadir categoría personalizada...
              </SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <div className="space-y-1.5 p-3 rounded-xl bg-slate-100/60 dark:bg-[#0B0F19]/60 border border-slate-200 dark:border-white/[0.08]">
            <div className="relative">
              <Input
                placeholder="Nombre de la nueva categoría (ej. Mascotas, Streaming, Gym)"
                {...register("new_category_name")}
                className="bg-white dark:bg-[#131B2E] border-slate-200 dark:border-white/[0.1] text-xs pr-16"
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  setIsCustomCategory(false);
                  setValue("new_category_name", "");
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 hover:text-slate-900 dark:text-[#94A3B8] dark:hover:text-white px-2 py-0.5 rounded bg-slate-200 dark:bg-white/[0.08]"
              >
                Cancelar
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#8B5CF6]" />
              <span>Se guardará automáticamente y quedará disponible para futuros movimientos.</span>
            </p>
          </div>
        )}

        {errors.category_id && (
          <p className="text-xs text-rose-500">{errors.category_id.message}</p>
        )}
      </div>

      {/* Descripción */}
      <div className="space-y-1.5">
        <Label htmlFor="description" className="text-xs font-semibold text-slate-700 dark:text-[#F8FAFC]">
          Descripción
        </Label>
        <Input
          id="description"
          placeholder="Ej. Compra supermercado, Cena restaurante, Gasolina"
          className="bg-slate-50 dark:bg-[#0B0F19] border-slate-200 dark:border-white/[0.1] text-xs"
          {...register("description")}
        />
        {errors.description && (
          <p className="text-xs text-rose-500">{errors.description.message}</p>
        )}
      </div>

      {/* Opciones de Cuotas en Tarjeta de Crédito */}
      {isCreditCard && (
        <div className="p-4 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-[#0B0F19]/50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#8B5CF6]" />
              <Label htmlFor="is_installment" className="text-xs font-semibold text-slate-900 dark:text-[#F8FAFC] cursor-pointer">
                ¿Diferir compra a cuotas?
              </Label>
            </div>
            <input
              id="is_installment"
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 dark:border-white/[0.2] text-[#8B5CF6] focus:ring-[#8B5CF6] accent-[#8B5CF6]"
              {...register("is_installment")}
            />
          </div>

          {isInstallment && (
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-white/[0.08]">
              <div className="space-y-1">
                <Label htmlFor="installment_count" className="text-xs text-slate-500 dark:text-[#94A3B8]">
                  Número de Cuotas Mensuales
                </Label>
                <Input
                  id="installment_count"
                  type="number"
                  min="1"
                  max="48"
                  placeholder="Ej. 6"
                  className="bg-white dark:bg-[#131B2E] border-slate-200 dark:border-white/[0.1] text-xs w-32"
                  {...register("installment_count")}
                />
                {errors.installment_count && (
                  <p className="text-xs text-rose-500">{errors.installment_count.message}</p>
                )}
              </div>

              {/* Previsualización del Desglose de Cuotas */}
              {installmentPreview && installmentPreview.count > 1 && (
                <div className="p-3 rounded-lg bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-[#8B5CF6]">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Proyección de Cuotas:</span>
                  </div>
                  <div className="text-slate-600 dark:text-[#94A3B8] text-[11px] space-y-0.5">
                    <p>
                      • Cuota 1: <strong className="text-slate-900 dark:text-white">{formatMoneyCOP(installmentPreview.first)}</strong>
                      {installmentPreview.first !== installmentPreview.remaining && (
                        <span className="italic ml-1">(ajuste exacto de centavos)</span>
                      )}
                    </p>
                    {installmentPreview.count > 1 && (
                      <p>
                        • Cuotas 2 a {installmentPreview.count}:{" "}
                        <strong className="text-slate-900 dark:text-white">{formatMoneyCOP(installmentPreview.remaining)}</strong> / mes
                      </p>
                    )}
                    <p className="pt-1 text-[10px] text-slate-500">
                      Total exacto acumulado: {formatMoneyCOP(installmentPreview.total)} COP
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Notas adicionales */}
      <div className="space-y-1.5">
        <Label htmlFor="notes" className="text-xs font-semibold text-slate-700 dark:text-[#F8FAFC]">
          Notas u Observaciones (Opcional)
        </Label>
        <Input
          id="notes"
          placeholder="Detalles adicionales, número de factura o comercio..."
          className="bg-slate-50 dark:bg-[#0B0F19] border-slate-200 dark:border-white/[0.1] text-xs"
          {...register("notes")}
        />
        {errors.notes && <p className="text-xs text-rose-500">{errors.notes.message}</p>}
      </div>

      {/* Acciones del formulario */}
      <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-white/[0.08]">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            className="text-xs border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#131B2E] text-slate-700 dark:text-[#F8FAFC] hover:bg-slate-100 dark:hover:bg-white/[0.05] rounded-xl font-medium"
          >
            Cancelar
          </Button>
        )}

        <Button
          type="submit"
          disabled={isSubmitting}
          className="text-xs bg-[#8B5CF6] hover:bg-[#7C3AED] text-white shadow-[0_0_15px_rgba(139,92,246,0.3)] rounded-xl flex items-center gap-1.5 transition-all"
        >
          {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          <span>{isEditing ? "Guardar Cambios" : "Registrar Transacción"}</span>
        </Button>
      </div>
    </form>
  );
}
