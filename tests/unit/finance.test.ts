import { describe, it, expect } from "vitest";
import {
  roundMoney,
  splitInstallments,
  addMoney,
  subtractMoney,
  compareMoney,
  isPositiveMoney,
  formatMoneyCOP,
} from "@/lib/finance/money";
import {
  calculateStatementClosingDate,
  calculatePaymentDueDate,
  isLeapYear,
  getDaysInMonth,
  parseCivilDate,
  clampDayToMonth,
} from "@/lib/finance/calendar";

describe("Financial Engine: money.ts", () => {
  describe("roundMoney", () => {
    it("should round numbers to 2 decimal places using HALF_UP", () => {
      expect(roundMoney("10.004")).toBe("10.00");
      expect(roundMoney("10.005")).toBe("10.01");
      expect(roundMoney("10.006")).toBe("10.01");
      expect(roundMoney("100")).toBe("100.00");
      expect(roundMoney("0")).toBe("0.00");
    });

    it("should throw for non-finite or invalid values", () => {
      expect(() => roundMoney("invalid")).toThrow();
      expect(() => roundMoney(NaN)).toThrow();
      expect(() => roundMoney(Infinity)).toThrow();
    });
  });

  describe("splitInstallments", () => {
    it("should return single installment equal to original amount when installmentCount is 1", () => {
      const result = splitInstallments("100000.00", 1);
      expect(result).toEqual(["100000.00"]);
    });

    it("should divide 100,000 COP into 3 installments assigning penny remainder to the first", () => {
      const result = splitInstallments("100000", 3);
      expect(result).toEqual(["33333.34", "33333.33", "33333.33"]);

      // Verify exact sum invariant
      const sum = result.reduce((acc, curr) => addMoney(acc, curr), "0.00");
      expect(sum).toBe("100000.00");
    });

    it("should divide evenly when divisible without remainder", () => {
      const result = splitInstallments("1200000", 6);
      expect(result).toEqual([
        "200000.00",
        "200000.00",
        "200000.00",
        "200000.00",
        "200000.00",
        "200000.00",
      ]);
      const sum = result.reduce((acc, curr) => addMoney(acc, curr), "0.00");
      expect(sum).toBe("1200000.00");
    });

    it("should preserve exact sum across irregular divisions (e.g. 7 installments)", () => {
      const total = "1000.00";
      const count = 7;
      const result = splitInstallments(total, count);
      expect(result).toHaveLength(count);

      const sum = result.reduce((acc, curr) => addMoney(acc, curr), "0.00");
      expect(sum).toBe(total);
      // First installment must absorb the difference
      expect(parseFloat(result[0])).toBeGreaterThanOrEqual(parseFloat(result[1]));
    });

    it("should throw for invalid installment counts", () => {
      expect(() => splitInstallments("100000", 0)).toThrow();
      expect(() => splitInstallments("100000", -2)).toThrow();
      expect(() => splitInstallments("100000", 2.5)).toThrow();
    });

    it("should throw for negative amounts", () => {
      expect(() => splitInstallments("-5000", 2)).toThrow();
    });
  });

  describe("arithmetic and helper utilities", () => {
    it("should add multiple monetary values precisely", () => {
      expect(addMoney("0.1", "0.2")).toBe("0.30"); // Avoids 0.30000000000000004
      expect(addMoney("15000.50", "2500.25", "100.25")).toBe("17601.00");
    });

    it("should subtract monetary values precisely", () => {
      expect(subtractMoney("100.00", "33.33")).toBe("66.67");
      expect(subtractMoney("50.00", "50.00")).toBe("0.00");
    });

    it("should compare monetary values correctly", () => {
      expect(compareMoney("100.00", "50.00")).toBe(1);
      expect(compareMoney("50.00", "100.00")).toBe(-1);
      expect(compareMoney("50.00", "50.00")).toBe(0);
    });

    it("should validate positive money", () => {
      expect(isPositiveMoney("100.00")).toBe(true);
      expect(isPositiveMoney("0.01")).toBe(true);
      expect(isPositiveMoney("0.00")).toBe(false);
      expect(isPositiveMoney("-10.00")).toBe(false);
      expect(isPositiveMoney("not-a-number")).toBe(false);
    });

    it("should format COP currency cleanly", () => {
      const formatted = formatMoneyCOP("100000");
      expect(formatted).toContain("100.000");
    });
  });
});

