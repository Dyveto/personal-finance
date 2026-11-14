import { describe, it, expect } from "vitest";
import {
  CreateAccountSchema,
  CreateTransactionSchema,
  CreateInstallmentPurchaseSchema,
} from "@/lib/validations/finance";

describe("Validation Schemas: finance.ts", () => {
  describe("CreateAccountSchema", () => {
    it("should accept valid cash and bank accounts", () => {
      const validCash = {
        name: "Efectivo Billetera",
        account_type: "cash" as const,
        initial_balance: 50000,
      };
      const parseResult = CreateAccountSchema.safeParse(validCash);
      expect(parseResult.success).toBe(true);
      if (parseResult.success) {
        expect(parseResult.data.name).toBe("Efectivo Billetera");
        expect(parseResult.data.currency).toBe("COP");
      }

      const validBank = {
        name: "Bancolombia Ahorros",
        account_type: "bank" as const,
        institution: "Bancolombia",
        initial_balance: "1500000.50",
      };
      const bankResult = CreateAccountSchema.safeParse(validBank);
      expect(bankResult.success).toBe(true);
    });

    it("should accept valid credit card with required credit rules", () => {
      const validCard = {
        name: "Visa Infinite",
        account_type: "credit_card" as const,
        institution: "Banco de Bogotá",
        credit_limit: 10000000,
        closing_day: 20,
        payment_due_day: 5,
        initial_balance: 0,
      };
      const result = CreateAccountSchema.safeParse(validCard);
      expect(result.success).toBe(true);
    });

    it("should reject credit card without closing_day or payment_due_day", () => {
      const missingClosingDay = {
        name: "Mastercard",
        account_type: "credit_card" as const,
        credit_limit: 5000000,
        payment_due_day: 10,
      };
      const result = CreateAccountSchema.safeParse(missingClosingDay);
      expect(result.success).toBe(false);
    });

    it("should reject closing_day or payment_due_day out of 1-31 range", () => {
      const invalidDay = {
        name: "Mastercard",
        account_type: "credit_card" as const,
        credit_limit: 5000000,
        closing_day: 0,
        payment_due_day: 35,
      };
      const result = CreateAccountSchema.safeParse(invalidDay);
      expect(result.success).toBe(false);
    });

    it("should reject negative initial balance or credit limit <= 0", () => {
      const negativeBalance = {
        name: "Efectivo",
        account_type: "cash" as const,
        initial_balance: -500,
      };
      expect(CreateAccountSchema.safeParse(negativeBalance).success).toBe(false);

      const zeroCreditLimit = {
        name: "Tarjeta",
        account_type: "credit_card" as const,
        credit_limit: 0,
        closing_day: 15,
        payment_due_day: 5,
      };
      expect(CreateAccountSchema.safeParse(zeroCreditLimit).success).toBe(false);
    });
  });

  describe("CreateTransactionSchema", () => {
    const validAccountId = "11111111-1111-4111-a111-111111111111";
    const validCategoryId = "22222222-2222-4222-a222-222222222222";

    it("should accept valid standard expense transaction", () => {
      const validExpense = {
        account_id: validAccountId,
        category_id: validCategoryId,
        description: "Almuerzo ejecutivo",
        amount: "25000.00",
        transaction_type: "expense" as const,
        transaction_date: "2026-11-14",
      };
      const result = CreateTransactionSchema.safeParse(validExpense);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amount).toBe(25000);
        expect(result.data.is_installment).toBe(false);
        expect(result.data.installment_count).toBe(1);
      }
    });

    it("should reject transaction with amount <= 0", () => {
      const zeroAmount = {
        account_id: validAccountId,
        category_id: validCategoryId,
        description: "Test",
        amount: 0,
        transaction_type: "expense" as const,
        transaction_date: "2026-11-14",
      };
      expect(CreateTransactionSchema.safeParse(zeroAmount).success).toBe(false);
    });

    it("should reject invalid UUIDs", () => {
      const invalidUuids = {
        account_id: "not-a-uuid",
        category_id: validCategoryId,
        description: "Test",
        amount: 10000,
        transaction_type: "expense" as const,
        transaction_date: "2026-11-14",
      };
      expect(CreateTransactionSchema.safeParse(invalidUuids).success).toBe(false);
    });

    it("should reject invalid civil date", () => {
      const invalidDate = {
        account_id: validAccountId,
        category_id: validCategoryId,
        description: "Test",
        amount: 10000,
        transaction_type: "expense" as const,
        transaction_date: "2026-02-30", // Feb 30 does not exist
      };
      expect(CreateTransactionSchema.safeParse(invalidDate).success).toBe(false);
    });

    it("should reject income transactions with installments > 1", () => {
      const invalidIncomeInstallment = {
        account_id: validAccountId,
        category_id: validCategoryId,
        description: "Salario en cuotas",
        amount: 5000000,
        transaction_type: "income" as const,
        transaction_date: "2026-11-14",
        installment_count: 3,
      };
      const result = CreateTransactionSchema.safeParse(invalidIncomeInstallment);
      expect(result.success).toBe(false);
    });

    it("should set is_installment = true when installment_count > 1", () => {
      const validInstallment = {
        account_id: validAccountId,
        category_id: validCategoryId,
        description: "Nevera nueva",
        amount: 2500000,
        transaction_type: "expense" as const,
        transaction_date: "2026-11-14",
        installment_count: 12,
      };
      const result = CreateTransactionSchema.safeParse(validInstallment);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_installment).toBe(true);
        expect(result.data.installment_count).toBe(12);
      }
    });
  });

  describe("CreateInstallmentPurchaseSchema", () => {
    it("should validate installment purchase correctly", () => {
      const purchase = {
        account_id: "11111111-1111-4111-a111-111111111111",
        category_id: "22222222-2222-4222-a222-222222222222",
        description: "Vuelo a Cartagena",
        amount: 800000,
        transaction_date: "2026-11-14",
        installment_count: 6,
      };
      const result = CreateInstallmentPurchaseSchema.safeParse(purchase);
      expect(result.success).toBe(true);
    });

    it("should reject non-integer or < 1 installment counts", () => {
      const invalid = {
        account_id: "11111111-1111-4111-a111-111111111111",
        category_id: "22222222-2222-4222-a222-222222222222",
        description: "Test",
        amount: 100000,
        transaction_date: "2026-11-14",
        installment_count: 0,
      };
      expect(CreateInstallmentPurchaseSchema.safeParse(invalid).success).toBe(false);
    });
  });
});
