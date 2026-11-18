import { describe, it, expect } from "vitest";

describe("Category Totales Section Interaction Logic", () => {
  interface FilterState {
    typeFilter: "all" | "income" | "expense";
    selectedCategoryNames: string[];
  }

  function handleToggleExpenseCategory(
    state: FilterState,
    categoryName: string
  ): FilterState {
    const norm = categoryName.trim().toLowerCase();
    const isCurrentlyFiltered =
      state.typeFilter === "expense" &&
      state.selectedCategoryNames.some((n) => n.trim().toLowerCase() === norm);

    if (isCurrentlyFiltered) {
      const remaining = state.selectedCategoryNames.filter(
        (n) => n.trim().toLowerCase() !== norm
      );
      return {
        typeFilter: remaining.length === 0 ? "all" : "expense",
        selectedCategoryNames: remaining,
      };
    } else {
      const exists = state.selectedCategoryNames.some(
        (n) => n.trim().toLowerCase() === norm
      );
      return {
        typeFilter: "expense",
        selectedCategoryNames: exists
          ? state.selectedCategoryNames
          : [...state.selectedCategoryNames, categoryName.trim()],
      };
    }
  }

  function handleToggleIncomeCategory(
    state: FilterState,
    categoryName: string
  ): FilterState {
    const norm = categoryName.trim().toLowerCase();
    const isCurrentlyFiltered =
      state.typeFilter === "income" &&
      state.selectedCategoryNames.some((n) => n.trim().toLowerCase() === norm);

    if (isCurrentlyFiltered) {
      const remaining = state.selectedCategoryNames.filter(
        (n) => n.trim().toLowerCase() !== norm
      );
      return {
        typeFilter: remaining.length === 0 ? "all" : "income",
        selectedCategoryNames: remaining,
      };
    } else {
      const exists = state.selectedCategoryNames.some(
        (n) => n.trim().toLowerCase() === norm
      );
      return {
        typeFilter: "income",
        selectedCategoryNames: exists
          ? state.selectedCategoryNames
          : [...state.selectedCategoryNames, categoryName.trim()],
      };
    }
  }

  it("filtra exclusivamente por gastos cuando se hace clic en una tarjeta de gastos", () => {
    let state: FilterState = { typeFilter: "all", selectedCategoryNames: [] };

    state = handleToggleExpenseCategory(state, "Internado");

    expect(state.typeFilter).toBe("expense");
    expect(state.selectedCategoryNames).toEqual(["Internado"]);
  });

  it("filtra exclusivamente por ingresos cuando se hace clic en una tarjeta de ingresos", () => {
    let state: FilterState = { typeFilter: "all", selectedCategoryNames: [] };

    state = handleToggleIncomeCategory(state, "Internado");

    expect(state.typeFilter).toBe("income");
    expect(state.selectedCategoryNames).toEqual(["Internado"]);
  });

  it("alterna limpiamente entre gastos e ingresos para una misma categoría", () => {
    let state: FilterState = { typeFilter: "all", selectedCategoryNames: [] };

    // Clic en Gastos
    state = handleToggleExpenseCategory(state, "Internado");
    expect(state.typeFilter).toBe("expense");
    expect(state.selectedCategoryNames).toEqual(["Internado"]);

    // Clic en Ingresos: debe cambiar el filtro de tipo a ingreso
    state = handleToggleIncomeCategory(state, "Internado");
    expect(state.typeFilter).toBe("income");
    expect(state.selectedCategoryNames).toEqual(["Internado"]);
  });

  it("desactiva el filtro si se vuelve a hacer clic en la misma tarjeta ya activa", () => {
    let state: FilterState = {
      typeFilter: "expense",
      selectedCategoryNames: ["Internado"],
    };

    // Segundo clic en la misma tarjeta de gastos
    state = handleToggleExpenseCategory(state, "Internado");
    expect(state.typeFilter).toBe("all");
    expect(state.selectedCategoryNames).toEqual([]);
  });

  it("mantiene typeFilter='expense' al agregar múltiples categorías de gastos", () => {
    let state: FilterState = { typeFilter: "all", selectedCategoryNames: [] };

    state = handleToggleExpenseCategory(state, "Internado");
    state = handleToggleExpenseCategory(state, "Alimentación");

    expect(state.typeFilter).toBe("expense");
    expect(state.selectedCategoryNames).toEqual(["Internado", "Alimentación"]);
  });

  describe("Category View Tab Switching & Filter Synchronization", () => {
    interface ViewTabState {
      typeFilter: "all" | "income" | "expense";
      categoryViewTab: "all" | "income" | "expense";
    }

    function handleCategoryViewTabChange(
      _state: ViewTabState,
      tab: "all" | "expense" | "income"
    ): ViewTabState {
      return {
        typeFilter: tab,
        categoryViewTab: tab,
      };
    }

    function handleTypeFilterChange(
      _state: ViewTabState,
      type: "all" | "income" | "expense"
    ): ViewTabState {
      return {
        typeFilter: type,
        categoryViewTab: type,
      };
    }

    it("al seleccionar 'Gastos' en las pestañas de categorías, sincroniza typeFilter='expense' y categoryViewTab='expense'", () => {
      let state: ViewTabState = { typeFilter: "all", categoryViewTab: "all" };
      state = handleCategoryViewTabChange(state, "expense");

      expect(state.categoryViewTab).toBe("expense");
      expect(state.typeFilter).toBe("expense");
    });

    it("al seleccionar 'Ingresos' en las pestañas de categorías, sincroniza typeFilter='income' y categoryViewTab='income'", () => {
      let state: ViewTabState = { typeFilter: "all", categoryViewTab: "all" };
      state = handleCategoryViewTabChange(state, "income");

      expect(state.categoryViewTab).toBe("income");
      expect(state.typeFilter).toBe("income");
    });

    it("al seleccionar 'Ambos' en las pestañas de categorías, restablece typeFilter='all' y categoryViewTab='all'", () => {
      let state: ViewTabState = { typeFilter: "expense", categoryViewTab: "expense" };
      state = handleCategoryViewTabChange(state, "all");

      expect(state.categoryViewTab).toBe("all");
      expect(state.typeFilter).toBe("all");
    });

    it("al cambiar el filtro global de tipo en la barra superior, sincroniza categoryViewTab correspondientemente", () => {
      let state: ViewTabState = { typeFilter: "all", categoryViewTab: "all" };

      state = handleTypeFilterChange(state, "expense");
      expect(state.typeFilter).toBe("expense");
      expect(state.categoryViewTab).toBe("expense");

      state = handleTypeFilterChange(state, "income");
      expect(state.typeFilter).toBe("income");
      expect(state.categoryViewTab).toBe("income");

      state = handleTypeFilterChange(state, "all");
      expect(state.typeFilter).toBe("all");
      expect(state.categoryViewTab).toBe("all");
    });
  });
});
