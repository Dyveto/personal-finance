import { describe, it, expect } from "vitest";
import { unifyCategoriesByBaseName } from "@/features/transactions/components/CategoryMultiSelect";
import type { CategoryRow } from "@/features/categories/actions/category-actions";

describe("CategoryMultiSelect - Category Unification & Multi-Select Filter Logic", () => {
  const mockCategories: CategoryRow[] = [
    {
      id: "cat-int-exp",
      user_id: "user-123",
      name: "Internado",
      category_type: "expense",
      icon: "home",
      color: "#F43F5E",
      is_default: false,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "cat-int-inc",
      user_id: "user-123",
      name: "Internado",
      category_type: "income",
      icon: "home",
      color: "#10B981",
      is_default: false,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "cat-comida",
      user_id: "user-123",
      name: " Comida ",
      category_type: "expense",
      icon: "utensils",
      color: "#EF4444",
      is_default: true,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "cat-salud",
      user_id: "user-123",
      name: "Salud",
      category_type: "expense",
      icon: "heart",
      color: "#06B6D4",
      is_default: false,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "cat-nomina",
      user_id: "user-123",
      name: "Nómina",
      category_type: "income",
      icon: "wallet",
      color: "#10B981",
      is_default: true,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ];

  it("unifies categories by base name regardless of expense or income type", () => {
    const unified = unifyCategoriesByBaseName(mockCategories);

    // 5 raw categories should unify into 4 base categories: Comida, Internado, Nómina, Salud
    expect(unified).toHaveLength(4);

    const internado = unified.find((c) => c.name.toLowerCase() === "internado");
    expect(internado).toBeDefined();
    expect(internado?.hasExpense).toBe(true);
    expect(internado?.hasIncome).toBe(true);
    expect(internado?.categoryIds).toContain("cat-int-exp");
    expect(internado?.categoryIds).toContain("cat-int-inc");
  });

  it("cleans trailing/leading whitespace and handles case insensitivity", () => {
    const unified = unifyCategoriesByBaseName(mockCategories);
    const comida = unified.find((c) => c.name === "Comida");
    expect(comida).toBeDefined();
    expect(comida?.hasExpense).toBe(true);
    expect(comida?.hasIncome).toBe(false);
  });

  it("sorts base categories alphabetically in Spanish", () => {
    const unified = unifyCategoriesByBaseName(mockCategories);
    const names = unified.map((c) => c.name);
    expect(names).toEqual(["Comida", "Internado", "Nómina", "Salud"]);
  });

  describe("Transaction Filtering by Unified Base Names", () => {
    const categoriesMap = new Map<string, CategoryRow>(
      mockCategories.map((c) => [c.id, c])
    );

    const mockTransactions = [
      {
        id: "tx-1",
        category_id: "cat-int-exp",
        description: "Gasto de internado (alquiler)",
        amount: 500000,
        transaction_type: "expense" as const,
      },
      {
        id: "tx-2",
        category_id: "cat-int-inc",
        description: "Subsidio de internado",
        amount: 200000,
        transaction_type: "income" as const,
      },
      {
        id: "tx-3",
        category_id: "cat-comida",
        description: "Almuerzo cafetería",
        amount: 15000,
        transaction_type: "expense" as const,
      },
      {
        id: "tx-4",
        category_id: "cat-salud",
        description: "Consulta médica",
        amount: 80000,
        transaction_type: "expense" as const,
      },
      {
        id: "tx-5",
        category_id: "cat-nomina",
        description: "Salario mensual",
        amount: 2500000,
        transaction_type: "income" as const,
      },
      {
        id: "tx-6",
        category_id: null,
        description: "Ajuste sin categoría",
        amount: 5000,
        transaction_type: "expense" as const,
      },
    ];

    function filterTransactions(
      txList: typeof mockTransactions,
      selectedCategoryNames: string[]
    ) {
      return txList.filter((tx) => {
        if (selectedCategoryNames.length === 0) return true;
        if (!tx.category_id) return false;
        const cat = categoriesMap.get(tx.category_id);
        if (!cat) return false;
        const catNameLower = cat.name.trim().toLowerCase();
        return selectedCategoryNames.some(
          (selected) => selected.trim().toLowerCase() === catNameLower
        );
      });
    }

    it("returns all transactions when no category filter is selected", () => {
      const result = filterTransactions(mockTransactions, []);
      expect(result).toHaveLength(6);
    });

    it("filters both income and expense for a unified base category (e.g. Internado)", () => {
      const result = filterTransactions(mockTransactions, ["Internado"]);
      expect(result).toHaveLength(2);
      expect(result.map((t) => t.id)).toEqual(["tx-1", "tx-2"]);
      expect(result.some((t) => t.transaction_type === "expense")).toBe(true);
      expect(result.some((t) => t.transaction_type === "income")).toBe(true);
    });

    it("supports multi-selection across multiple categories simultaneously", () => {
      const result = filterTransactions(mockTransactions, ["Internado", "Salud"]);
      // tx-1 (Internado gasto), tx-2 (Internado ingreso), tx-4 (Salud gasto)
      expect(result).toHaveLength(3);
      expect(result.map((t) => t.id)).toEqual(["tx-1", "tx-2", "tx-4"]);
    });

    it("matches case-insensitively and handles spaces", () => {
      const result = filterTransactions(mockTransactions, ["  internado  "]);
      expect(result).toHaveLength(2);
      expect(result.map((t) => t.id)).toEqual(["tx-1", "tx-2"]);
    });

    it("returns empty array when category has no matching transactions", () => {
      const result = filterTransactions(mockTransactions, ["Categoría Inexistente"]);
      expect(result).toHaveLength(0);
    });
  });
});
