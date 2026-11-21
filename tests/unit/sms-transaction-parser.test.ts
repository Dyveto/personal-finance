import { describe, it, expect } from "vitest";
import {
  parseSmsTransaction,
  SmsParseResultSchema,
  UserAccount,
} from "@/lib/sms-transaction-parser";

describe("SMS Transaction Parser & Normalizer (Colombian Financial SMS)", () => {
  const sampleAccounts: UserAccount[] = [
    { id: "acc-bancolombia-1", name: "Bancolombia Ahorros", lastFour: "9266" },
    { id: "acc-nequi-1", name: "Cuenta Nequi", lastFour: "4567" },
    { id: "acc-bbva-1", name: "BBVA Nómina", lastFour: "4321" },
    { id: "acc-nu-1", name: "Tarjeta Crédito Nu", lastFour: "7890" },
  ];

  describe("Bancolombia Notifications", () => {
    it("should parse debit card purchase and ignore 018000 support numbers", () => {
      const sms =
        "Bancolombia le informa compra por $20,400.00 en EXITO CALLE 80 con su t.deb *9266 el 16/11/2026 14:32. Dudas al 018000912345.";
      const result = parseSmsTransaction(sms, sampleAccounts);

      expect(result.type).toBe("expense");
      expect(result.amount).toBe("20400.00");
      expect(result.date).toBe("2026-11-16");
      expect(result.detectedBank).toBe("Bancolombia");
      expect(result.detectedAccountRef).toBe("*9266");
      expect(result.accountMatched).toBe(true);
      expect(result.matchedAccountId).toBe("acc-bancolombia-1");
      expect(result.suggestedDescription).toBe("");
      expect(result.confidence).toBe("high");
      expect(SmsParseResultSchema.safeParse(result).success).toBe(true);
    });

    it("should parse transfer sent with llave (@dylan531)", () => {
      const sms =
        "Bancolombia: Transferiste $50.000 desde cta *9266 a la llave @dylan531 el 15/11/2026 18:20.";
      const result = parseSmsTransaction(sms, sampleAccounts);

      expect(result.type).toBe("expense");
      expect(result.amount).toBe("50000.00");
      expect(result.date).toBe("2026-11-15");
      expect(result.detectedBank).toBe("Bancolombia");
      expect(result.detectedAccountRef).toBe("*9266");
      expect(result.accountMatched).toBe(true);
      expect(result.matchedAccountId).toBe("acc-bancolombia-1");
      expect(result.suggestedDescription).toBe("");
      expect(result.confidence).toBe("high");
    });

    it("should parse transfer sent to another bank account", () => {
      const sms =
        "Bancolombia le informa transferencia por $25,000.00 desde cta *9266 a la cuenta de JUAN PEREZ el 16/11/2026 15:45. Dudas al 018000912345.";
      const result = parseSmsTransaction(sms, sampleAccounts);

      expect(result.type).toBe("expense");
      expect(result.amount).toBe("25000.00");
      expect(result.date).toBe("2026-11-16");
      expect(result.suggestedDescription).toBe("");
      expect(result.accountMatched).toBe(true);
      expect(result.matchedAccountId).toBe("acc-bancolombia-1");
    });

    it("should parse transfer received into user account (income)", () => {
      const sms =
        "Bancolombia le informa transferencia por $150,000.00 en su cta *9266 desde cta de PEDRO GOMEZ el 16/11/2026 09:12. Dudas al 018000912345.";
      const result = parseSmsTransaction(sms, sampleAccounts);

      expect(result.type).toBe("income");
      expect(result.amount).toBe("150000.00");
      expect(result.date).toBe("2026-11-16");
      expect(result.suggestedDescription).toBe("");
      expect(result.accountMatched).toBe(true);
      expect(result.matchedAccountId).toBe("acc-bancolombia-1");
      expect(result.confidence).toBe("high");
    });

    it("should parse transfer received with llave (@dylan531) as income", () => {
      const sms =
        "Bancolombia: Recibiste $80.000,00 en tu cta *9266 de MARI LUZ con llave @dylan531 16/11/2026 11:00.";
      const result = parseSmsTransaction(sms, sampleAccounts);

      expect(result.type).toBe("income");
      expect(result.amount).toBe("80000.00");
      expect(result.date).toBe("2026-11-16");
      expect(result.suggestedDescription).toBe("");
      expect(result.accountMatched).toBe(true);
      expect(result.matchedAccountId).toBe("acc-bancolombia-1");
    });

    it("should parse payroll abono (income)", () => {
      const sms =
        "Bancolombia: Abono a tu cta *9266 por $500.000 de NOMINA el 15/11/2026.";
      const result = parseSmsTransaction(sms, sampleAccounts);

      expect(result.type).toBe("income");
      expect(result.amount).toBe("500000.00");
      expect(result.suggestedDescription).toBe("");
      expect(result.accountMatched).toBe(true);
    });

    it("should parse ATM cash withdrawal (expense)", () => {
      const sms =
        "Bancolombia le informa retiro por $100.000,00 en CAJERO AUT el 16/11/2026 16:00 desde cta *9266.";
      const result = parseSmsTransaction(sms, sampleAccounts);

      expect(result.type).toBe("expense");
      expect(result.amount).toBe("100000.00");
      expect(result.suggestedDescription).toBe("");
      expect(result.accountMatched).toBe(true);
    });
  });

  describe("Nequi Notifications", () => {
    it("should parse money sent and ignore Colombian mobile phone numbers", () => {
      const sms =
        "¡Enviaste plata! Enviaste $25.000 a Juan Perez (3101234567). Si no fuiste tu comunicate ya al 3006000100.";
      const result = parseSmsTransaction(sms, sampleAccounts);

      expect(result.type).toBe("expense");
      expect(result.amount).toBe("25000.00");
      expect(result.detectedBank).toBe("Nequi");
      expect(result.suggestedDescription).toBe("");
    });

    it("should parse money received (income)", () => {
      const sms = "¡Te llegó plata! Dylan te envió $35.000 a tu Nequi. ¡Entra y revisa!";
      const result = parseSmsTransaction(sms, sampleAccounts);

      expect(result.type).toBe("income");
      expect(result.amount).toBe("35000.00");
      expect(result.detectedBank).toBe("Nequi");
      expect(result.accountMatched).toBe(true);
      expect(result.matchedAccountId).toBe("acc-nequi-1");
    });

    it("should parse Nequi merchant purchase", () => {
      const sms =
        "Pagaste $18.500 en DROGUERIA LA REBAJA desde tu Nequi. 16/11/2026.";
      const result = parseSmsTransaction(sms, sampleAccounts);

      expect(result.type).toBe("expense");
      expect(result.amount).toBe("18500.00");
      expect(result.date).toBe("2026-11-16");
      expect(result.suggestedDescription).toBe("");
    });
  });

  describe("BBVA & Nu Notifications", () => {
    it("should parse BBVA debit card purchase", () => {
      const sms =
        "BBVA: Compra con tarjeta debito *4321 por $65.400 en D1 SA el 15/11/2026 19:30. Dudas linea BBVA 018000912222.";
      const result = parseSmsTransaction(sms, sampleAccounts);

      expect(result.type).toBe("expense");
      expect(result.amount).toBe("65400.00");
      expect(result.date).toBe("2026-11-15");
      expect(result.detectedBank).toBe("BBVA");
      expect(result.detectedAccountRef).toBe("*4321");
      expect(result.suggestedDescription).toBe("");
      expect(result.accountMatched).toBe(true);
      expect(result.matchedAccountId).toBe("acc-bbva-1");
    });

    it("should parse BBVA abono (income)", () => {
      const sms = "BBVA: Abono a tu cuenta *4321 por $350.000 el 15/11/2026.";
      const result = parseSmsTransaction(sms, sampleAccounts);

      expect(result.type).toBe("income");
      expect(result.amount).toBe("350000.00");
      expect(result.detectedBank).toBe("BBVA");
      expect(result.accountMatched).toBe(true);
    });

    it("should parse Nu credit card approved purchase", () => {
      const sms =
        "Nu: Compra aprobada por $45.200,00 en SPOTIFY con tu tarjeta de credito *7890 el 16/11/2026.";
      const result = parseSmsTransaction(sms, sampleAccounts);

      expect(result.type).toBe("expense");
      expect(result.amount).toBe("45200.00");
      expect(result.date).toBe("2026-11-16");
      expect(result.detectedBank).toBe("Nu");
      expect(result.detectedAccountRef).toBe("*7890");
      expect(result.suggestedDescription).toBe("");
      expect(result.accountMatched).toBe(true);
      expect(result.matchedAccountId).toBe("acc-nu-1");
    });

    it("should parse Nu received transfer", () => {
      const sms = "Nu: Recibiste una transferencia por $50.000 de Maria en tu cuenta Nu.";
      const result = parseSmsTransaction(sms, sampleAccounts);

      expect(result.type).toBe("income");
      expect(result.amount).toBe("50000.00");
      expect(result.detectedBank).toBe("Nu");
      expect(result.suggestedDescription).toBe("");
    });
  });

  describe("Date Normalization & Formats", () => {
    it("should normalize 2-digit years correctly (e.g. 16/11/26 -> 2026-11-16)", () => {
      const sms = "Bancolombia: Compra por $10.000 en TIENDA el 16/11/26.";
      const result = parseSmsTransaction(sms);
      expect(result.date).toBe("2026-11-16");
    });

    it("should normalize dates with leading zero days (e.g. 08/11/26 -> 2026-11-08)", () => {
      const sms = "Bancolombia: Compra por $10.000 en TIENDA el 08/11/26.";
      const result = parseSmsTransaction(sms);
      expect(result.date).toBe("2026-11-08");
    });

    it("should normalize textual dates (e.g. 16 de noviembre 2026)", () => {
      const sms = "Transaccion por $30.000 el 16 de noviembre 2026.";
      const result = parseSmsTransaction(sms);
      expect(result.date).toBe("2026-11-16");
    });
  });

  describe("Amount Decimal Precision and Formats", () => {
    it("should format amounts without decimals with exact .00", () => {
      const sms = "Compra por $25000 en TIENDA.";
      const result = parseSmsTransaction(sms);
      expect(result.amount).toBe("25000.00");
    });

    it("should format amounts with thousand dots and comma decimals", () => {
      const sms = "Compra por $20.400,50 en TIENDA.";
      const result = parseSmsTransaction(sms);
      expect(result.amount).toBe("20400.50");
    });

    it("should format amounts with thousand commas and dot decimals", () => {
      const sms = "Compra por $20,400.75 en TIENDA.";
      const result = parseSmsTransaction(sms);
      expect(result.amount).toBe("20400.75");
    });
  });

  describe("Account Matching & Ambiguity Handling", () => {
    it("should match by bank name when no lastFour is provided in SMS but exactly one account matches", () => {
      const accounts: UserAccount[] = [
        { id: "acc-davivienda", name: "Daviplata Ahorros" },
        { id: "acc-bogota", name: "Banco de Bogotá" },
      ];
      const sms = "Daviplata: Pagaste $15.000 en PANADERIA el 16/11/2026.";
      const result = parseSmsTransaction(sms, accounts);

      expect(result.detectedBank).toBe("Davivienda");
      expect(result.accountMatched).toBe(true);
      expect(result.matchedAccountId).toBe("acc-davivienda");
    });

    it("should warn and not match if multiple user accounts share the same bank name without lastFour", () => {
      const accounts: UserAccount[] = [
        { id: "acc-banc-1", name: "Bancolombia Ahorros" },
        { id: "acc-banc-2", name: "Bancolombia Corriente" },
      ];
      const sms = "Bancolombia: Compra por $20.000 en D1 el 16/11/2026.";
      const result = parseSmsTransaction(sms, accounts);

      expect(result.accountMatched).toBe(false);
      expect(result.matchedAccountId).toBeNull();
      expect(result.warnings.some((w) => w.includes("varias cuentas"))).toBe(true);
    });

    it("should handle empty accounts list gracefully", () => {
      const sms = "Bancolombia: Compra por $20.000 con *9266 el 16/11/2026.";
      const result = parseSmsTransaction(sms, []);

      expect(result.accountMatched).toBe(false);
      expect(result.matchedAccountId).toBeNull();
      expect(result.detectedAccountRef).toBe("*9266");
    });
  });

  describe("Edge cases & Error Safety", () => {
    it("should handle empty or whitespace text without throwing", () => {
      const result = parseSmsTransaction("   ");
      expect(result.confidence).toBe("none");
      expect(result.amount).toBeNull();
      expect(result.type).toBeNull();
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(SmsParseResultSchema.safeParse(result).success).toBe(true);
    });

    it("should handle arbitrary non-banking text safely", () => {
      const result = parseSmsTransaction("Hola mamá, nos vemos a las 5 para almorzar.");
      expect(result.confidence).toBe("none");
      expect(result.amount).toBeNull();
      expect(result.type).toBeNull();
      expect(result.detectedBank).toBeNull();
      expect(SmsParseResultSchema.safeParse(result).success).toBe(true);
    });
  });
});
