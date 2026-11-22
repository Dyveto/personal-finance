import { z } from "zod";
import {
  DayOfMonthSchema,
  NonNegativeMoneySchema,
  PositiveMoneySchema,
} from "./finance";

/**
 * Catálogo de modalidades de cobro de cuota de manejo en tarjetas de crédito.
 */
export const ManagementFeeTypeSchema = z.enum(
  ["fixed_monthly", "only_on_use", "exempt_if_used", "exempt"],
  {
    message: "Modalidad de cuota de manejo inválida",
  }
);

export type ManagementFeeType = z.infer<typeof ManagementFeeTypeSchema>;

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
  has_four_per_thousand: z.boolean().default(false),
  credit_limit: z.null().optional(),
  closing_day: z.null().optional(),
  payment_due_day: z.null().optional(),
  management_fee: z.null().optional(),
  management_fee_type: z.null().optional(),
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
  management_fee: NonNegativeMoneySchema.default(0),
  management_fee_type: ManagementFeeTypeSchema.default("exempt"),
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
  has_four_per_thousand: z.boolean().optional(),
  is_active: z.boolean().optional(),
  credit_limit: z.null().optional(),
  closing_day: z.null().optional(),
  payment_due_day: z.null().optional(),
  management_fee: z.null().optional(),
  management_fee_type: z.null().optional(),
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
  has_four_per_thousand: z.boolean().optional(),
  is_active: z.boolean().optional(),
  credit_limit: PositiveMoneySchema.optional(),
  closing_day: DayOfMonthSchema.optional(),
  payment_due_day: DayOfMonthSchema.optional(),
  management_fee: NonNegativeMoneySchema.optional(),
  management_fee_type: ManagementFeeTypeSchema.optional(),
});

/**
 * Esquema unificado para edición y actualización de cuentas y tarjetas.
 */
export const UpdateAccountSchema = z.discriminatedUnion("account_type", [
  UpdateStandardAccountSchema,
  UpdateCreditCardAccountSchema,
]);

export type UpdateAccountInput = z.infer<typeof UpdateAccountSchema>;
