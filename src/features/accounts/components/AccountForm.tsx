"use client";

import { useState, useEffect } from "react";
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
import {
  createAccount,
  updateAccount,
  type AccountRow,
} from "@/features/accounts/actions/account-actions";
import { AlertCircle, Loader2 } from "lucide-react";

const AccountFormValidationSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "El nombre de la cuenta es obligatorio")
      .max(100, "El nombre no puede exceder 100 caracteres"),
    account_type: z.enum(["cash", "bank", "credit_card"], {
      message: "Selecciona un tipo de cuenta válido",
    }),
    institution: z.string().trim().max(100).optional().or(z.literal("")),
    initial_balance: z
      .string()
      .trim()
      .min(1, "Ingresa un saldo inicial (ej. 0)")
      .regex(/^\d+(\.\d{1,2})?$/, "Ingresa un monto válido (ej. 150000 o 0)"),
    credit_limit: z.string().optional().or(z.literal("")),
    closing_day: z.string().optional().or(z.literal("")),
    payment_due_day: z.string().optional().or(z.literal("")),
    color: z.string().optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.account_type === "credit_card") {
      // Validar cupo de crédito
      if (!data.credit_limit || !/^\d+(\.\d{1,2})?$/.test(data.credit_limit) || parseFloat(data.credit_limit) <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["credit_limit"],
          message: "El cupo de crédito debe ser un número mayor a 0",
        });
      }

      // Validar día de corte
      const closing = parseInt(data.closing_day || "", 10);
      if (isNaN(closing) || closing < 1 || closing > 31) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["closing_day"],
          message: "El día de corte debe ser un número entre 1 y 31",
        });
      }

      // Validar día de pago
      const due = parseInt(data.payment_due_day || "", 10);
      if (isNaN(due) || due < 1 || due > 31) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["payment_due_day"],
          message: "El día límite de pago debe ser un número entre 1 y 31",
        });
      }
    }
  });

type AccountFormValues = z.infer<typeof AccountFormValidationSchema>;

interface AccountFormProps {
  account?: AccountRow | null;
  onSuccess?: (account: AccountRow) => void;
  onCancel?: () => void;
}

