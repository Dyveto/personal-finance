import { describe, it, expect } from "vitest";
import {
  CreateAccountSchema,
  CreateTransactionSchema,
  CreateInstallmentPurchaseSchema,
  CreateCategorySchema,
  UpdateCategorySchema,
  MarkExtractAsPaidSchema,
  UpdateTransactionSchema,
  UuidParamSchema,
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

    it("should accept valid Bancolombia credit card with closing_day and payment_due_day", () => {
      const bancolombiaCard = {
        name: "Mastercard Black Bancolombia",
        account_type: "credit_card" as const,
        institution: "Bancolombia",
        credit_limit: 15000000,
        closing_day: 15,
        payment_due_day: 5,
        initial_balance: 0,
      };
      const result = CreateAccountSchema.safeParse(bancolombiaCard);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.account_type).toBe("credit_card");
        if (result.data.account_type === "credit_card") {
          expect(result.data.closing_day).toBe(15);
          expect(result.data.payment_due_day).toBe(5);
          expect(result.data.credit_limit).toBe(15000000);
        }
      }
    });

    it("should accept string numeric closing_day and payment_due_day from forms", () => {
      const formInput = {
        name: "Visa Bancolombia",
        account_type: "credit_card" as const,
        institution: "Bancolombia",
        credit_limit: "5000000",
        closing_day: "20",
        payment_due_day: "10",
      };
      const result = CreateAccountSchema.safeParse(formInput);
      expect(result.success).toBe(true);
      if (result.success && result.data.account_type === "credit_card") {
        expect(result.data.closing_day).toBe(20);
        expect(result.data.payment_due_day).toBe(10);
        expect(result.data.credit_limit).toBe(5000000);
      }
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

    it("should accept D1 expense of 30800 COP with various money formats", () => {
      const d1Expense = {
        account_id: validAccountId,
        category_id: validCategoryId,
        description: "Compra D1 víveres",
        amount: 30800,
        transaction_type: "expense" as const,
        transaction_date: "2026-11-14",
      };
      const result = CreateTransactionSchema.safeParse(d1Expense);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amount).toBe(30800);
      }

      // Con formato string con decimales
      const d1String = {
        ...d1Expense,
        amount: "30800.00",
      };
      const resString = CreateTransactionSchema.safeParse(d1String);
      expect(resString.success).toBe(true);
      if (resString.success) {
        expect(resString.data.amount).toBe(30800);
      }

      // Con formato con coma decimal
      const d1Comma = {
        ...d1Expense,
        amount: "30800,50",
      };
      const resComma = CreateTransactionSchema.safeParse(d1Comma);
      expect(resComma.success).toBe(true);
      if (resComma.success) {
        expect(resComma.data.amount).toBe(30800.5);
      }
    });

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

  describe("MarkExtractAsPaidSchema", () => {
    const validCardId = "11111111-1111-4111-a111-111111111111";
    const validBankId = "22222222-2222-4222-a222-222222222222";

    it("should accept valid statement payment inputs with month format YYYY-MM", () => {
      const input = {
        statementMonth: "2026-04",
        creditCardAccountId: validCardId,
        paymentAccountId: validBankId,
        amount: 450000,
      };
      const result = MarkExtractAsPaidSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.statementMonth).toBe("2026-04");
        expect(result.data.amount).toBe(450000);
      }
    });

    it("should accept statement payment without payment account and without explicit amount", () => {
      const minimal = {
        statementMonth: "2026-05",
        creditCardAccountId: validCardId,
      };
      const result = MarkExtractAsPaidSchema.safeParse(minimal);
      expect(result.success).toBe(true);
    });

    it("should reject invalid statementMonth formats", () => {
      expect(
        MarkExtractAsPaidSchema.safeParse({
          statementMonth: "2026-4", // Must be 2 digits
          creditCardAccountId: validCardId,
        }).success
      ).toBe(false);

      expect(
        MarkExtractAsPaidSchema.safeParse({
          statementMonth: "April-2026",
          creditCardAccountId: validCardId,
        }).success
      ).toBe(false);
    });

    it("should reject invalid UUIDs or negative amount", () => {
      expect(
        MarkExtractAsPaidSchema.safeParse({
          statementMonth: "2026-04",
          creditCardAccountId: "invalid-uuid",
        }).success
      ).toBe(false);

      expect(
        MarkExtractAsPaidSchema.safeParse({
          statementMonth: "2026-04",
          creditCardAccountId: validCardId,
          amount: -100,
        }).success
      ).toBe(false);
    });
  });

  describe("UpdateTransactionSchema & UuidParamSchema", () => {
    const validUuid = "11111111-1111-4111-a111-111111111111";

    it("should accept valid UUIDs and reject invalid ones", () => {
      expect(UuidParamSchema.safeParse(validUuid).success).toBe(true);
      expect(UuidParamSchema.safeParse("not-a-uuid").success).toBe(false);
      expect(UuidParamSchema.safeParse("").success).toBe(false);
    });

    it("should accept partial updates for transactions", () => {
      const partialUpdate = {
        description: "Mercado D1 Actualizado",
        amount: 85000,
      };
      const result = UpdateTransactionSchema.safeParse(partialUpdate);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBe("Mercado D1 Actualizado");
        expect(result.data.amount).toBe(85000);
      }
    });

    it("should reject income transactions with installment count > 1", () => {
      const invalidIncome = {
        transaction_type: "income" as const,
        installment_count: 3,
      };
      const result = UpdateTransactionSchema.safeParse(invalidIncome);
      expect(result.success).toBe(false);
    });

    it("should accept updating payment status (is_paid)", () => {
      const statusUpdate = {
        is_paid: true,
      };
      const result = UpdateTransactionSchema.safeParse(statusUpdate);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_paid).toBe(true);
      }
    });
  });

  describe("CreateCategorySchema & UpdateCategorySchema", () => {
    it("should accept valid income and expense category inputs", () => {
      const validExpense = {
        name: "Cine y Teatro",
        category_type: "expense" as const,
        icon: "film",
        color: "#EC4899",
      };
      const expenseRes = CreateCategorySchema.safeParse(validExpense);
      expect(expenseRes.success).toBe(true);
      if (expenseRes.success) {
        expect(expenseRes.data.name).toBe("Cine y Teatro");
        expect(expenseRes.data.category_type).toBe("expense");
        expect(expenseRes.data.is_active).toBe(true);
      }

      const validIncome = {
        name: "Dividendos",
        category_type: "income" as const,
      };
      const incomeRes = CreateCategorySchema.safeParse(validIncome);
      expect(incomeRes.success).toBe(true);
    });

    it("should reject invalid category inputs", () => {
      const emptyName = {
        name: "   ",
        category_type: "expense" as const,
      };
      expect(CreateCategorySchema.safeParse(emptyName).success).toBe(false);

      const invalidType = {
        name: "Test",
        category_type: "investment",
      };
      expect(CreateCategorySchema.safeParse(invalidType).success).toBe(false);
    });

    it("should accept valid updates to category", () => {
      const update = {
        name: "Cine, Streaming y Teatro",
        icon: "tv",
        is_active: false,
      };
      const res = UpdateCategorySchema.safeParse(update);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.name).toBe("Cine, Streaming y Teatro");
        expect(res.data.is_active).toBe(false);
      }
    });
  });

  describe("On-the-fly Category creation in transactions", () => {
    const validAccountId = "11111111-1111-4111-a111-111111111111";

    it("should accept transaction with new_category_name instead of category_id", () => {
      const onTheFlyTx = {
        account_id: validAccountId,
        new_category_name: "Veterinaria y Mascotas",
        description: "Vacunas perro",
        amount: 85000,
        transaction_type: "expense" as const,
        transaction_date: "2026-11-14",
      };
      const res = CreateTransactionSchema.safeParse(onTheFlyTx);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.new_category_name).toBe("Veterinaria y Mascotas");
      }
    });

    it("should accept installment purchase with new_category_name instead of category_id", () => {
      const onTheFlyPurchase = {
        account_id: validAccountId,
        new_category_name: "Electrónica y Gadgets",
        description: "Audífonos Sony",
        amount: 350000,
        transaction_date: "2026-11-14",
        installment_count: 6,
      };
      const res = CreateInstallmentPurchaseSchema.safeParse(onTheFlyPurchase);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.new_category_name).toBe("Electrónica y Gadgets");
      }
    });

    it("should reject transaction when neither category_id nor new_category_name is provided", () => {
      const missingCatTx = {
        account_id: validAccountId,
        description: "Sin categoría",
        amount: 15000,
        transaction_type: "expense" as const,
        transaction_date: "2026-11-14",
      };
      const res = CreateTransactionSchema.safeParse(missingCatTx);
      expect(res.success).toBe(false);
    });
  });
});
