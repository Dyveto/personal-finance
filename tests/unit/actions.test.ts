import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock Supabase server client
const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  }),
}));

import {
  createAccount,
  listAccounts,
  updateAccount,
  deleteAccount,
} from "@/features/accounts/actions/account-actions";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  cleanUnusedDefaultCategories,
  getCategoryUsageCounts,
} from "@/features/categories/actions/category-actions";
import {
  createTransaction,
  createInstallmentPurchase,
  updateTransaction,
  deleteTransaction,
} from "@/features/transactions/actions/transaction-actions";
import { markExtractAsPaid } from "@/features/credit-cards/actions/statement-actions";
import {
  getDashboardLayout,
  saveDashboardLayout,
  resetDashboardLayout,
} from "@/features/dashboard/actions/dashboard-actions";
import { DEFAULT_DASHBOARD_LAYOUT } from "@/lib/validations/finance";

describe("Server Actions: account-actions.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockReset();
    mockFrom.mockReset();
  });

  it("should reject listAccounts if user is not authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("No session") });

    const result = await listAccounts();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Unauthorized");
    }
  });

  it("should reject createAccount if validation fails", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } }, error: null });

    const invalidInput = {
      name: "", // empty name
      account_type: "cash",
    };

    const result = await createAccount(invalidInput);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Validation failed");
      expect(result.validationErrors).toBeDefined();
    }
  });

  it("should create a cash account successfully for authenticated user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } }, error: null });

    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValueOnce({
          data: {
            id: "account-1",
            user_id: "user-123",
            name: "Billetera",
            account_type: "cash",
            current_balance: 50000,
          },
          error: null,
        }),
      }),
    });

    mockFrom.mockReturnValueOnce({ insert: mockInsert });

    const result = await createAccount({
      name: "Billetera",
      account_type: "cash",
      initial_balance: 50000,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Billetera");
      expect(result.data.user_id).toBe("user-123");
    }
  });

  it("should reject updateAccount if user is not authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("No session") });

    const result = await updateAccount("11111111-1111-4111-a111-111111111111", {
      name: "Cuenta Actualizada",
      account_type: "bank",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Unauthorized");
    }
  });

  it("should reject updateAccount with invalid accountId UUID", async () => {
    const result = await updateAccount("invalid-uuid", {
      name: "Cuenta",
      account_type: "cash",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("inválido");
    }
  });

  it("should reject updateAccount when validation fails", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } }, error: null });

    const result = await updateAccount("11111111-1111-4111-a111-111111111111", {
      name: "",
      account_type: "invalid_type",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Validation failed");
    }
  });

  it("should update a credit card account successfully with closing and payment days", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } }, error: null });

    const mockSingle = vi.fn().mockResolvedValueOnce({
      data: {
        id: "11111111-1111-4111-a111-111111111111",
        user_id: "user-123",
        name: "Bancolombia Black Editada",
        account_type: "credit_card",
        credit_limit: 8000000,
        closing_day: 15,
        payment_due_day: 5,
        current_balance: 120000,
      },
      error: null,
    });

    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEqUser = vi.fn().mockReturnValue({ select: mockSelect });
    const mockEqId = vi.fn().mockReturnValue({ eq: mockEqUser });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqId });

    mockFrom.mockReturnValueOnce({ update: mockUpdate });

    const result = await updateAccount("11111111-1111-4111-a111-111111111111", {
      name: "Bancolombia Black Editada",
      account_type: "credit_card",
      credit_limit: 8000000,
      closing_day: 15,
      payment_due_day: 5,
      current_balance: 120000,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Bancolombia Black Editada");
      expect(result.data.closing_day).toBe(15);
      expect(result.data.payment_due_day).toBe(5);
      expect(result.data.credit_limit).toBe(8000000);
    }
  });
});