export function AccountForm({ account, onSuccess, onCancel }: AccountFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const isEditing = !!account;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(AccountFormValidationSchema),
    defaultValues: {
      name: account?.name || "",
      account_type: account?.account_type || "bank",
      institution: account?.institution || "",
      initial_balance: account ? String(account.current_balance ?? "0") : "0",
      credit_limit: account?.credit_limit ? String(account.credit_limit) : "",
      closing_day: account?.closing_day ? String(account.closing_day) : "15",
      payment_due_day: account?.payment_due_day ? String(account.payment_due_day) : "5",
      color: account?.color || "",
    },
  });

  useEffect(() => {
    if (account) {
      reset({
        name: account.name,
        account_type: account.account_type,
        institution: account.institution || "",
        initial_balance: String(account.current_balance ?? "0"),
        credit_limit: account.credit_limit ? String(account.credit_limit) : "",
        closing_day: account.closing_day ? String(account.closing_day) : "15",
        payment_due_day: account.payment_due_day ? String(account.payment_due_day) : "5",
        color: account.color || "",
      });
    }
  }, [account, reset]);

  const selectedType = watch("account_type");

  const onSubmit = async (values: AccountFormValues) => {
    try {
      setServerError(null);

      if (isEditing && account) {
        // Modo Edición: consume updateAccount
        const payload =
          values.account_type === "credit_card"
            ? {
                name: values.name,
                account_type: "credit_card" as const,
                institution: values.institution || null,
                currency: "COP",
                current_balance: parseFloat(values.initial_balance || "0"),
                credit_limit: parseFloat(values.credit_limit || "0"),
                closing_day: parseInt(values.closing_day || "15", 10),
                payment_due_day: parseInt(values.payment_due_day || "5", 10),
                color: values.color || null,
              }
            : {
                name: values.name,
                account_type: values.account_type,
                institution: values.institution || null,
                currency: "COP",
                current_balance: parseFloat(values.initial_balance || "0"),
                credit_limit: null,
                closing_day: null,
                payment_due_day: null,
                color: values.color || null,
              };

        const result = await updateAccount(account.id, payload);

        if (!result.success) {
          setServerError(result.error);
          return;
        }

        if (onSuccess) {
          onSuccess(result.data);
        }
      } else {
        // Modo Creación: consume createAccount
        const payload =
          values.account_type === "credit_card"
            ? {
                name: values.name,
                account_type: "credit_card" as const,
                institution: values.institution || null,
                currency: "COP",
                initial_balance: parseFloat(values.initial_balance || "0"),
                credit_limit: parseFloat(values.credit_limit || "0"),
                closing_day: parseInt(values.closing_day || "15", 10),
                payment_due_day: parseInt(values.payment_due_day || "5", 10),
                color: values.color || null,
              }
            : {
                name: values.name,
                account_type: values.account_type,
                institution: values.institution || null,
                currency: "COP",
                initial_balance: parseFloat(values.initial_balance || "0"),
                credit_limit: null,
                closing_day: null,
                payment_due_day: null,
                color: values.color || null,
              };

        const result = await createAccount(payload);

        if (!result.success) {
          setServerError(result.error);
          return;
        }

        if (onSuccess) {
          onSuccess(result.data);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error inesperado al guardar la cuenta";
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

      {/* Tipo de Cuenta */}
      <div className="space-y-1.5">
        <Label htmlFor="account_type">Tipo de Cuenta</Label>
        <Select
          value={selectedType}
          onValueChange={(val: "cash" | "bank" | "credit_card") =>
            setValue("account_type", val, { shouldValidate: true })
          }
        >
          <SelectTrigger id="account_type" className="w-full">
            <SelectValue placeholder="Selecciona el tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bank">Cuenta Bancaria (Ahorros / Corriente)</SelectItem>
            <SelectItem value="cash">Efectivo / Billetera</SelectItem>
            <SelectItem value="credit_card">Tarjeta de Crédito</SelectItem>
          </SelectContent>
        </Select>
        {errors.account_type && (
          <p className="text-xs text-rose-500">{errors.account_type.message}</p>
        )}
      </div>

      {/* Nombre de la Cuenta */}
      <div className="space-y-1.5">
        <Label htmlFor="name">Nombre de la Cuenta</Label>
        <Input
          id="name"
          placeholder="Ej. Bancolombia Principal, Billetera, Visa Oro"
          {...register("name")}
        />
        {errors.name && <p className="text-xs text-rose-500">{errors.name.message}</p>}
      </div>

      {/* Institución / Banco */}
      <div className="space-y-1.5">
        <Label htmlFor="institution">
          Entidad Financiera <span className="text-xs text-slate-400 font-normal">(Opcional)</span>
        </Label>
        <Input
          id="institution"
          placeholder="Ej. Bancolombia, Nu, Davivienda, Colpatria"
          {...register("institution")}
        />
        {errors.institution && (
          <p className="text-xs text-rose-500">{errors.institution.message}</p>
        )}
      </div>

      {/* Saldo / Deuda Inicial */}
      <div className="space-y-1.5">
        <Label htmlFor="initial_balance">
          {selectedType === "credit_card"
            ? isEditing
              ? "Deuda Actual (COP)"
              : "Deuda Actual Inicial (COP)"
            : isEditing
            ? "Saldo Disponible (COP)"
            : "Saldo Inicial (COP)"}
        </Label>
        <Input
          id="initial_balance"
          type="number"
          step="0.01"
          placeholder="0.00"
          {...register("initial_balance")}
        />
        {errors.initial_balance && (
          <p className="text-xs text-rose-500">{errors.initial_balance.message}</p>
        )}
      </div>

      {/* Campos condicionales para Tarjeta de Crédito */}
      {selectedType === "credit_card" && (
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tracking-wider text-emerald-600 dark:text-emerald-400 uppercase">
              Configuración de Tarjeta
            </span>
          </div>

          {/* Cupo de Crédito */}
          <div className="space-y-1.5">
            <Label htmlFor="credit_limit">Cupo Total de Crédito (COP)</Label>
            <Input
              id="credit_limit"
              type="number"
              step="0.01"
              placeholder="Ej. 5000000"
              {...register("credit_limit")}
            />
            {errors.credit_limit && (
              <p className="text-xs text-rose-500">{errors.credit_limit.message}</p>
            )}
          </div>

          {/* Días de corte y pago */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="closing_day">Día de Corte</Label>
              <Input
                id="closing_day"
                type="number"
                min="1"
                max="31"
                placeholder="15"
                {...register("closing_day")}
              />
              {errors.closing_day && (
                <p className="text-xs text-rose-500">{errors.closing_day.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="payment_due_day">Día Límite de Pago</Label>
              <Input
                id="payment_due_day"
                type="number"
                min="1"
                max="31"
                placeholder="5"
                {...register("payment_due_day")}
              />
              {errors.payment_due_day && (
                <p className="text-xs text-rose-500">{errors.payment_due_day.message}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Botones de Acción */}
      <div className="flex items-center justify-end gap-2.5 pt-4">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
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
              {isEditing ? "Guardando cambios..." : "Creando cuenta..."}
            </>
          ) : (
            isEditing ? "Guardar Cambios" : "Crear Cuenta"
          )}
        </Button>
      </div>
    </form>
  );
}
