import { describe, it, expect } from "vitest";
import {
  CATEGORY_TOTALS_COLLAPSED_KEY,
  getCategoryTotalsCollapsedPreference,
  setCategoryTotalsCollapsedPreference,
} from "@/lib/transactions-preferences";

describe("Transactions Preferences - Collapsible Category Summary Persistence", () => {
  function createMockStorage(): Storage {
    const store: Record<string, string> = {};
    return {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
      get length() {
        return Object.keys(store).length;
      },
      key: (index: number) => Object.keys(store)[index] ?? null,
    };
  }

  it("should have the expected storage key", () => {
    expect(CATEGORY_TOTALS_COLLAPSED_KEY).toBe("finances_category_totals_collapsed");
  });

  it("should default to false (not collapsed, visible) when storage is empty", () => {
    const storage = createMockStorage();
    expect(getCategoryTotalsCollapsedPreference(storage)).toBe(false);
  });

  it("should persist collapsed state as 'true'", () => {
    const storage = createMockStorage();
    setCategoryTotalsCollapsedPreference(true, storage);

    expect(storage.getItem(CATEGORY_TOTALS_COLLAPSED_KEY)).toBe("true");
    expect(getCategoryTotalsCollapsedPreference(storage)).toBe(true);
  });

  it("should persist expanded state as 'false'", () => {
    const storage = createMockStorage();
    setCategoryTotalsCollapsedPreference(false, storage);

    expect(storage.getItem(CATEGORY_TOTALS_COLLAPSED_KEY)).toBe("false");
    expect(getCategoryTotalsCollapsedPreference(storage)).toBe(false);
  });

  it("should update and overwrite existing preference", () => {
    const storage = createMockStorage();
    setCategoryTotalsCollapsedPreference(true, storage);
    expect(getCategoryTotalsCollapsedPreference(storage)).toBe(true);

    setCategoryTotalsCollapsedPreference(false, storage);
    expect(getCategoryTotalsCollapsedPreference(storage)).toBe(false);
  });

  it("should safely handle null or missing storage without crashing", () => {
    expect(() => setCategoryTotalsCollapsedPreference(true, undefined)).not.toThrow();
    expect(getCategoryTotalsCollapsedPreference(undefined)).toBe(false);
  });
});
