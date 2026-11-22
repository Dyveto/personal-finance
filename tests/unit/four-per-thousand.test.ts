import { describe, it, expect } from "vitest";
import {
  calculateFourPerThousand,
  breakdownFourPerThousand,
  FOUR_PER_THOUSAND_RATE,
} from "@/lib/finance/four-per-thousand";
import {
  StandardAccountSchema,
  CreditCardAccountSchema,
} from "@/lib/validations/account";
import {
  CreateTransactionSchema,
  UpdateTransactionSchema,
} from "@/lib/validations/finance";

describe("4x1000 (GMF) Financial Engine & Decimal Accuracy", () => {
  describe("Constante de tasa (0.4% = 4 por mil)", () => {
    it("debe definir la tasa de 4x1000 exactamente como 0.004", () => {
      expect(FOUR_PER_THOUSAND_RATE.toNumber()).toBe(0.004);
      expect(FOUR_PER_THOUSAND_RATE.times(1000).toNumber()).toBe(4);
    });
  });

  describe("calculateFourPerThousand - Cálculo puro de impuesto", () => {
    it("debe calcular el 4x1000 exacto en montos redondos en COP para cuentas gravadas", () => {
      // 100.000 * 0.004 = 400.00
      expect(calculateFourPerThousand("100000.00", true, "expense")).toBe("400.00");
      // 1.000.000 * 0.004 = 4.000.00
      expect(calculateFourPerThousand(1000000, true, "expense")).toBe("4000.00");
      // 50.000 * 0.004 = 200.00
      expect(calculateFourPerThousand("50000", true, "expense")).toBe("200.00");
      // 10.000 * 0.004 = 40.00
      expect(calculateFourPerThousand(10000, true, "expense")).toBe("40.00");
      // 1.000 * 0.004 = 4.00
      expect(calculateFourPerThousand(1000, true, "expense")).toBe("4.00");
      // 250 * 0.004 = 1.00
      expect(calculateFourPerThousand(250, true, "expense")).toBe("1.00");
    });

    it("debe redondear con precisión decimal bancaria (ROUND_HALF_UP) centavos fraccionarios", () => {
      // 12.35 * 0.004 = 0.0494 -> redondea a 0.05
      expect(calculateFourPerThousand("12.35", true, "expense")).toBe("0.05");
      // 12.60 * 0.004 = 0.0504 -> redondea a 0.05
      expect(calculateFourPerThousand("12.60", true, "expense")).toBe("0.05");
      // 12.875 * 0.004 = 0.0515 -> redondea a 0.05
      expect(calculateFourPerThousand("12.875", true, "expense")).toBe("0.05");
      // 37.50 * 0.004 = 0.1500 -> 0.15
      expect(calculateFourPerThousand("37.50", true, "expense")).toBe("0.15");
      // Caso real transferencia: 1.750.905,00 * 0.004 = 7003.62
      expect(calculateFourPerThousand("1750905.00", true, "expense")).toBe("7003.62");
    });

    it("debe retornar '0.00' cuando la cuenta está exenta (isTaxed = false, ej. Bancolombia exenta o Nequi)", () => {
      expect(calculateFourPerThousand("1000000.00", false, "expense")).toBe("0.00");
      expect(calculateFourPerThousand("500000.00", false, "expense")).toBe("0.00");
      expect(calculateFourPerThousand("10000.00", false, "expense")).toBe("0.00");
    });

    it("debe retornar '0.00' para ingresos (transactionType = 'income') incluso en cuentas gravadas", () => {
      // El 4x1000 grava los débitos/salidas, nunca los abonos o ingresos recibidos
      expect(calculateFourPerThousand("2000000.00", true, "income")).toBe("0.00");
      expect(calculateFourPerThousand("100000.00", true, "income")).toBe("0.00");
    });

    it("debe manejar valores cero, negativos o inválidos devolviendo '0.00'", () => {
      expect(calculateFourPerThousand("0", true, "expense")).toBe("0.00");
      expect(calculateFourPerThousand("-50000", true, "expense")).toBe("0.00");
      expect(calculateFourPerThousand("invalido", true, "expense")).toBe("0.00");
      expect(calculateFourPerThousand(NaN, true, "expense")).toBe("0.00");
      expect(calculateFourPerThousand(Infinity, true, "expense")).toBe("0.00");
    });
  });

  describe("breakdownFourPerThousand - Desglose y suma invariante", () => {
    it("debe generar desglose completo con suma invariante: base + 4x1000 = total (cuenta Nu gravada)", () => {
      const breakdown = breakdownFourPerThousand("500000.00", true, "expense");

      expect(breakdown.baseAmount).toBe("500000.00");
      expect(breakdown.fourPerThousand).toBe("2000.00");
      expect(breakdown.totalAmount).toBe("502000.00");
      expect(breakdown.isTaxed).toBe(true);
    });

    it("debe generar desglose con 4x1000 en 0.00 para cuenta exenta", () => {
      const breakdown = breakdownFourPerThousand("500000.00", false, "expense");

      expect(breakdown.baseAmount).toBe("500000.00");
      expect(breakdown.fourPerThousand).toBe("0.00");
      expect(breakdown.totalAmount).toBe("500000.00");
      expect(breakdown.isTaxed).toBe(false);
    });

    it("debe generar desglose con 4x1000 en 0.00 para ingresos en cuenta gravada", () => {
      const breakdown = breakdownFourPerThousand("1200000.00", true, "income");

      expect(breakdown.baseAmount).toBe("1200000.00");
      expect(breakdown.fourPerThousand).toBe("0.00");
      expect(breakdown.totalAmount).toBe("1200000.00");
      expect(breakdown.isTaxed).toBe(false);
    });

    it("debe conservar los centavos con exactitud en compras pequeñas gravadas", () => {
      // 150.75 * 0.004 = 0.603 -> 0.60
      const breakdown = breakdownFourPerThousand("150.75", true, "expense");

      expect(breakdown.baseAmount).toBe("150.75");
      expect(breakdown.fourPerThousand).toBe("0.60");
      expect(breakdown.totalAmount).toBe("151.35");
      expect(breakdown.isTaxed).toBe(true);
    });
  });

  describe("Validaciones Zod - Esquemas de Cuentas y Transacciones", () => {
    it("StandardAccountSchema debe aceptar has_four_per_thousand = true en cuentas bancarias", () => {
      const parsed = StandardAccountSchema.parse({
        name: "Cuenta de Ahorros Nu",
        account_type: "bank",
        initial_balance: "100000.00",
        institution: "Nu",
        has_four_per_thousand: true,
      });

      expect(parsed.has_four_per_thousand).toBe(true);
      expect(parsed.account_type).toBe("bank");
    });

    it("StandardAccountSchema debe asignar has_four_per_thousand = false por defecto", () => {
      const parsed = StandardAccountSchema.parse({
        name: "Cuenta Bancolombia",
        account_type: "bank",
        initial_balance: "0.00",
      });

      expect(parsed.has_four_per_thousand).toBe(false);
    });

    it("CreditCardAccountSchema no debe contener has_four_per_thousand", () => {
      const parsed = CreditCardAccountSchema.parse({
        name: "Tarjeta de Crédito Bancolombia",
        account_type: "credit_card",
        credit_limit: "5000000.00",
        closing_day: 15,
        payment_due_day: 5,
        management_fee: "0.00",
        management_fee_type: "exempt",
      });

      // No contiene has_four_per_thousand en el esquema de tarjeta
      expect("has_four_per_thousand" in parsed).toBe(false);
    });

    it("CreateTransactionSchema debe aceptar y validar campos de trazabilidad 4x1000", () => {
      const parsed = CreateTransactionSchema.parse({
        account_id: "11111111-1111-4111-a111-111111111111",
        category_id: "22222222-2222-4222-a222-222222222222",
        transaction_type: "expense",
        amount: "502000.00",
        transaction_date: "2026-11-21",
        description: "Transferencia con 4x1000",
        four_per_thousand_amount: "2000.00",
        is_four_per_thousand_applied: true,
      });

      expect(parsed.four_per_thousand_amount).toBe(2000);
      expect(parsed.is_four_per_thousand_applied).toBe(true);
    });

    it("UpdateTransactionSchema debe aceptar campos de trazabilidad 4x1000", () => {
      const parsed = UpdateTransactionSchema.parse({
        amount: "100400.00",
        four_per_thousand_amount: "400.00",
        is_four_per_thousand_applied: true,
      });

      expect(parsed.four_per_thousand_amount).toBe(400);
      expect(parsed.is_four_per_thousand_applied).toBe(true);
    });
  });
});
