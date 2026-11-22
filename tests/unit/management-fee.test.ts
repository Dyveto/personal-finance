import { describe, it, expect } from "vitest";
import { evaluateManagementFee } from "@/lib/finance/management-fee";
import {
  CreditCardAccountSchema,
  StandardAccountSchema,
  ManagementFeeTypeSchema,
} from "@/lib/validations/account";

describe("Credit Card Management Fee - Domain Logic & Modality Rules", () => {
  describe("Modalidad: fixed_monthly (Cobro mensual fijo se use o no la tarjeta)", () => {
    it("debe cobrar la cuota pactada (caso real Nu $12.000 COP) cuando hubo uso en el mes", () => {
      const result = evaluateManagementFee({
        feeAmount: "12000.00",
        feeType: "fixed_monthly",
        hasUsageInPeriod: true,
      });

      expect(result.applies).toBe(true);
      expect(result.calculatedFee).toBe("12000.00");
      expect(result.feeType).toBe("fixed_monthly");
      expect(result.reason).toContain("Cobro mensual fijo");
    });

    it("debe cobrar la cuota pactada (caso real Nu $12.000 COP) incluso si NO hubo uso ni compras en el mes", () => {
      const result = evaluateManagementFee({
        feeAmount: 12000,
        feeType: "fixed_monthly",
        hasUsageInPeriod: false,
      });

      expect(result.applies).toBe(true);
      expect(result.calculatedFee).toBe("12000.00");
      expect(result.feeType).toBe("fixed_monthly");
      expect(result.reason).toContain("Cobro mensual fijo");
    });
  });

  describe("Modalidad: only_on_use (Cobro solo si se usa en el período)", () => {
    it("debe cobrar la cuota si se registraron compras o saldo en el período", () => {
      const result = evaluateManagementFee({
        feeAmount: "15500.00",
        feeType: "only_on_use",
        hasUsageInPeriod: true,
      });

      expect(result.applies).toBe(true);
      expect(result.calculatedFee).toBe("15500.00");
      expect(result.reason).toContain("por registrar uso");
    });

    it("debe eximir de cuota ($0.00) si NO se registraron compras ni saldo en el período", () => {
      const result = evaluateManagementFee({
        feeAmount: "15500.00",
        feeType: "only_on_use",
        hasUsageInPeriod: false,
      });

      expect(result.applies).toBe(false);
      expect(result.calculatedFee).toBe("0.00");
      expect(result.reason).toContain("no se registró uso");
    });
  });

  describe("Modalidad: exempt_if_used (Exonerada si se usa / cobro por inactividad)", () => {
    it("debe exonerar la cuota ($0.00) si el usuario usó la tarjeta en el período", () => {
      const result = evaluateManagementFee({
        feeAmount: "25000.00",
        feeType: "exempt_if_used",
        hasUsageInPeriod: true,
      });

      expect(result.applies).toBe(false);
      expect(result.calculatedFee).toBe("0.00");
      expect(result.reason).toContain("Exonerada");
    });

    it("debe cobrar la cuota si el usuario NO usó la tarjeta en el período", () => {
      const result = evaluateManagementFee({
        feeAmount: "25000.00",
        feeType: "exempt_if_used",
        hasUsageInPeriod: false,
      });

      expect(result.applies).toBe(true);
      expect(result.calculatedFee).toBe("25000.00");
      expect(result.reason).toContain("no registrar el uso mínimo");
    });
  });

  describe("Modalidad: exempt (Exenta permanente / Sin cuota de manejo)", () => {
    it("debe devolver siempre 0.00 y no aplicar cuota, con o sin uso", () => {
      const withUsage = evaluateManagementFee({
        feeAmount: "0.00",
        feeType: "exempt",
        hasUsageInPeriod: true,
      });
      expect(withUsage.applies).toBe(false);
      expect(withUsage.calculatedFee).toBe("0.00");

      const withoutUsage = evaluateManagementFee({
        feeAmount: "0.00",
        feeType: "exempt",
        hasUsageInPeriod: false,
      });
      expect(withoutUsage.applies).toBe(false);
      expect(withoutUsage.calculatedFee).toBe("0.00");
    });

    it("debe tratar una cuota de 0.00 o vacía como exenta sin importar la modalidad", () => {
      const result = evaluateManagementFee({
        feeAmount: 0,
        feeType: "fixed_monthly",
        hasUsageInPeriod: true,
      });

      expect(result.applies).toBe(false);
      expect(result.calculatedFee).toBe("0.00");
    });
  });

  describe("Aritmética y Preservación de Centavos COP NUMERIC(12,2)", () => {
    it("preserva centavos exactos sin pérdida de precisión", () => {
      const result = evaluateManagementFee({
        feeAmount: "12345.67",
        feeType: "fixed_monthly",
        hasUsageInPeriod: false,
      });

      expect(result.calculatedFee).toBe("12345.67");
    });

    it("redondea centavos adecuadamente con política bancaria ROUND_HALF_UP", () => {
      const result = evaluateManagementFee({
        feeAmount: 12345.678,
        feeType: "fixed_monthly",
        hasUsageInPeriod: true,
      });

      expect(result.calculatedFee).toBe("12345.68");
    });
  });
});