describe("Financial Engine: calendar.ts", () => {
  describe("civil calendar helpers", () => {
    it("should detect leap years correctly", () => {
      expect(isLeapYear(2024)).toBe(true);
      expect(isLeapYear(2026)).toBe(false);
      expect(isLeapYear(2028)).toBe(true);
      expect(isLeapYear(2000)).toBe(true);
      expect(isLeapYear(1900)).toBe(false);
    });

    it("should return the correct number of days per month", () => {
      expect(getDaysInMonth(2026, 1)).toBe(31);
      expect(getDaysInMonth(2026, 2)).toBe(28); // Non-leap year
      expect(getDaysInMonth(2024, 2)).toBe(29); // Leap year
      expect(getDaysInMonth(2028, 2)).toBe(29); // Leap year
      expect(getDaysInMonth(2026, 4)).toBe(30);
      expect(getDaysInMonth(2026, 12)).toBe(31);
    });

    it("should parse civil dates without timezone drift", () => {
      expect(parseCivilDate("2026-03-15")).toEqual({ year: 2026, month: 3, day: 15 });
      expect(parseCivilDate("2027-12-31")).toEqual({ year: 2027, month: 12, day: 31 });
      expect(() => parseCivilDate("2026-02-29")).toThrow(); // 2026 is not leap
      expect(() => parseCivilDate("invalid-date")).toThrow();
    });

    it("should clamp days properly to month boundaries", () => {
      expect(clampDayToMonth(2026, 2, 31)).toBe(28);
      expect(clampDayToMonth(2024, 2, 31)).toBe(29);
      expect(clampDayToMonth(2026, 4, 31)).toBe(30);
      expect(clampDayToMonth(2026, 5, 31)).toBe(31);
    });
  });

  describe("calculateStatementClosingDate", () => {
    it("should assign to same month if purchase day <= closing day", () => {
      // Purchase: March 15, Closing day: 20 -> March 20
      expect(calculateStatementClosingDate("2026-03-15", 20)).toBe("2026-03-20");

      // Purchase on the exact closing day: March 20, Closing day: 20 -> March 20
      expect(calculateStatementClosingDate("2026-03-20", 20)).toBe("2026-03-20");
    });

    it("should assign to next month if purchase day > closing day", () => {
      // Purchase: March 21, Closing day: 20 -> April 20
      expect(calculateStatementClosingDate("2026-03-21", 20)).toBe("2026-04-20");
    });

    it("should wrap to January of next year when purchase occurs after December cutoff", () => {
      // Purchase: Dec 25, Closing day: 20 -> Jan 20 of next year
      expect(calculateStatementClosingDate("2026-12-25", 20)).toBe("2027-01-20");
    });

    it("should clamp closing day to the end of month (e.g. Feb 28/29 or Apr 30)", () => {
      // Closing day: 31, February 2027 (non-leap) -> 2027-02-28
      expect(calculateStatementClosingDate("2027-02-10", 31)).toBe("2027-02-28");

      // Closing day: 31, February 2028 (leap year) -> 2028-02-29
      expect(calculateStatementClosingDate("2028-02-10", 31)).toBe("2028-02-29");

      // Closing day: 31, March 31 purchase -> 2026-03-31
      expect(calculateStatementClosingDate("2026-03-31", 31)).toBe("2026-03-31");

      // Closing day: 31, March 15 purchase with closing day 30 -> 2026-03-30
      expect(calculateStatementClosingDate("2026-03-15", 30)).toBe("2026-03-30");

      // Closing day: 31, April 15 purchase -> 2026-04-30 (April has 30 days)
      expect(calculateStatementClosingDate("2026-04-15", 31)).toBe("2026-04-30");
    });

    it("should throw for invalid closing day", () => {
      expect(() => calculateStatementClosingDate("2026-03-15", 0)).toThrow();
      expect(() => calculateStatementClosingDate("2026-03-15", 32)).toThrow();
    });
  });

  describe("calculatePaymentDueDate", () => {
    it("should assign payment date in the same month if payment_due_day > closing_day", () => {
      // Closing day: 5, Payment day: 25 -> Closing: March 5 -> Payment: March 25
      expect(calculatePaymentDueDate("2026-03-05", 5, 25)).toBe("2026-03-25");
    });

    it("should assign payment date in the following month if payment_due_day <= closing_day", () => {
      // Closing day: 20, Payment day: 5 -> Closing: March 20 -> Payment: April 5
      expect(calculatePaymentDueDate("2026-03-20", 20, 5)).toBe("2026-04-05");

      // Closing day: 31, Payment day: 31 -> Closing: Feb 28 -> Payment: March 31
      expect(calculatePaymentDueDate("2027-02-28", 31, 31)).toBe("2027-03-31");
    });

    it("should wrap year when closing is in December and payment due is following month", () => {
      // Closing date: 2026-12-20, closingDay: 20, paymentDueDay: 5 -> 2027-01-05
      expect(calculatePaymentDueDate("2026-12-20", 20, 5)).toBe("2027-01-05");
    });

    it("should clamp payment due date when target month has fewer days", () => {
      // Closing: Jan 31, closingDay: 31, paymentDueDay: 31 -> February (non-leap) -> Feb 28
      expect(calculatePaymentDueDate("2027-01-31", 31, 31)).toBe("2027-02-28");

      // Closing: Jan 31, closingDay: 31, paymentDueDay: 31 -> February (leap 2028) -> Feb 29
      expect(calculatePaymentDueDate("2028-01-31", 31, 31)).toBe("2028-02-29");

      // Closing: March 31, closingDay: 31, paymentDueDay: 31 -> April (30 days) -> April 30
      expect(calculatePaymentDueDate("2026-03-31", 31, 31)).toBe("2026-04-30");
    });

    it("should throw for invalid days", () => {
      expect(() => calculatePaymentDueDate("2026-03-20", 0, 5)).toThrow();
      expect(() => calculatePaymentDueDate("2026-03-20", 20, 35)).toThrow();
    });
  });
});
