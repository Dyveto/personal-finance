import { z } from "zod";
import {
  DayOfMonthSchema,
  NonNegativeMoneySchema,
  PositiveMoneySchema,
} from "./finance";

/**
 * Esquema para cuentas estándar (Efectivo y Bancos) al momento de creación.
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
 * Esquema para tarjetas de crédito al momento de creación.
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
 * Esquema unificado para creación de cuentas.
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
