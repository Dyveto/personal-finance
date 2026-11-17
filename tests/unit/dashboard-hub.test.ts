import { describe, it, expect } from "vitest";
import { DEFAULT_DASHBOARD_WIDGET_ORDER } from "@/lib/validations/finance";
import { WIDGET_METADATA } from "@/features/dashboard/components/WelcomeHubManagerModal";

describe("PlayStation 5 Welcome Hub: Dashboard Layout & Reordering Logic", () => {
  it("should have complete metadata for all default dashboard widgets", () => {
    for (const widgetId of DEFAULT_DASHBOARD_WIDGET_ORDER) {
      const meta = WIDGET_METADATA[widgetId];
      expect(meta).toBeDefined();
      expect(meta.id).toBe(widgetId);
      expect(meta.name.length).toBeGreaterThan(0);
      expect(meta.description.length).toBeGreaterThan(0);
      expect(meta.icon).toBeDefined();
    }
  });

  describe("Reordering operations (moveWidget)", () => {
    const reorder = (
      order: string[],
      id: string,
      direction: "up" | "down"
    ): string[] => {
      const index = order.indexOf(id);
      if (index === -1) return order;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= order.length) return order;

      const newOrder = [...order];
      const temp = newOrder[index];
      newOrder[index] = newOrder[targetIndex];
      newOrder[targetIndex] = temp;
      return newOrder;
    };

    it("should move a widget up when not at first position", () => {
      const initial = ["kpi_summary", "financial_charts", "recent_transactions"];
      const updated = reorder(initial, "financial_charts", "up");
      expect(updated).toEqual(["financial_charts", "kpi_summary", "recent_transactions"]);
    });

    it("should not change order when moving first widget up", () => {
      const initial = ["kpi_summary", "financial_charts", "recent_transactions"];
      const updated = reorder(initial, "kpi_summary", "up");
      expect(updated).toEqual(initial);
    });

    it("should move a widget down when not at last position", () => {
      const initial = ["kpi_summary", "financial_charts", "recent_transactions"];
      const updated = reorder(initial, "kpi_summary", "down");
      expect(updated).toEqual(["financial_charts", "kpi_summary", "recent_transactions"]);
    });

    it("should not change order when moving last widget down", () => {
      const initial = ["kpi_summary", "financial_charts", "recent_transactions"];
      const updated = reorder(initial, "recent_transactions", "down");
      expect(updated).toEqual(initial);
    });

    it("should handle drag and drop repositioning accurately without losing items", () => {
      const initial = ["kpi_summary", "financial_charts", "installment_projections", "active_accounts", "recent_transactions"];
      const dragAndDrop = (order: string[], fromId: string, toId: string): string[] => {
        const fromIndex = order.indexOf(fromId);
        const toIndex = order.indexOf(toId);
        if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return order;

        const updated = [...order];
        const [moved] = updated.splice(fromIndex, 1);
        updated.splice(toIndex, 0, moved);
        return updated;
      };

      // Mover recent_transactions al inicio
      const res = dragAndDrop(initial, "recent_transactions", "kpi_summary");
      expect(res).toEqual([
        "recent_transactions",
        "kpi_summary",
        "financial_charts",
        "installment_projections",
        "active_accounts",
      ]);
      expect(res.length).toBe(initial.length);
      expect(new Set(res).size).toBe(initial.length);
    });
  });

  describe("Visibility management", () => {
    const toggleVisibility = (visible: string[], id: string): string[] => {
      if (visible.includes(id)) {
        return visible.filter((item) => item !== id);
      }
      return [...visible, id];
    };

    it("should hide a widget when toggled if currently visible", () => {
      const visible = ["kpi_summary", "financial_charts"];
      const updated = toggleVisibility(visible, "financial_charts");
      expect(updated).toEqual(["kpi_summary"]);
    });

    it("should show a widget when toggled if currently hidden", () => {
      const visible = ["kpi_summary"];
      const updated = toggleVisibility(visible, "financial_charts");
      expect(updated).toEqual(["kpi_summary", "financial_charts"]);
    });

    it("should show all widgets when showAll is invoked", () => {
      const order = ["kpi_summary", "financial_charts", "active_accounts"];
      const showAll = (all: string[]) => [...all];
      expect(showAll(order)).toEqual(order);
    });
  });
});
