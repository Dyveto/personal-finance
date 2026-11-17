import { z } from "zod";
import { parseCivilDate } from "@/lib/finance/calendar";

/**
 * Validador para fechas civiles en formato ISO YYYY-MM-DD.
 */
export const CivilDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .refine(
    (dateStr) => {
      try {
        parseCivilDate(dateStr);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Date is not a valid civil calendar date" }
  );

/**
 * Validador de día del mes (1 a 31). Acepta enteros o strings numéricos.
 */
export const DayOfMonthSchema = z
  .union([
    z.number().int("Day must be an integer"),
    z.string().regex(/^\d+$/, "Day must be an integer").transform((s) => parseInt(s, 10)),
  ])
  .refine((val) => val >= 1 && val <= 31, {
    message: "Day must be an integer between 1 and 31",
  });

/**
 * Validador de número de cuotas (>= 1). Acepta enteros o strings numéricos.
 */
export const InstallmentCountSchema = z
  .union([
    z.number().int("Installment count must be an integer"),
    z.string().regex(/^\d+$/, "Installment count must be an integer").transform((s) => parseInt(s, 10)),
  ])
  .refine((val) => val >= 1, {
    message: "Installment count must be at least 1",
  });

/**
 * Validador de montos monetarios positivos con máximo 2 decimales.
 * Soporta números y strings con formatos estándar o colombianos (ej: 30800, "30800", "30800.50", "30800,50", "$ 30800").
 */
export const PositiveMoneySchema = z
  .union([
    z.number(),
    z.string().trim(),
  ])
  .transform((val, ctx) => {
    if (typeof val === "number") {
      if (!Number.isFinite(val) || val <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Amount must be greater than zero",
        });
        return z.NEVER;
      }
      return parseFloat(val.toFixed(2));
    }

    let clean = val.replace(/[$ ]/g, "");
    if (clean.includes(",") && clean.includes(".")) {
      if (clean.lastIndexOf(",") > clean.lastIndexOf(".")) {
        clean = clean.replace(/\./g, "").replace(",", ".");
      } else {
        clean = clean.replace(/,/g, "");
      }
    } else if (clean.includes(",")) {
      clean = clean.replace(",", ".");
    }

    if (!/^\d+(\.\d{1,2})?$/.test(clean)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Amount must have at most 2 decimal places",
      });
      return z.NEVER;
    }

    const num = parseFloat(clean);
    if (!Number.isFinite(num) || num <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Amount must be greater than zero",
      });
      return z.NEVER;
    }

    return num;
  });

/**
 * Validador de balance inicial no negativo (>= 0).
 */
export const NonNegativeMoneySchema = z
  .union([
    z.number(),
    z.string().trim(),
  ])
  .transform((val, ctx) => {
    if (typeof val === "number") {
      if (!Number.isFinite(val) || val < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Initial balance cannot be negative",
        });
        return z.NEVER;
      }
      return parseFloat(val.toFixed(2));
    }

    let clean = val.replace(/[$ ]/g, "");
    if (clean.includes(",") && clean.includes(".")) {
      if (clean.lastIndexOf(",") > clean.lastIndexOf(".")) {
        clean = clean.replace(/\./g, "").replace(",", ".");
      } else {
        clean = clean.replace(/,/g, "");
      }
    } else if (clean.includes(",")) {
      clean = clean.replace(",", ".");
    }

    if (!/^\d+(\.\d{1,2})?$/.test(clean)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Initial balance must have at most 2 decimal places",
      });
      return z.NEVER;
    }

    const num = parseFloat(clean);
    if (!Number.isFinite(num) || num < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Initial balance cannot be negative",
      });
      return z.NEVER;
    }

    return num;
  })
  .default(0);

/**
 * Esquema para cuentas estándar (Efectivo y Bancos).
 */
export const StandardAccountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Account name is required")
    .max(100, "Account name cannot exceed 100 characters"),
  account_type: z.enum(["cash", "bank"], {
    message: "Account type must be 'cash' or 'bank'",
  }),
  institution: z.string().trim().max(100).nullable().optional(),
  currency: z.string().trim().length(3).default("COP"),
  initial_balance: NonNegativeMoneySchema,
  color: z.string().trim().max(30).nullable().optional(),
  credit_limit: z.null().optional(),
  closing_day: z.null().optional(),
  payment_due_day: z.null().optional(),
});

/**
 * Esquema para tarjetas de crédito.
 */