describe("Server Actions: transaction-actions.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockReset();
    mockFrom.mockReset();
  });

  const validAccountId = "11111111-1111-4111-a111-111111111111";
  const validCategoryId = "22222222-2222-4222-a222-222222222222";

  it("should reject income registered against a credit card", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } }, error: null });

    // Mock account query returning credit_card
    const mockSelectAccount = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValueOnce({
            data: { id: validAccountId, account_type: "credit_card", current_balance: 100000, is_active: true },
            error: null,
          }),
        }),
      }),
    });

    mockFrom.mockReturnValueOnce({ select: mockSelectAccount });

    const result = await createTransaction({
      account_id: validAccountId,
      category_id: validCategoryId,
      description: "Pago recibido",
      amount: 50000,
      transaction_type: "income",
      transaction_date: "2026-11-14",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Income transactions cannot be registered against a credit card");
    }
  });

  it("should reject transaction if category does not belong to user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } }, error: null });

    // Mock account query success (bank)
    const mockSelectAccount = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValueOnce({
            data: { id: validAccountId, account_type: "bank", current_balance: 500000, is_active: true },
            error: null,
          }),
        }),
      }),
    });

    // Mock category query returning null
    const mockSelectCategory = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValueOnce({
            data: null,
            error: new Error("Not found"),
          }),
        }),
      }),
    });

    mockFrom
      .mockReturnValueOnce({ select: mockSelectAccount })
      .mockReturnValueOnce({ select: mockSelectCategory });

    const result = await createTransaction({
      account_id: validAccountId,
      category_id: validCategoryId,
      description: "Compra",
      amount: 30000,
      transaction_type: "expense",
      transaction_date: "2026-11-14",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("selected category does not exist or access is denied");
    }
  });

  it("should create installment purchase with exact split calculation", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } }, error: null });

    // Mock credit card account query
    const mockSelectAccount = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValueOnce({
            data: {
              id: validAccountId,
              account_type: "credit_card",
              current_balance: 0,
              credit_limit: 5000000,
              is_active: true,
            },
            error: null,
          }),
        }),
      }),
    });

    // Mock category query
    const mockSelectCategory = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValueOnce({
            data: { id: validCategoryId, category_type: "expense" },
            error: null,
          }),
        }),
      }),
    });

    // Mock insert transaction
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValueOnce({
          data: {
            id: "tx-inst-1",
            user_id: "user-123",
            account_id: validAccountId,
            category_id: validCategoryId,
            amount: 100000,
            is_installment: true,
            installment_count: 3,
          },
          error: null,
        }),
      }),
    });

    // Mock update balance
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValueOnce({ error: null }),
      }),
    });

    mockFrom
      .mockReturnValueOnce({ select: mockSelectAccount })
      .mockReturnValueOnce({ select: mockSelectCategory })
      .mockReturnValueOnce({ insert: mockInsert })
      .mockReturnValueOnce({ update: mockUpdate });

    const result = await createInstallmentPurchase({
      account_id: validAccountId,
      category_id: validCategoryId,
      description: "Electrodoméstico",
      amount: 100000,
      transaction_date: "2026-11-14",
      installment_count: 3,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.installments).toEqual(["33333.34", "33333.33", "33333.33"]);
      expect(result.data.transaction.is_installment).toBe(true);
      expect(result.data.transaction.installment_count).toBe(3);
    }
  });
});