describe("Credit Card Management Fee - Zod Schema Validation", () => {
  it("valida modalidades válidas en ManagementFeeTypeSchema", () => {
    expect(ManagementFeeTypeSchema.safeParse("fixed_monthly").success).toBe(true);
    expect(ManagementFeeTypeSchema.safeParse("only_on_use").success).toBe(true);
    expect(ManagementFeeTypeSchema.safeParse("exempt_if_used").success).toBe(true);
    expect(ManagementFeeTypeSchema.safeParse("exempt").success).toBe(true);
    expect(ManagementFeeTypeSchema.safeParse("invalid_fee").success).toBe(false);
  });

  it("acepta una tarjeta de crédito válida con cuota de manejo fija (Nu)", () => {
    const cardData = {
      name: "Nu Mastercard",
      account_type: "credit_card",
      institution: "Nu Colombia",
      currency: "COP",
      initial_balance: "0.00",
      credit_limit: "5000000.00",
      closing_day: 15,
      payment_due_day: 5,
      management_fee: "12000.00",
      management_fee_type: "fixed_monthly",
    };

    const parsed = CreditCardAccountSchema.safeParse(cardData);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.management_fee).toBe(12000);
      expect(parsed.data.management_fee_type).toBe("fixed_monthly");
    }
  });

  it("asigna valores por defecto coherentes (0 y exempt) si se omiten en tarjetas de crédito", () => {
    const cardData = {
      name: "Tarjeta Sin Cuota",
      account_type: "credit_card",
      institution: "Banco",
      currency: "COP",
      initial_balance: "0.00",
      credit_limit: "2000000.00",
      closing_day: 10,
      payment_due_day: 25,
    };

    const parsed = CreditCardAccountSchema.safeParse(cardData);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.management_fee).toBe(0);
      expect(parsed.data.management_fee_type).toBe("exempt");
    }
  });

  it("rechaza cuotas de manejo negativas en tarjetas de crédito", () => {
    const cardData = {
      name: "Tarjeta Negativa",
      account_type: "credit_card",
      institution: "Banco",
      currency: "COP",
      initial_balance: "0.00",
      credit_limit: "2000000.00",
      closing_day: 10,
      payment_due_day: 25,
      management_fee: "-5000.00",
      management_fee_type: "fixed_monthly",
    };

    const parsed = CreditCardAccountSchema.safeParse(cardData);
    expect(parsed.success).toBe(false);
  });

  it("rechaza cuota de manejo no nula en cuentas estándar (efectivo y bancos)", () => {
    const bankData = {
      name: "Cuenta Ahorros",
      account_type: "bank",
      currency: "COP",
      initial_balance: "100000.00",
      management_fee: 10000,
    };

    const parsed = StandardAccountSchema.safeParse(bankData);
    expect(parsed.success).toBe(false);
  });
});
