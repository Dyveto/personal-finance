import { describe, it, expect } from "vitest";
import {
  computeTimeWindow,
  clampQuantity,
  DEFAULT_QUANTITIES,
  QUANTITY_LIMITS,
} from "@/lib/finance/chart-periods";

describe("Chart Periods & Time Window Engine (Bogotá Timezone)", () => {
  const referenceDate = "2026-11-21"; // Fecha fija de prueba (Noviembre 2026)

  it("enforces required default quantities: weeks = 4, months = 6", () => {
    expect(DEFAULT_QUANTITIES.weeks).toBe(4);
    expect(DEFAULT_QUANTITIES.months).toBe(6);
    expect(DEFAULT_QUANTITIES.days).toBe(14);
    expect(DEFAULT_QUANTITIES.years).toBe(3);
  });

  it("validates and clamps quantities within allowed ranges", () => {
    // Meses: mínimo 1, máximo 24
    expect(clampQuantity("months", 0)).toBe(QUANTITY_LIMITS.months.min);
    expect(clampQuantity("months", 1)).toBe(1);
    expect(clampQuantity("months", 6)).toBe(6);
    expect(clampQuantity("months", 24)).toBe(24);
    expect(clampQuantity("months", 50)).toBe(QUANTITY_LIMITS.months.max);

    // Semanas: mínimo 1, máximo 24
    expect(clampQuantity("weeks", -2)).toBe(1);
    expect(clampQuantity("weeks", 4)).toBe(4);
    expect(clampQuantity("weeks", 30)).toBe(24);

    // Días: mínimo 1, máximo 60
    expect(clampQuantity("days", 14)).toBe(14);
    expect(clampQuantity("days", 100)).toBe(60);
  });

  describe("Single Month Mode (quantity = 1)", () => {
    it("computes current month when offset = 0", () => {
      const window = computeTimeWindow({
        granularity: "months",
        quantity: 1,
        offset: 0,
        referenceDate,
      });

      expect(window.quantity).toBe(1);
      expect(window.offset).toBe(0);
      expect(window.isCurrentPeriod).toBe(true);
      expect(window.startDateLimit).toBe("2026-11-01");
      expect(window.endDateLimit).toBe("2026-11-30");
      expect(window.summaryLabel).toBe("Noviembre 2026");
      expect(window.buckets).toHaveLength(1);
      expect(window.buckets[0].key).toBe("2026-11");
    });

    it("navigates to May 2026 when shifting back 6 months (offset = 6)", () => {
      const window = computeTimeWindow({
        granularity: "months",
        quantity: 1,
        offset: 6,
        referenceDate,
      });

      expect(window.quantity).toBe(1);
      expect(window.offset).toBe(6);
      expect(window.isCurrentPeriod).toBe(false);
      expect(window.startDateLimit).toBe("2026-05-01");
      expect(window.endDateLimit).toBe("2026-05-31");
      expect(window.summaryLabel).toBe("Mayo 2026");
      expect(window.buckets).toHaveLength(1);
      expect(window.buckets[0].key).toBe("2026-05");
    });
  });

  describe("Multi-Month Default Mode (months = 6)", () => {
    it("computes 6-month window ending in current month", () => {
      const window = computeTimeWindow({
        granularity: "months",
        quantity: 6,
        offset: 0,
        referenceDate,
      });

      expect(window.quantity).toBe(6);
      expect(window.isCurrentPeriod).toBe(true);
      expect(window.startDateLimit).toBe("2026-06-01");
      expect(window.endDateLimit).toBe("2026-11-30");
      expect(window.summaryLabel).toContain("6 meses");
      expect(window.buckets).toHaveLength(6);
      expect(window.buckets[0].key).toBe("2026-06");
      expect(window.buckets[5].key).toBe("2026-11");
    });

    it("shifts 6-month window back by 1 step (offset = 1)", () => {
      const window = computeTimeWindow({
        granularity: "months",
        quantity: 6,
        offset: 1,
        referenceDate,
      });

      expect(window.quantity).toBe(6);
      expect(window.isCurrentPeriod).toBe(false);
      // Ventana de 6 meses finalizando en Octubre 2026 (Mayo 2026 a Octubre 2026)
      expect(window.startDateLimit).toBe("2026-05-01");
      expect(window.endDateLimit).toBe("2026-10-31");
      expect(window.buckets).toHaveLength(6);
      expect(window.buckets[0].key).toBe("2026-05");
      expect(window.buckets[5].key).toBe("2026-10");
    });
  });

  describe("Weeks Mode (default quantity = 4)", () => {
    it("generates exactly 4 weekly buckets by default", () => {
      const window = computeTimeWindow({
        granularity: "weeks",
        quantity: 4,
        offset: 0,
        referenceDate,
      });

      expect(window.quantity).toBe(4);
      expect(window.isCurrentPeriod).toBe(true);
      expect(window.buckets).toHaveLength(4);
      expect(window.summaryLabel).toContain("4 semanas");
    });

    it("shifts weeks back when offset is increased", () => {
      const current = computeTimeWindow({
        granularity: "weeks",
        quantity: 4,
        offset: 0,
        referenceDate,
      });

      const past = computeTimeWindow({
        granularity: "weeks",
        quantity: 4,
        offset: 2,
        referenceDate,
      });

      expect(past.isCurrentPeriod).toBe(false);
      expect(new Date(past.endDateLimit).getTime()).toBeLessThan(
        new Date(current.endDateLimit).getTime()
      );
    });
  });

  describe("Custom Range Mode", () => {
    it("preserves explicitly defined start and end dates", () => {
      const window = computeTimeWindow({
        granularity: "custom",
        customStartDate: "2026-01-15",
        customEndDate: "2026-03-31",
      });

      expect(window.granularity).toBe("custom");
      expect(window.startDateLimit).toBe("2026-01-15");
      expect(window.endDateLimit).toBe("2026-03-31");
      expect(window.summaryLabel).toBe("Rango: 2026-01-15 al 2026-03-31");
    });
  });
});