export const CreditCardAccountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Card name is required")
    .max(100, "Card name cannot exceed 100 characters"),
  account_type: z.literal("credit_card"),
  institution: z.string().trim().max(100).nullable().optional(),
  currency: z.string().trim().length(3).default("COP"),
  initial_balance: NonNegativeMoneySchema,
  color: z.string().trim().max(30).nullable().optional(),
  credit_limit: PositiveMoneySchema,
  closing_day: DayOfMonthSchema,
  payment_due_day: DayOfMonthSchema,
});

/**
 * Esquema unificado para la creación de cuentas.
 */
export const CreateAccountSchema = z.discriminatedUnion("account_type", [
  StandardAccountSchema,
  CreditCardAccountSchema,
]);

export type CreateAccountInput = z.infer<typeof CreateAccountSchema>;

/**
 * Esquema para actualización de cuentas estándar (Efectivo y Bancos).
 */
export const UpdateStandardAccountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Account name is required")
    .max(100, "Account name cannot exceed 100 characters"),
  account_type: z.enum(["cash", "bank"], {
    message: "Account type must be 'cash' or 'bank'",
  }),
  institution: z.string().trim().max(100).nullable().optional(),
  currency: z.string().trim().length(3).default("COP"),
  initial_balance: NonNegativeMoneySchema.optional(),
  current_balance: NonNegativeMoneySchema.optional(),
  balance: NonNegativeMoneySchema.optional(),
  color: z.string().trim().max(30).nullable().optional(),
  is_active: z.boolean().optional(),
  credit_limit: z.null().optional(),
  closing_day: z.null().optional(),
  payment_due_day: z.null().optional(),
});

/**
 * Esquema para actualización de tarjetas de crédito.
 */
export const UpdateCreditCardAccountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Card name is required")
    .max(100, "Card name cannot exceed 100 characters"),
  account_type: z.literal("credit_card"),
  institution: z.string().trim().max(100).nullable().optional(),
  currency: z.string().trim().length(3).default("COP"),
  initial_balance: NonNegativeMoneySchema.optional(),
  current_balance: NonNegativeMoneySchema.optional(),
  balance: NonNegativeMoneySchema.optional(),
  color: z.string().trim().max(30).nullable().optional(),
  is_active: z.boolean().optional(),
  credit_limit: PositiveMoneySchema.optional(),
  closing_day: DayOfMonthSchema.optional(),
  payment_due_day: DayOfMonthSchema.optional(),
});

/**
 * Esquema unificado para edición y actualización de cuentas y tarjetas.
 */
export const UpdateAccountSchema = z.discriminatedUnion("account_type", [
  UpdateStandardAccountSchema,
  UpdateCreditCardAccountSchema,
]);

export type UpdateAccountInput = z.infer<typeof UpdateAccountSchema>;

/**
 * Esquema de validación para creación de categorías personalizadas.
 */
export const CreateCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre de la categoría es obligatorio")
    .max(100, "El nombre no puede exceder 100 caracteres"),
  category_type: z.enum(["income", "expense"], {
    message: "El tipo de categoría debe ser 'income' o 'expense'",
  }),
  icon: z.string().trim().max(50).nullable().optional(),
  color: z.string().trim().max(50).nullable().optional(),
  is_active: z.boolean().default(true),
});

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;

/**
 * Esquema de validación para actualización y edición de categorías.
 */
export const UpdateCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre de la categoría no puede estar vacío")
    .max(100, "El nombre no puede exceder 100 caracteres")
    .optional(),
  category_type: z
    .enum(["income", "expense"], {
      message: "El tipo de categoría debe ser 'income' o 'expense'",
    })
    .optional(),
  icon: z.string().trim().max(50).nullable().optional(),
  color: z.string().trim().max(50).nullable().optional(),
  is_active: z.boolean().optional(),
});

export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;

/**
 * Esquema para registro de Transacciones.
 * Permite seleccionar una categoría existente vía category_id o registrar una nueva al vuelo con new_category_name.
 */
