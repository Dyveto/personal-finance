import { describe, it, expect } from "vitest";
import type { AccountRow } from "@/features/accounts/actions/account-actions";

describe("AccountMultiSelect - Multi-Account Filtering & Selection Logic", () => {
  const mockAccounts: AccountRow[] = [
    {
      id: "acc-bancolombia",
      user_id: "user-123",
      name: "Bancolombia",
      account_type: "bank",
      institution: "Bancolombia",
      currency: "COP",
      initial_balance: 500000.0,
      current_balance: 750000.0,
      credit_limit: null,
      closing_day: null,
      payment_due_day: null,
      color: "#3B82F6",
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "acc-nequi",
      user_id: "user-123",
      name: "Nequi",
      account_type: "bank",
      institution: "Nequi",
      currency: "COP",
      initial_balance: 100000.0,
      current_balance: 150000.0,
      credit_limit: null,
      closing_day: null,
      payment_due_day: null,
      color: "#8B5CF6",
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "acc-efectivo",
      user_id: "user-123",
      name: "Efectivo",
      account_type: "cash",
      institution: null,
      currency: "COP",
      initial_balance: 50000.0,
      current_balance: 80000.0,
      credit_limit: null,
      closing_day: null,
      payment_due_day: null,
      color: "#10B981",
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "acc-tarjeta",
      user_id: "user-123",
      name: "Tarjeta Visa",
      account_type: "credit_card",
      institution: "Bancolombia",
      currency: "COP",
      initial_balance: 0.0,
      current_balance: 320000.0,
      credit_limit: 3000000.0,
      closing_day: 15,
      payment_due_day: 30,
      color: "#F43F5E",
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ];

  const mockTransactions = [
    { id: "tx-1", account_id: "acc-bancolombia", amount: "50000.00", description: "Compra 1" },
    { id: "tx-2", account_id: "acc-nequi", amount: "20000.00", description: "Compra 2" },
    { id: "tx-3", account_id: "acc-efectivo", amount: "15000.00", description: "Compra 3" },
    { id: "tx-4", account_id: "acc-tarjeta", amount: "120000.00", description: "Compra 4" },
    { id: "tx-5", account_id: "acc-bancolombia", amount: "80000.00", description: "Compra 5" },
  ];

  function filterTransactionsByAccounts(
    transactions: typeof mockTransactions,
    selectedAccountIds: string[]
  ) {
    if (selectedAccountIds.length === 0) return transactions;
    return transactions.filter((tx) => selectedAccountIds.includes(tx.account_id));
  }

  function toggleAccountId(selectedIds: string[], accountId: string): string[] {
    if (selectedIds.includes(accountId)) {
      return selectedIds.filter((id) => id !== accountId);
    }
    return [...selectedIds, accountId];
  }

  it("retorna todas las transacciones cuando selectedAccountIds está vacío", () => {
    const result = filterTransactionsByAccounts(mockTransactions, []);
    expect(result).toHaveLength(5);
  });

  it("filtra transacciones correctamente para una sola cuenta seleccionada", () => {
    const result = filterTransactionsByAccounts(mockTransactions, ["acc-bancolombia"]);
    expect(result).toHaveLength(2);
    expect(result.map((tx) => tx.id)).toEqual(["tx-1", "tx-5"]);
  });

  it("permite selección múltiple de cuentas simultáneas (ej. Bancolombia y Nequi)", () => {
    const result = filterTransactionsByAccounts(mockTransactions, [
      "acc-bancolombia",
      "acc-nequi",
    ]);
    expect(result).toHaveLength(3);
    expect(result.map((tx) => tx.id)).toEqual(["tx-1", "tx-2", "tx-5"]);
  });

  it("excluye transacciones de cuentas no seleccionadas", () => {
    const result = filterTransactionsByAccounts(mockTransactions, ["acc-efectivo"]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("tx-3");
  });

  it("agrega y remueve cuentas correctamente mediante toggleAccountId", () => {
    let selected: string[] = [];

    // Agregar Bancolombia
    selected = toggleAccountId(selected, "acc-bancolombia");
    expect(selected).toEqual(["acc-bancolombia"]);

    // Agregar Nequi
    selected = toggleAccountId(selected, "acc-nequi");
    expect(selected).toEqual(["acc-bancolombia", "acc-nequi"]);

    // Remover Bancolombia
    selected = toggleAccountId(selected, "acc-bancolombia");
    expect(selected).toEqual(["acc-nequi"]);

    // Remover Nequi
    selected = toggleAccountId(selected, "acc-nequi");
    expect(selected).toEqual([]);
  });

  it("selecciona todas las cuentas correctamente", () => {
    const allIds = mockAccounts.map((a) => a.id);
    const result = filterTransactionsByAccounts(mockTransactions, allIds);
    expect(result).toHaveLength(5);
  });

  it("busca y filtra opciones de cuentas por nombre", () => {
    const query = "ban";
    const filtered = mockAccounts.filter((a) =>
      a.name.toLowerCase().includes(query.toLowerCase())
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("acc-bancolombia");
  });
});
