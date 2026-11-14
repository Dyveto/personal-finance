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

import { createAccount, listAccounts } from "@/features/accounts/actions/account-actions";
import { createTransaction, createInstallmentPurchase } from "@/features/transactions/actions/transaction-actions";

describe("Server Actions: account-actions.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});

describe("Server Actions: transaction-actions.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
