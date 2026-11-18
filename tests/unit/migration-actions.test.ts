import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EXCEL_MOVEMENTS,
  type ExcelMovementRecord,
} from "@/features/transactions/data/excel-movements";

// Mock Supabase admin client
const mockListUsers = vi.fn();
const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        listUsers: mockListUsers,
      },
    },
    from: mockFrom,
    rpc: mockRpc,
  }),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  migrateExcelTransactions,
  getExcelMigrationStatus,
} from "@/features/transactions/actions/migration-actions";

describe("Excel Migration: Data Integrity & Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListUsers.mockReset();
    mockFrom.mockReset();
    mockRpc.mockReset();
  });

  describe("Dataset Validation (EXCEL_MOVEMENTS)", () => {
    it("should contain exactly 149 movements extracted from Excel", () => {
      expect(EXCEL_MOVEMENTS).toHaveLength(149);
    });

    it("should validate all 149 records have valid ISO dates and positive amounts", () => {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      const validAccounts = new Set(["Efectivo", "Nequi", "Bancolombia"]);

      for (const m of EXCEL_MOVEMENTS) {
        expect(m.transaction_date).toMatch(dateRegex);
        expect(m.amount).toBeGreaterThan(0);
        expect(["income", "expense"]).toContain(m.transaction_type);
        expect(validAccounts.has(m.account_name)).toBe(true);
        expect(m.description.length).toBeGreaterThan(0);
      }
    });

    it("should ensure normalized categories follow business rules", () => {
      const categories = new Set(EXCEL_MOVEMENTS.map((m) => m.category_name));
      // Includes normalized Comida, Otros gastos, Otros ingresos
      expect(categories.has("Comida")).toBe(true);
      expect(categories.has("Otros gastos")).toBe(true);
      expect(categories.has("Otros ingresos")).toBe(true);
    });

    it("should match exact financial balances of the Excel file", () => {
      let incomeSum = 0;
      let expenseSum = 0;

      for (const m of EXCEL_MOVEMENTS) {
        if (m.transaction_type === "income") {
          incomeSum += m.amount;
        } else {
          expenseSum += m.amount;
        }
      }

      expect(Math.round(incomeSum * 100) / 100).toBe(13334020);
      expect(Math.round(expenseSum * 100) / 100).toBe(9198410);
      expect(Math.round((incomeSum - expenseSum) * 100) / 100).toBe(4135610);
    });
  });

  describe("Server Action: migrateExcelTransactions", () => {
    const validUserId = "bc9c8825-dcdf-4d20-9704-83f8e969ebac";
    const testEmail = "calderongoenaga2004@gmail.com";

    it("should return error if target user is not found in Supabase Auth", async () => {
      mockListUsers.mockResolvedValueOnce({
        data: { users: [] },
        error: null,
      });

      const result = await migrateExcelTransactions("nonexistent@example.com");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Usuario destino no encontrado");
      }
    });

    it("should create missing accounts, ensure categories and insert transactions idempotently", async () => {
      // 1. Mock listUsers with target user
      mockListUsers.mockResolvedValueOnce({
        data: {
          users: [{ id: validUserId, email: testEmail }],
        },
        error: null,
      });

      // 2. Mock accounts: user has no existing accounts initially
      const mockSelectAccounts = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValueOnce({
          data: [],
          error: null,
        }),
      });

      // Mock account insertion
      let accCounter = 1;
      const mockInsertAccount = vi.fn().mockImplementation((payload) => ({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValueOnce({
            data: { id: `acc-${accCounter++}`, name: payload.name },
            error: null,
          }),
        }),
      }));

      // 3. Mock categories: user has existing default categories
      const mockSelectCategories = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValueOnce({
          data: [
            { id: "cat-comida", name: "Comida", category_type: "expense" },
            { id: "cat-gastos", name: "Otros gastos", category_type: "expense" },
            { id: "cat-ingresos", name: "Otros ingresos", category_type: "income" },
          ],
          error: null,
        }),
      });

      // Mock category insertion
      let catCounter = 1;
      const mockInsertCategory = vi.fn().mockImplementation((payload) => ({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValueOnce({
            data: { id: `cat-new-${catCounter++}`, name: payload.name, category_type: payload.category_type },
            error: null,
          }),
        }),
      }));

      // 4. Mock transactions: empty existing transactions
      const mockSelectTx = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValueOnce({
          data: [],
          error: null,
        }),
      });

      // Mock transaction batch insertion
      const mockInsertTx = vi.fn().mockResolvedValue({ error: null });

      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === "accounts") {
          return {
            select: mockSelectAccounts,
            insert: mockInsertAccount,
          };
        }
        if (tableName === "categories") {
          return {
            select: mockSelectCategories,
            insert: mockInsertCategory,
          };
        }
        if (tableName === "transactions") {
          return {
            select: mockSelectTx,
            insert: mockInsertTx,
          };
        }
        return {};
      });

      mockRpc.mockResolvedValue({ data: 0, error: null });

      // Test with custom subset of movements
      const sampleMovements: ExcelMovementRecord[] = [
        {
          excel_row: 31,
          transaction_date: "2026-11-08",
          transaction_type: "expense",
          category_name: "Comida",
          raw_category: "comida",
          account_name: "Efectivo",
          description: "sushi",
          amount: 44000,
        },
        {
          excel_row: 84,
          transaction_date: "2026-07-15",
          transaction_type: "income",
          category_name: "Otros ingresos",
          raw_category: "",
          account_name: "Bancolombia",
          description: "mami Julio",
          amount: 700000,
        },
      ];

      const result = await migrateExcelTransactions(testEmail, sampleMovements);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userId).toBe(validUserId);
        expect(result.data.transactionsInserted).toBe(2);
        expect(result.data.transactionsSkippedDuplicates).toBe(0);
        expect(result.data.accountsCreated).toContain("Efectivo");
        expect(result.data.accountsCreated).toContain("Nequi");
        expect(result.data.accountsCreated).toContain("Bancolombia");
      }
    });

    it("should skip duplicate transactions based on (user_id, account_id, date, amount, description)", async () => {
      mockListUsers.mockResolvedValueOnce({
        data: {
          users: [{ id: validUserId, email: testEmail }],
        },
        error: null,
      });

      // Existing accounts
      const mockSelectAccounts = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValueOnce({
          data: [
            { id: "acc-efectivo", name: "Efectivo" },
            { id: "acc-nequi", name: "Nequi" },
            { id: "acc-bancolombia", name: "Bancolombia" },
          ],
          error: null,
        }),
      });

      // Existing categories
      const mockSelectCategories = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValueOnce({
          data: [
            { id: "cat-comida", name: "Comida", category_type: "expense" },
          ],
          error: null,
        }),
      });

      // Existing transactions with the same key
      const mockSelectTx = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValueOnce({
          data: [
            {
              account_id: "acc-efectivo",
              transaction_date: "2026-11-08",
              amount: 44000,
              description: "sushi",
            },
          ],
          error: null,
        }),
      });

      const mockInsertTx = vi.fn().mockResolvedValue({ error: null });

      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === "accounts") return { select: mockSelectAccounts };
        if (tableName === "categories") {
          return {
            select: mockSelectCategories,
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: "new-cat" }, error: null }),
              }),
            }),
          };
        }
        if (tableName === "transactions") {
          return {
            select: mockSelectTx,
            insert: mockInsertTx,
          };
        }
        return {};
      });

      const sampleMovements: ExcelMovementRecord[] = [
        {
          excel_row: 31,
          transaction_date: "2026-11-08",
          transaction_type: "expense",
          category_name: "Comida",
          raw_category: "comida",
          account_name: "Efectivo",
          description: "sushi",
          amount: 44000,
        },
      ];

      const result = await migrateExcelTransactions(testEmail, sampleMovements);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.transactionsInserted).toBe(0);
        expect(result.data.transactionsSkippedDuplicates).toBe(1);
      }
      expect(mockInsertTx).not.toHaveBeenCalled();
    });
  });

  describe("Server Action: getExcelMigrationStatus", () => {
    const validUserId = "bc9c8825-dcdf-4d20-9704-83f8e969ebac";
    const testEmail = "calderongoenaga2004@gmail.com";

    it("should return migration status with totalExpected and totalImported", async () => {
      mockListUsers.mockResolvedValueOnce({
        data: {
          users: [{ id: validUserId, email: testEmail }],
        },
        error: null,
      });

      const mockSelectAccounts = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValueOnce({
          data: [{ name: "Efectivo" }, { name: "Nequi" }, { name: "Bancolombia" }],
          error: null,
        }),
      });

      const mockSelectTxCount = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValueOnce({
          count: 149,
          error: null,
        }),
      });

      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === "accounts") return { select: mockSelectAccounts };
        if (tableName === "transactions") return { select: mockSelectTxCount };
        return {};
      });

      const result = await getExcelMigrationStatus(testEmail);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userId).toBe(validUserId);
        expect(result.data.totalExpected).toBe(149);
        expect(result.data.totalImported).toBe(149);
        expect(result.data.isFullyMigrated).toBe(true);
        expect(result.data.accountsPresent).toContain("Efectivo");
      }
    });
  });
});