export const CreateTransactionSchema = z
  .object({
    account_id: z.string().uuid("Invalid account UUID"),
    category_id: z.string().uuid("Invalid category UUID").nullable().optional(),
    new_category_name: z
      .string()
      .trim()
      .min(1, "El nombre de la categoría no puede estar vacío")
      .max(100, "El nombre de la categoría no puede exceder 100 caracteres")
      .nullable()
      .optional(),
    description: z
      .string()
      .trim()
      .min(1, "Description is required")
      .max(255, "Description cannot exceed 255 characters"),
    amount: PositiveMoneySchema,
    transaction_type: z.enum(["income", "expense"], {
      message: "Transaction type must be 'income' or 'expense'",
    }),
    transaction_date: CivilDateSchema,
    is_installment: z.boolean().default(false),
    installment_count: InstallmentCountSchema.default(1),
    notes: z.string().trim().max(1000, "Notes cannot exceed 1000 characters").nullable().optional(),
  })
  .superRefine((data, ctx) => {
    // Debe proveerse category_id o new_category_name
    if (!data.category_id && !data.new_category_name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["category_id"],
        message: "Debes seleccionar una categoría o ingresar el nombre de una nueva",
      });
    }

    // Si la transacción es de tipo ingreso, no puede tener cuotas
    if (data.transaction_type === "income" && data.installment_count > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["installment_count"],
        message: "Income transactions cannot have installments",
      });
    }

    // Regla de consistencia: is_installment debe ser coherente con installment_count > 1
    if (data.installment_count > 1 && !data.is_installment) {
      data.is_installment = true;
    }
  });

export type CreateTransactionInput = z.infer<typeof CreateTransactionSchema>;

/**
 * Esquema especializado para compras a cuotas en tarjeta de crédito.
 * Soporta asignación de category_id o creación al vuelo con new_category_name.
 */
export const CreateInstallmentPurchaseSchema = z
  .object({
    account_id: z.string().uuid("Invalid credit card account UUID"),
    category_id: z.string().uuid("Invalid category UUID").nullable().optional(),
    new_category_name: z
      .string()
      .trim()
      .min(1, "El nombre de la categoría no puede estar vacío")
      .max(100, "El nombre de la categoría no puede exceder 100 caracteres")
      .nullable()
      .optional(),
    description: z
      .string()
      .trim()
      .min(1, "Purchase description is required")
      .max(255, "Description cannot exceed 255 characters"),
    amount: PositiveMoneySchema,
    transaction_date: CivilDateSchema,
    installment_count: InstallmentCountSchema,
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.category_id && !data.new_category_name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["category_id"],
        message: "Debes seleccionar una categoría o ingresar el nombre de una nueva",
      });
    }
  });

export type CreateInstallmentPurchaseInput = z.infer<typeof CreateInstallmentPurchaseSchema>;

/**
 * Esquema de validación para parámetros de identificación UUID.
 */
export const UuidParamSchema = z.string().uuid("Formato de UUID inválido");

/**
 * Esquema para actualización y edición de transacciones existentes.
 */
export const UpdateTransactionSchema = z
  .object({
    description: z
      .string()
      .trim()
      .min(1, "Description is required")
      .max(255, "Description cannot exceed 255 characters")
      .optional(),
    amount: PositiveMoneySchema.optional(),
    transaction_type: z
      .enum(["income", "expense"], {
        message: "Transaction type must be 'income' or 'expense'",
      })
      .optional(),
    transaction_date: CivilDateSchema.optional(),
    category_id: z.string().uuid("Invalid category UUID").nullable().optional(),
    new_category_name: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .nullable()
      .optional(),
    account_id: z.string().uuid("Invalid account UUID").optional(),
    installment_count: InstallmentCountSchema.optional(),
    notes: z.string().trim().max(1000, "Notes cannot exceed 1000 characters").nullable().optional(),
    is_paid: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.transaction_type === "income" && data.installment_count && data.installment_count > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["installment_count"],
        message: "Income transactions cannot have installments",
      });
    }
  });

export type UpdateTransactionInput = z.infer<typeof UpdateTransactionSchema>;

/**
 * Esquema de validación para registrar el pago de un extracto de tarjeta de crédito.
 */
export const MarkExtractAsPaidSchema = z.object({
  statementMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "El mes del extracto debe tener el formato YYYY-MM (ej. 2026-04)"),
  creditCardAccountId: z.string().uuid("ID de tarjeta de crédito inválido"),
  paymentAccountId: z.string().uuid("ID de cuenta de pago inválido").optional().nullable(),
  amount: PositiveMoneySchema.optional(),
  categoryId: z.string().uuid("ID de categoría inválido").optional().nullable(),
  paymentDate: CivilDateSchema.optional(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export type MarkExtractAsPaidInput = z.infer<typeof MarkExtractAsPaidSchema>;


