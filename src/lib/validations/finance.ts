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
 * Validador de montos monetarios positivos con máximo 2 decimales.
 */
export const PositiveMoneySchema = z
  .union([
    z.number(),
    z.string().regex(/^\d+(\.\d{1,2})?$/, "Amount must have at most 2 decimal places"),
  ])
  .transform((val) => (typeof val === "string" ? parseFloat(val) : val))
  .refine((val) => Number.isFinite(val) && val > 0, {
    message: "Amount must be greater than zero",
  });

/**
 * Validador de balance inicial no negativo (>= 0).
 */
export const NonNegativeMoneySchema = z
  .union([
    z.number(),
    z.string().regex(/^\d+(\.\d{1,2})?$/, "Amount must have at most 2 decimal places"),
  ])
  .transform((val) => (typeof val === "string" ? parseFloat(val) : val))
  .refine((val) => Number.isFinite(val) && val >= 0, {
    message: "Initial balance cannot be negative",
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
  closing_day: z
    .number({ message: "Closing day is required for credit cards" })
    .int("Closing day must be an integer")
    .min(1, "Closing day must be between 1 and 31")
    .max(31, "Closing day must be between 1 and 31"),
  payment_due_day: z
    .number({ message: "Payment due day is required for credit cards" })
    .int("Payment due day must be an integer")
    .min(1, "Payment due day must be between 1 and 31")
    .max(31, "Payment due day must be between 1 and 31"),
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
 * Esquema para registro de Transacciones.
 */
export const CreateTransactionSchema = z
  .object({
    account_id: z.string().uuid("Invalid account UUID"),
    category_id: z.string().uuid("Invalid category UUID"),
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
    installment_count: z
      .number()
      .int("Installment count must be an integer")
      .min(1, "Installment count must be at least 1")
      .default(1),
    notes: z.string().trim().max(1000, "Notes cannot exceed 1000 characters").nullable().optional(),
  })
  .superRefine((data, ctx) => {
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
 */
export const CreateInstallmentPurchaseSchema = z.object({
  account_id: z.string().uuid("Invalid credit card account UUID"),
  category_id: z.string().uuid("Invalid category UUID"),
  description: z
    .string()
    .trim()
    .min(1, "Purchase description is required")
    .max(255, "Description cannot exceed 255 characters"),
  amount: PositiveMoneySchema,
  transaction_date: CivilDateSchema,
  installment_count: z
    .number()
    .int("Installment count must be an integer")
    .min(1, "Installment count must be at least 1"),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export type CreateInstallmentPurchaseInput = z.infer<typeof CreateInstallmentPurchaseSchema>;
