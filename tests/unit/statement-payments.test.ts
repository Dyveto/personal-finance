import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculateStatementPaymentOptions,
  validateCustomPaymentAmount,
} from "@/lib/finance/statement-payments";
import {
  markExtractAsPaid,
  revertStatementPayment,
} from "@/features/credit-cards/actions/statement-actions";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Credit Card Statement Flexible Payments & Reversal", () => {
  const validCardId = "33333333-3333-4333-a333-333333333333";
  const validBankId = "22222222-2222-4222-a222-222222222222";
  const validStmtId = "55555555-5555-4555-a555-555555555555";
  const validTxId = "77777777-7777-4777-a777-777777777777";

  let mockFrom: ReturnType<typeof vi.fn>;
  let mockGetUser: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom = vi.fn();
    mockGetUser = vi.fn();
    (createClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      auth: { getUser: mockGetUser },
      from: mockFrom,
    });
  });

  describe("Domain: calculateStatementPaymentOptions", () => {
    it("should calculate minimum payment including fixed monthly management fee (e.g. Nu $12,000 COP)", () => {
      const result = calculateStatementPaymentOptions({
        periodInstallmentsTotal: 150000,
        totalCardDebt: 800000,
        managementFeeAmount: 12000,
        managementFeeType: "fixed_monthly",
        hasUsageInPeriod: true,
      });

      expect(result.minimumPayment).toBe("162000.00");
      expect(result.fullPayment).toBe("800000.00");
      expect(result.maxAllowedPayment).toBe("800000.00");
      expect(result.managementFeeApplied).toBe("12000.00");
      expect(result.managementFeeIncluded).toBe(true);
    });

    it("should calculate minimum payment with only_on_use fee when used vs when not used", () => {
      const withUsage = calculateStatementPaymentOptions({
        periodInstallmentsTotal: 200000,
        totalCardDebt: 500000,
        managementFeeAmount: 15000,
        managementFeeType: "only_on_use",
        hasUsageInPeriod: true,
      });
      expect(withUsage.minimumPayment).toBe("215000.00");
      expect(withUsage.managementFeeIncluded).toBe(true);

      const withoutUsage = calculateStatementPaymentOptions({
        periodInstallmentsTotal: 0,
        totalCardDebt: 0,
        managementFeeAmount: 15000,
        managementFeeType: "only_on_use",
        hasUsageInPeriod: false,
      });
      expect(withoutUsage.minimumPayment).toBe("0.00");
      expect(withoutUsage.managementFeeIncluded).toBe(false);
    });

    it("should not include fee if exempt", () => {
      const result = calculateStatementPaymentOptions({
        periodInstallmentsTotal: 300000,
        totalCardDebt: 600000,
        managementFeeAmount: 15000,
        managementFeeType: "exempt",
        hasUsageInPeriod: true,
      });
      expect(result.minimumPayment).toBe("300000.00");
      expect(result.managementFeeApplied).toBe("0.00");
      expect(result.managementFeeIncluded).toBe(false);
    });

    it("should cap minimum payment at total card debt if raw minimum exceeds debt", () => {
      const result = calculateStatementPaymentOptions({
        periodInstallmentsTotal: 100000,
        totalCardDebt: 80000, // Debt is less than installments + fee
        managementFeeAmount: 10000,
        managementFeeType: "fixed_monthly",
      });

      expect(result.minimumPayment).toBe("80000.00");
      expect(result.fullPayment).toBe("80000.00");
      expect(result.maxAllowedPayment).toBe("80000.00");
    });

    it("should return 0.00 for minimum when card has no debt", () => {
      const result = calculateStatementPaymentOptions({
        periodInstallmentsTotal: 0,
        totalCardDebt: 0,
        managementFeeAmount: 12000,
        managementFeeType: "fixed_monthly",
      });

      expect(result.minimumPayment).toBe("0.00");
      expect(result.fullPayment).toBe("0.00");
      expect(result.hasDebt).toBe(false);
    });
  });

  describe("Domain: validateCustomPaymentAmount", () => {
    it("should accept valid custom amount within [0.01, totalCardDebt]", () => {
      const check = validateCustomPaymentAmount(250000, 500000);
      expect(check.isValid).toBe(true);
      expect(check.normalizedAmount).toBe("250000.00");
    });

    it("should reject custom amount <= 0", () => {
      const checkZero = validateCustomPaymentAmount(0, 500000);
      expect(checkZero.isValid).toBe(false);
      expect(checkZero.error).toContain("mayor a 0 COP");

      const checkNeg = validateCustomPaymentAmount(-5000, 500000);
      expect(checkNeg.isValid).toBe(false);
    });

    it("should reject custom amount greater than total card debt", () => {
      const checkExcess = validateCustomPaymentAmount(600000, 500000);
      expect(checkExcess.isValid).toBe(false);
      expect(checkExcess.error).toContain("no puede superar la deuda total");
    });
  });

  describe("Server Action: markExtractAsPaid validation & debt capping", () => {
    it("should reject payment if amount exceeds credit card debt", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } }, error: null });

      const mockCard = {
        id: validCardId,
        user_id: "user-1",
        account_type: "credit_card",
        current_balance: 100000,
        is_active: true,
      };

      const mockBank = {
        id: validBankId,
        user_id: "user-1",
        account_type: "bank",
        current_balance: 500000,
        is_active: true,
      };

      mockFrom
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValueOnce({ data: mockCard, error: null }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValueOnce({ data: mockBank, error: null }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValueOnce({ data: [], error: null }),
            }),
          }),
        });

      const result = await markExtractAsPaid({
        statementMonth: "2026-04",
        creditCardAccountId: validCardId,
        paymentAccountId: validBankId,
        amount: 150000, // Exceeds 100,000 card debt
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("no puede superar la deuda total");
      }
    });

    it("should reject payment if origin account has insufficient funds", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } }, error: null });

      const mockCard = {
        id: validCardId,
        user_id: "user-1",
        account_type: "credit_card",
        current_balance: 500000,
        is_active: true,
      };

      const mockBank = {
        id: validBankId,
        user_id: "user-1",
        name: "Cuenta Ahorros",
        account_type: "bank",
        current_balance: 50000, // Only 50,000 available
        is_active: true,
      };

      mockFrom
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValueOnce({ data: mockCard, error: null }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValueOnce({ data: mockBank, error: null }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValueOnce({ data: [], error: null }),
            }),
          }),
        });

      const result = await markExtractAsPaid({
        statementMonth: "2026-04",
        creditCardAccountId: validCardId,
        paymentAccountId: validBankId,
        amount: 100000, // Needs 100,000 but only 50,000 in bank
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Saldo insuficiente");
      }
    });

    it("should calculate 4x1000 and debit base + GMF when paying card from taxed account (e.g. Nu)", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } }, error: null });

      const mockCard = {
        id: validCardId,
        user_id: "user-1",
        name: "Nu Tarjeta de Crédito",
        account_type: "credit_card",
        current_balance: 500000,
        is_active: true,
        closing_day: 15,
        payment_due_day: 5,
      };

      const mockBankNu = {
        id: validBankId,
        user_id: "user-1",
        name: "Cuenta de Ahorros Nu",
        account_type: "bank",
        current_balance: 300000, // Sufficient balance
        has_four_per_thousand: true, // Gravada con 4x1000!
        is_active: true,
      };

      let debitedAccountAmount = 0;
      let insertedTxAmount = 0;
      let insertedTxGmf = 0;

      mockFrom
        .mockReturnValueOnce({
          // 1. select card
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValueOnce({ data: mockCard, error: null }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          // 2. select bank account
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValueOnce({ data: mockBankNu, error: null }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          // 3. select card transactions
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValueOnce({ data: [], error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          // 4. upsert statement
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValueOnce({
                data: {
                  id: validStmtId,
                  statement_month: "2026-04",
                  account_id: validCardId,
                  total_amount: 100000,
                  paid_amount: 100000,
                  is_paid: true,
                },
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          // 5. update card balance
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValueOnce({ error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          // 6. update bank balance
          update: vi.fn().mockImplementation((payload: { current_balance: number }) => {
            debitedAccountAmount = 300000 - payload.current_balance;
            return {
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValueOnce({ error: null }),
              }),
            };
          }),
        })
        .mockReturnValueOnce({
          // 7. select category
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValueOnce({
                  data: [{ id: "cat-1", name: "Pagos Financieros" }],
                  error: null,
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          // 8. insert payment transaction with 4x1000
          insert: vi.fn().mockImplementation((payload: { amount: number; four_per_thousand_amount: number }) => {
            insertedTxAmount = payload.amount;
            insertedTxGmf = payload.four_per_thousand_amount;
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValueOnce({
                  data: { id: validTxId, amount: payload.amount },
                  error: null,
                }),
              }),
            };
          }),
        })
        .mockReturnValueOnce({
          // 9. link payment_transaction_id in statement
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValueOnce({ error: null }),
            }),
          }),
        });

      const result = await markExtractAsPaid({
        statementMonth: "2026-04",
        creditCardAccountId: validCardId,
        paymentAccountId: validBankId,
        amount: 100000, // Abono a tarjeta: 100.000 COP
      });

      expect(result.success).toBe(true);
      // Abono a la tarjeta es 100.000 COP
      if (result.success) {
        expect(result.data.amountPaid).toBe(100000);
      }
      // El 4x1000 de 100.000 es 400 COP
      expect(insertedTxGmf).toBe(400);
      // La transacción de egreso registra total: 100.400 COP
      expect(insertedTxAmount).toBe(100400);
      // El total debitado de la cuenta Nu es exactamente 100.400 COP
      expect(debitedAccountAmount).toBe(100400);
    });

    it("should reject payment if bank has enough for base payment but lacks funds for 4x1000", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } }, error: null });

      const mockCard = {
        id: validCardId,
        user_id: "user-1",
        account_type: "credit_card",
        current_balance: 500000,
        is_active: true,
      };

      const mockBankNu = {
        id: validBankId,
        user_id: "user-1",
        name: "Cuenta Nu",
        account_type: "bank",
        current_balance: 100200, // Has 100,200 (enough for 100,000 base, but NOT enough for 100,400 with 4x1000!)
        has_four_per_thousand: true,
        is_active: true,
      };

      mockFrom
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValueOnce({ data: mockCard, error: null }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValueOnce({ data: mockBankNu, error: null }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValueOnce({ data: [], error: null }),
            }),
          }),
        });

      const result = await markExtractAsPaid({
        statementMonth: "2026-04",
        creditCardAccountId: validCardId,
        paymentAccountId: validBankId,
        amount: 100000,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Saldo insuficiente");
        expect(result.error).toContain("4x1000");
      }
    });
  });

  describe("Server Action: revertStatementPayment", () => {
    it("should reject revertStatementPayment if statement is not found", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } }, error: null });

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValueOnce({ data: null, error: new Error("Not found") }),
            }),
          }),
        }),
      });

      const result = await revertStatementPayment({ statementId: validStmtId });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("no encontrado");
      }
    });

    it("should reject revertStatementPayment if statement is already unpaid", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } }, error: null });

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValueOnce({
                data: {
                  id: validStmtId,
                  is_paid: false,
                },
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await revertStatementPayment({ statementId: validStmtId });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("no figura como pagado");
      }
    });

    it("should successfully revert payment, reimburse origin account and restore card debt", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } }, error: null });

      const mockStatement = {
        id: validStmtId,
        user_id: "user-1",
        account_id: validCardId,
        statement_month: "2026-04",
        total_amount: 150000,
        paid_amount: 150000,
        is_paid: true,
        payment_account_id: validBankId,
        payment_transaction_id: validTxId,
      };

      const mockCard = {
        id: validCardId,
        user_id: "user-1",
        name: "Visa Platinum",
        current_balance: 200000, // Will be restored to 350,000
        closing_day: 15,
        payment_due_day: 5,
      };

      const mockBank = {
        id: validBankId,
        user_id: "user-1",
        name: "Cuenta Bancaria",
        current_balance: 500000, // Will be reimbursed to 650,000
      };

      const mockDeleteTx = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValueOnce({ error: null }),
        }),
      });

      const mockUpdateBank = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValueOnce({ error: null }),
        }),
      });

      const mockUpdateCard = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValueOnce({ error: null }),
        }),
      });

      const mockUpdateStmt = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValueOnce({
                data: { ...mockStatement, is_paid: false, paid_at: null, paid_amount: null },
                error: null,
              }),
            }),
          }),
        }),
      });

      mockFrom
        .mockReturnValueOnce({
          // 1. statement select
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValueOnce({ data: mockStatement, error: null }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          // 2. card select
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValueOnce({ data: mockCard, error: null }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          // 3a. select payment transaction to inspect amount with 4x1000
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValueOnce({
                  data: {
                    id: validTxId,
                    amount: 150000,
                    four_per_thousand_amount: 0,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          // 3b. delete payment transaction
          delete: mockDeleteTx,
        })
        .mockReturnValueOnce({
          // 4. select payment account to reimburse
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValueOnce({ data: mockBank, error: null }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          // 5. update payment account balance
          update: mockUpdateBank,
        })
        .mockReturnValueOnce({
          // 6. update card balance
          update: mockUpdateCard,
        })
        .mockReturnValueOnce({
          // 7. select card transactions to unmark
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValueOnce({ data: [], error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          // 8. update statement to unpaid
          update: mockUpdateStmt,
        });

      const result = await revertStatementPayment({ statementId: validStmtId });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.revertedAmount).toBe(150000);
        expect(result.data.restoredCardDebt).toBe(350000);
        expect(result.data.reimbursedAccountId).toBe(validBankId);
        expect(result.data.statement.is_paid).toBe(false);
      }
    });

    it("should reimburse full amount including 4x1000 when reverting a payment from a taxed account", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } }, error: null });

      const mockStatement = {
        id: validStmtId,
        user_id: "user-1",
        account_id: validCardId,
        statement_month: "2026-04",
        total_amount: 100000,
        paid_amount: 100000, // Card was paid 100,000
        is_paid: true,
        payment_account_id: validBankId,
        payment_transaction_id: validTxId,
      };

      const mockCard = {
        id: validCardId,
        user_id: "user-1",
        name: "Tarjeta Nu",
        current_balance: 0,
        closing_day: 15,
        payment_due_day: 5,
      };

      const mockBankNu = {
        id: validBankId,
        user_id: "user-1",
        name: "Cuenta Nu",
        current_balance: 500000,
        has_four_per_thousand: true,
      };

      let newBankBalance = 0;
      let newCardBalance = 0;

      mockFrom
        .mockReturnValueOnce({
          // 1. statement select
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValueOnce({ data: mockStatement, error: null }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          // 2. card select
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValueOnce({ data: mockCard, error: null }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          // 3a. select payment transaction (debited 100,400 with 4x1000!)
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValueOnce({
                  data: {
                    id: validTxId,
                    amount: 100400, // 100,000 base + 400 GMF
                    four_per_thousand_amount: 400,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          // 3b. delete payment transaction
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValueOnce({ error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          // 4. select payment account
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValueOnce({ data: mockBankNu, error: null }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          // 5. update payment account balance
          update: vi.fn().mockImplementation((payload: { current_balance: number }) => {
            newBankBalance = payload.current_balance;
            return {
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValueOnce({ error: null }),
              }),
            };
          }),
        })
        .mockReturnValueOnce({
          // 6. update card balance
          update: vi.fn().mockImplementation((payload: { current_balance: number }) => {
            newCardBalance = payload.current_balance;
            return {
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValueOnce({ error: null }),
              }),
            };
          }),
        })
        .mockReturnValueOnce({
          // 7. select card transactions to unmark
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValueOnce({ data: [], error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          // 8. update statement to unpaid
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValueOnce({
                    data: { ...mockStatement, is_paid: false },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        });

      const result = await revertStatementPayment({ statementId: validStmtId });

      expect(result.success).toBe(true);
      // Reembolsa a la cuenta bancaria exactamente 100.400 COP (500.000 + 100.400 = 600.400)
      expect(newBankBalance).toBe(600400);
      // Restaura a la tarjeta de crédito únicamente los 100.000 COP abonados (0 + 100.000 = 100.000)
      expect(newCardBalance).toBe(100000);
    });
  });
});