describe("Server Actions: statement-actions.ts (markExtractAsPaid)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockReset();
    mockFrom.mockReset();
  });

  const validCardId = "11111111-1111-4111-a111-111111111111";
  const validBankId = "22222222-2222-4222-a222-222222222222";

  it("should reject markExtractAsPaid if user is not authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("No session") });

    const result = await markExtractAsPaid("2026-04", validCardId);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Unauthorized");
    }
  });

  it("should reject markExtractAsPaid when validation fails", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } }, error: null });

    const result = await markExtractAsPaid("invalid-month", validCardId);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Validation failed");
    }
  });

  it("should reject if account is not a credit card", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } }, error: null });

    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValueOnce({
              data: { id: validCardId, account_type: "bank", is_active: true },
              error: null,
            }),
          }),
        }),
      }),
    });

    const result = await markExtractAsPaid("2026-04", validCardId);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("not a credit card");
    }
  });

  it("should successfully mark statement as paid, update transactions and reduce credit card debt", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } }, error: null });

    // 1. Mock credit card account query
    const mockCard = {
      id: validCardId,
      user_id: "user-123",
      name: "Visa Platinum",
      account_type: "credit_card",
      current_balance: 500000,
      closing_day: 15,
      payment_due_day: 5,
      is_active: true,
    };

    const mockSelectCard = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValueOnce({ data: mockCard, error: null }),
        }),
      }),
    });

    // 2. Mock transactions query
    const mockTx = [
      {
        id: "tx-1",
        account_id: validCardId,
        user_id: "user-123",
        amount: 200000,
        transaction_date: "2026-04-10",
        is_installment: false,
        installment_count: 1,
        is_paid: false,
      },
    ];

    const mockSelectTx = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValueOnce({ data: mockTx, error: null }),
      }),
    });

    // 3. Mock transactions update (marking as paid)
    const mockUpdateTx = vi.fn().mockReturnValue({
      in: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValueOnce({ error: null }),
      }),
    });

    // 4. Mock credit_card_statements upsert
    const mockUpsertStmt = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValueOnce({
          data: {
            id: "stmt-1",
            user_id: "user-123",
            account_id: validCardId,
            statement_month: "2026-04",
            total_amount: 200000,
            is_paid: true,
          },
          error: null,
        }),
      }),
    });

    // 5. Mock credit card balance update
    const mockUpdateCardBal = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValueOnce({ error: null }),
      }),
    });

    mockFrom
      .mockReturnValueOnce({ select: mockSelectCard })
      .mockReturnValueOnce({ select: mockSelectTx })
      .mockReturnValueOnce({ update: mockUpdateTx })
      .mockReturnValueOnce({ upsert: mockUpsertStmt })
      .mockReturnValueOnce({ update: mockUpdateCardBal });

    const result = await markExtractAsPaid("2026-04", validCardId);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amountPaid).toBe(200000);
      expect(result.data.updatedTransactionsCount).toBe(1);
      expect(result.data.statement.is_paid).toBe(true);
    }
  });

  it("should debit payment account and insert outgoing transaction when paymentAccountId is provided", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } }, error: null });

    const mockCard = {
      id: validCardId,
      user_id: "user-123",
      name: "Mastercard Black",
      account_type: "credit_card",
      current_balance: 300000,
      closing_day: 15,
      payment_due_day: 5,
      is_active: true,
    };

    const mockBank = {
      id: validBankId,
      user_id: "user-123",
      name: "Bancolombia Ahorros",
      account_type: "bank",
      current_balance: 1000000,
      is_active: true,
    };

    // 1. Mock credit card select
    const mockSelectCard = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValueOnce({ data: mockCard, error: null }),
        }),
      }),
    });

    // 2. Mock payment bank account select
    const mockSelectBank = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValueOnce({ data: mockBank, error: null }),
        }),
      }),
    });

    // 3. Mock transactions query on credit card
    const mockSelectTx = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValueOnce({
          data: [
            {
              id: "tx-2",
              account_id: validCardId,
              user_id: "user-123",
              amount: 150000,
              transaction_date: "2026-04-10",
              is_installment: false,
              installment_count: 1,
              is_paid: false,
            },
          ],
          error: null,
        }),
      }),
    });

    // 4. Mock transactions update (marking as paid)
    const mockUpdateTx = vi.fn().mockReturnValue({
      in: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValueOnce({ error: null }),
      }),
    });

    // 5. Mock credit_card_statements upsert
    const mockUpsertStmt = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValueOnce({
          data: {
            id: "stmt-2",
            user_id: "user-123",
            account_id: validCardId,
            statement_month: "2026-04",
            total_amount: 150000,
            is_paid: true,
          },
          error: null,
        }),
      }),
    });

    // 6. Mock credit card debt update
    const mockUpdateCardBal = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValueOnce({ error: null }),
      }),
    });

    // 7. Mock payment account balance update
    const mockUpdateBankBal = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValueOnce({ error: null }),
      }),
    });

    // 8. Mock categories query for payment expense
    const mockSelectCat = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValueOnce({
            data: [{ id: "cat-other", name: "Other expenses" }],
            error: null,
          }),
        }),
      }),
    });

    // 9. Mock insert outgoing payment transaction
    const mockInsertTx = vi.fn().mockResolvedValueOnce({ error: null });

    mockFrom
      .mockReturnValueOnce({ select: mockSelectCard })
      .mockReturnValueOnce({ select: mockSelectBank })
      .mockReturnValueOnce({ select: mockSelectTx })
      .mockReturnValueOnce({ update: mockUpdateTx })
      .mockReturnValueOnce({ upsert: mockUpsertStmt })
      .mockReturnValueOnce({ update: mockUpdateCardBal })
      .mockReturnValueOnce({ update: mockUpdateBankBal })
      .mockReturnValueOnce({ select: mockSelectCat })
      .mockReturnValueOnce({ insert: mockInsertTx });

    const result = await markExtractAsPaid("2026-04", validCardId, validBankId);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amountPaid).toBe(150000);
      expect(result.data.paymentAccountId).toBe(validBankId);
      expect(result.data.statement.is_paid).toBe(true);
    }
  });

  describe("deleteAccount", () => {
    const validAccountId = "11111111-1111-4111-a111-111111111111";

    it("should reject deleteAccount if user is not authenticated", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("No session") });

      const result = await deleteAccount(validAccountId);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Unauthorized");
      }
    });

    it("should reject deleteAccount if accountId is not a valid UUID", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } }, error: null });

      const result = await deleteAccount("not-a-valid-uuid");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("UUID");
      }
    });

    it("should reject deleteAccount if account is not found", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } }, error: null });

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValueOnce({ data: null, error: new Error("Not found") }),
          }),
        }),
      });

      mockFrom.mockReturnValueOnce({ select: mockSelect });

      const result = await deleteAccount(validAccountId);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("not found");
      }
    });

    it("should delete account successfully when found and owned", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } }, error: null });

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValueOnce({
              data: { id: validAccountId, name: "Billetera", account_type: "cash" },
              error: null,
            }),
          }),
        }),
      });

      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValueOnce({ error: null }),
        }),
      });

      mockFrom
        .mockReturnValueOnce({ select: mockSelect })
        .mockReturnValueOnce({ delete: mockDelete });

      const result = await deleteAccount(validAccountId);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(validAccountId);
      }
    });
  });

  describe("deleteTransaction & updateTransaction", () => {
    const validTxId = "22222222-2222-4222-a222-222222222222";
    const validAccountId = "11111111-1111-4111-a111-111111111111";

    it("should reject deleteTransaction if user is not authenticated", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("No session") });

      const result = await deleteTransaction(validTxId);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Unauthorized");
      }
    });

    it("should reject deleteTransaction if transactionId is invalid UUID", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } }, error: null });

      const result = await deleteTransaction("bad-id");
      expect(result.success).toBe(false);
    });

    it("should delete an expense transaction on a bank account and restore balance (+amount)", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } }, error: null });

      // 1. Fetch transaction (expense of 50,000)
      const mockSelectTx = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValueOnce({
              data: {
                id: validTxId,
                account_id: validAccountId,
                amount: 50000,
                transaction_type: "expense",
                is_paid: false,
              },
              error: null,
            }),
          }),
        }),
      });

      // 2. Fetch account (bank with 100,000 current_balance)
      const mockSelectAcc = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValueOnce({
              data: {
                id: validAccountId,
                account_type: "bank",
                current_balance: 100000,
              },
              error: null,
            }),
          }),
        }),
      });

      // 3. Delete transaction
      const mockDeleteTx = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValueOnce({ error: null }),
        }),
      });

      // 4. Update account balance (restores 50,000 -> new balance 150,000)
      let updatedBalance: number | undefined;
      const mockUpdateAcc = vi.fn().mockImplementation((payload: { current_balance?: number }) => {
        updatedBalance = payload.current_balance;
        return {
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValueOnce({ error: null }),
          }),
        };
      });

      mockFrom
        .mockReturnValueOnce({ select: mockSelectTx })
        .mockReturnValueOnce({ select: mockSelectAcc })
        .mockReturnValueOnce({ delete: mockDeleteTx })
        .mockReturnValueOnce({ update: mockUpdateAcc });

      const result = await deleteTransaction(validTxId);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(validTxId);
        expect(result.data.accountId).toBe(validAccountId);
        expect(updatedBalance).toBe(150000);
      }
    });

    it("should delete an expense on credit card and reduce card debt (-amount)", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } }, error: null });

      const mockSelectTx = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValueOnce({
              data: {
                id: validTxId,
                account_id: validAccountId,
                amount: 30000,
                transaction_type: "expense",
                is_paid: false,
              },
              error: null,
            }),
          }),
        }),
      });

      const mockSelectAcc = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValueOnce({
              data: {
                id: validAccountId,
                account_type: "credit_card",
                current_balance: 100000,
              },
              error: null,
            }),
          }),
        }),
      });

      const mockDeleteTx = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValueOnce({ error: null }),
        }),
      });

      let updatedBalance: number | undefined;
      const mockUpdateAcc = vi.fn().mockImplementation((payload: { current_balance?: number }) => {
        updatedBalance = payload.current_balance;
        return {
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValueOnce({ error: null }),
          }),
        };
      });

      mockFrom
        .mockReturnValueOnce({ select: mockSelectTx })
        .mockReturnValueOnce({ select: mockSelectAcc })
        .mockReturnValueOnce({ delete: mockDeleteTx })
        .mockReturnValueOnce({ update: mockUpdateAcc });

      const result = await deleteTransaction(validTxId);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(updatedBalance).toBe(70000); // 100,000 - 30,000
      }
    });

    it("should update transaction amount and recalculate bank balance accurately", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } }, error: null });

      // 1. Existing tx (expense 20,000)
      const mockSelectTx = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValueOnce({
              data: {
                id: validTxId,
                account_id: validAccountId,
                category_id: "cat-1",
                amount: 20000,
                transaction_type: "expense",
                is_paid: false,
              },
              error: null,
            }),
          }),
        }),
      });

      // 2. Update tx (amount changed to 35,000)
      const mockUpdateTx = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValueOnce({
                data: {
                  id: validTxId,
                  account_id: validAccountId,
                  amount: 35000,
                  transaction_type: "expense",
                  is_paid: false,
                },
                error: null,
              }),
            }),
          }),
        }),
      });

      // 3. Select account (bank with 80,000 current_balance)
      const mockSelectAcc = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValueOnce({
              data: {
                id: validAccountId,
                account_type: "bank",
                current_balance: 80000,
              },
              error: null,
            }),
          }),
        }),
      });

      // 4. Update account balance (80,000 + 20,000 - 35,000 = 65,000)
      let updatedBalance: number | undefined;
      const mockUpdateAcc = vi.fn().mockImplementation((payload: { current_balance?: number }) => {
        updatedBalance = payload.current_balance;
        return {
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValueOnce({ error: null }),
          }),
        };
      });

      mockFrom
        .mockReturnValueOnce({ select: mockSelectTx })
        .mockReturnValueOnce({ update: mockUpdateTx })
        .mockReturnValueOnce({ select: mockSelectAcc })
        .mockReturnValueOnce({ update: mockUpdateAcc });

      const result = await updateTransaction(validTxId, {
        amount: 35000,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amount).toBe(35000);
        expect(updatedBalance).toBe(65000);
      }
    });
  });

  describe("Server Actions: category-actions.ts", () => {
    const validUserId = "00000000-0000-4000-a000-000000000000";
    const validCatId = "22222222-2222-4222-a222-222222222222";

    it("should reject createCategory if unauthenticated", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("No session") });

      const result = await createCategory({
        name: "Restaurantes",
        category_type: "expense",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Unauthorized");
      }
    });

    it("should successfully create a new custom category", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: validUserId } },
        error: null,
      });

      // 1. Search for existing category (returns none)
      const mockSelectSearch = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValueOnce({ data: null, error: null }),
            }),
          }),
        }),
      });

      // 2. Insert new category
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValueOnce({
            data: {
              id: validCatId,
              user_id: validUserId,
              name: "Cine y Teatro",
              category_type: "expense",
              icon: "film",
              color: "#EC4899",
              is_default: false,
              is_active: true,
              created_at: "2026-11-14T00:00:00Z",
              updated_at: "2026-11-14T00:00:00Z",
            },
            error: null,
          }),
        }),
      });

      mockFrom
        .mockReturnValueOnce({ select: mockSelectSearch })
        .mockReturnValueOnce({ insert: mockInsert });

      const result = await createCategory({
        name: "Cine y Teatro",
        category_type: "expense",
        icon: "film",
        color: "#EC4899",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Cine y Teatro");
        expect(result.data.category_type).toBe("expense");
      }
    });

    it("should reject createCategory if name already exists and is active", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: validUserId } },
        error: null,
      });

      const mockSelectSearch = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValueOnce({
                data: { id: validCatId, is_active: true },
                error: null,
              }),
            }),
          }),
        }),
      });

      mockFrom.mockReturnValueOnce({ select: mockSelectSearch });

      const result = await createCategory({
        name: "Alimentación",
        category_type: "expense",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Ya tienes una categoría registrada");
      }
    });

    it("should update a category successfully", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: validUserId } },
        error: null,
      });

      // 1. Existing category
      const mockSelectExisting = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValueOnce({
              data: {
                id: validCatId,
                name: "Cine",
                category_type: "expense",
              },
              error: null,
            }),
          }),
        }),
      });

      // 2. Collision check
      const mockSelectCollision = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          neq: vi.fn().mockReturnValue({
            ilike: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValueOnce({ data: null, error: null }),
              }),
            }),
          }),
        }),
      });

      // 3. Update query
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValueOnce({
                data: {
                  id: validCatId,
                  name: "Cine y Series",
                  category_type: "expense",
                  icon: "tv",
                },
                error: null,
              }),
            }),
          }),
        }),
      });

      mockFrom
        .mockReturnValueOnce({ select: mockSelectExisting })
        .mockReturnValueOnce({ select: mockSelectCollision })
        .mockReturnValueOnce({ update: mockUpdate });

      const result = await updateCategory(validCatId, {
        name: "Cine y Series",
        icon: "tv",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Cine y Series");
      }
    });

    it("should safely delete a category with no transactions", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: validUserId } },
        error: null,
      });

      // 1. Select existing
      const mockSelectExisting = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValueOnce({
              data: { id: validCatId, name: "Prueba" },
              error: null,
            }),
          }),
        }),
      });

      // 2. Count referencing transactions (0)
      const mockSelectTxCount = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValueOnce({
            count: 0,
            error: null,
          }),
        }),
      });

      // 3. Delete
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValueOnce({ error: null }),
        }),
      });

      mockFrom
        .mockReturnValueOnce({ select: mockSelectExisting })
        .mockReturnValueOnce({ select: mockSelectTxCount })
        .mockReturnValueOnce({ delete: mockDelete });

      const result = await deleteCategory(validCatId);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.deleted).toBe(true);
      }
    });

    it("should reject deleteCategory with integrity check error if category has associated transactions", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: validUserId } },
        error: null,
      });

      // 1. Select existing
      const mockSelectExisting = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValueOnce({
              data: { id: validCatId, name: "Alimentación" },
              error: null,
            }),
          }),
        }),
      });

      // 2. Count referencing transactions (5)
      const mockSelectTxCount = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValueOnce({
          count: 5,
          error: null,
        }),
      });

      mockFrom
        .mockReturnValueOnce({ select: mockSelectExisting })
        .mockReturnValueOnce({ select: mockSelectTxCount });

      const result = await deleteCategory(validCatId);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(
          "No se puede eliminar esta categoría porque tiene transacciones asociadas. Reasigna o elimina las transacciones primero."
        );
      }
    });

    it("should handle cleanUnusedDefaultCategories when user is not authenticated", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: new Error("Unauthorized"),
      });

      const result = await cleanUnusedDefaultCategories();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Unauthorized");
      }
    });

    it("should clean only unused default categories and keep active ones for authenticated user", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: validUserId, email: "test@example.com" } },
        error: null,
      });

      const mockCategories = [
        { id: "cat-1", name: "Alimentación", category_type: "expense", is_default: false },
        { id: "cat-2", name: "Salary", category_type: "income", is_default: true },
      ];

      // 1. Fetch user categories
      const mockSelectCategories = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValueOnce({
          data: mockCategories,
          error: null,
        }),
      });

      // 2. Count for cat-1 (has 10 tx)
      const mockCountCat1 = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValueOnce({ count: 10, error: null }),
      });

      // 3. Count for cat-2 (has 0 tx)
      const mockCountCat2 = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValueOnce({ count: 0, error: null }),
      });

      // 4. Delete cat-2
      const mockDeleteCat2 = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValueOnce({ error: null }),
        }),
      });

      mockFrom
        .mockReturnValueOnce({ select: mockSelectCategories })
        .mockReturnValueOnce({ select: mockCountCat1 })
        .mockReturnValueOnce({ select: mockCountCat2 })
        .mockReturnValueOnce({ delete: mockDeleteCat2 });

      const result = await cleanUnusedDefaultCategories();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalDeleted).toBe(1);
        expect(result.data.totalKept).toBe(1);
        expect(result.data.deletedCategories[0].name).toBe("Salary");
        expect(result.data.keptCategories[0].name).toBe("Alimentación");
      }
    });

    it("should return category usage counts map for authenticated user", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: validUserId } },
        error: null,
      });

      const mockTxs = [
        { category_id: "cat-1" },
        { category_id: "cat-1" },
        { category_id: "cat-2" },
      ];

      const mockSelectTxs = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValueOnce({
          data: mockTxs,
          error: null,
        }),
      });

      mockFrom.mockReturnValueOnce({ select: mockSelectTxs });

      const result = await getCategoryUsageCounts();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data["cat-1"]).toBe(2);
        expect(result.data["cat-2"]).toBe(1);
      }
    });
  });

  describe("Server Actions: dashboard-actions.ts", () => {
    const validUserId = "11111111-1111-4111-a111-111111111111";

    it("should reject getDashboardLayout when user is not authenticated", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: new Error("Unauthorized"),
      });

      const result = await getDashboardLayout();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Unauthorized");
      }
    });

    it("should return persisted dashboard layout when present in user_preferences", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: validUserId } },
        error: null,
      });

      const customLayout = {
        widget_order: ["recent_transactions", "kpi_summary"],
        visible_widgets: ["recent_transactions"],
        collapsed_widgets: ["kpi_summary"],
      };

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValueOnce({
            data: { dashboard_layout: customLayout },
            error: null,
          }),
        }),
      });

      mockFrom.mockReturnValueOnce({ select: mockSelect });

      const result = await getDashboardLayout();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.widget_order).toEqual(["recent_transactions", "kpi_summary"]);
        expect(result.data.visible_widgets).toEqual(["recent_transactions"]);
        expect(result.data.collapsed_widgets).toEqual(["kpi_summary"]);
      }
    });

    it("should seed and return DEFAULT_DASHBOARD_LAYOUT when user has no preferences row", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: validUserId } },
        error: null,
      });

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValueOnce({
            data: null,
            error: null,
          }),
        }),
      });

      const mockUpsert = vi.fn().mockResolvedValueOnce({ error: null });

      mockFrom
        .mockReturnValueOnce({ select: mockSelect })
        .mockReturnValueOnce({ upsert: mockUpsert });

      const result = await getDashboardLayout();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(DEFAULT_DASHBOARD_LAYOUT);
      }
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: validUserId,
          dashboard_layout: DEFAULT_DASHBOARD_LAYOUT,
        }),
        { onConflict: "user_id" }
      );
    });

    it("should fallback to DEFAULT_DASHBOARD_LAYOUT if stored data is corrupted", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: validUserId } },
        error: null,
      });

      const corruptedLayout = {
        widget_order: [], // invalid: requires min 1
      };

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValueOnce({
            data: { dashboard_layout: corruptedLayout },
            error: null,
          }),
        }),
      });

      mockFrom.mockReturnValueOnce({ select: mockSelect });

      const result = await getDashboardLayout();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(DEFAULT_DASHBOARD_LAYOUT);
      }
    });

    it("should reject saveDashboardLayout when user is not authenticated", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: new Error("Unauthorized"),
      });

      const result = await saveDashboardLayout({ widget_order: ["kpi_summary"] });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Unauthorized");
      }
    });

    it("should reject saveDashboardLayout with invalid layout structure", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: validUserId } },
        error: null,
      });

      const invalidLayout = {
        widget_order: [], // min 1 required
      };

      const result = await saveDashboardLayout(invalidLayout);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Configuración de layout de dashboard inválida");
        expect(result.validationErrors).toBeDefined();
      }
    });

    it("should save valid dashboard layout and upsert user_preferences with user_id", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: validUserId } },
        error: null,
      });

      const validLayout = {
        widget_order: ["financial_charts", "kpi_summary"],
        visible_widgets: ["financial_charts", "kpi_summary"],
        collapsed_widgets: [],
      };

      const mockUpsert = vi.fn().mockResolvedValueOnce({ error: null });
      mockFrom.mockReturnValueOnce({ upsert: mockUpsert });

      const result = await saveDashboardLayout(validLayout);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.widget_order).toEqual(["financial_charts", "kpi_summary"]);
      }
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: validUserId,
          dashboard_layout: validLayout,
        }),
        { onConflict: "user_id" }
      );
    });

    it("should reset dashboard layout to defaults via resetDashboardLayout", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: validUserId } },
        error: null,
      });

      const mockUpsert = vi.fn().mockResolvedValueOnce({ error: null });
      mockFrom.mockReturnValueOnce({ upsert: mockUpsert });

      const result = await resetDashboardLayout();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(DEFAULT_DASHBOARD_LAYOUT);
      }
    });
  });
});
