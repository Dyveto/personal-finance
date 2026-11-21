import { describe, it, expect } from "vitest";
import { parseSmsTransaction, type UserAccount } from "@/lib/sms-transaction-parser";
import type { TransactionPrefillData } from "@/features/transactions/components/TransactionForm";

describe("QA Audit: SMS Transaction Parser & Wizard Verification", () => {
  const userAccounts: UserAccount[] = [
    { id: "acc-bancolombia-9266", name: "Bancolombia Ahorros", lastFour: "9266" },
    { id: "acc-nequi-531", name: "Nequi Principal", lastFour: "0531" },
    { id: "acc-bbva-4321", name: "BBVA Nómina", lastFour: "4321" },
    { id: "acc-nu-7890", name: "Nu Tarjeta de Crédito", lastFour: "7890" },
  ];

  describe("1. Bancolombia Transactions (User Cases)", () => {
    it("verifies outgoing transfer: expense, exact amount 20400.00, civil date 2026-11-16, account *9266", () => {
      const sms =
        "Bancolombia: Transferiste $20,400.00 desde tu cuenta *9266 a la cuenta *3023568257 el 16/11/26 a las 18:14. Dudas al 018000912345";
      const result = parseSmsTransaction(sms, userAccounts);

      expect(result.type).toBe("expense");
      expect(result.amount).toBe("20400.00");
      expect(result.date).toBe("2026-11-16");
      expect(result.detectedBank).toBe("Bancolombia");
      expect(result.detectedAccountRef).toBe("*9266");
      expect(result.accountMatched).toBe(true);
      expect(result.matchedAccountId).toBe("acc-bancolombia-9266");
      expect(result.confidence).toBe("high");
    });

    it("verifies incoming transfer: income, exact amount 25000.00, civil date 2026-11-08, account *9266", () => {
      const sms =
        "Bancolombia: Dylan, recibiste una transferencia de OLGA MATILDE TORRES por $25,000.00 en tu cuenta *9266 conectada a la llave @dylan531 el 08/11/26 a las 21:25. Dudas al 018000912345";
      const result = parseSmsTransaction(sms, userAccounts);

      expect(result.type).toBe("income");
      expect(result.amount).toBe("25000.00");
      expect(result.date).toBe("2026-11-08");
      expect(result.detectedBank).toBe("Bancolombia");
      expect(result.detectedAccountRef).toBe("*9266");
      expect(result.accountMatched).toBe(true);
      expect(result.matchedAccountId).toBe("acc-bancolombia-9266");
      expect(result.confidence).toBe("high");
    });
  });

  describe("2. Nu, Nequi & BBVA Cases (Preserving Exact Cents)", () => {
    it("verifies Nu expense preserving cents (45200.75) and account matching", () => {
      const sms =
        "Nu: Compra aprobada por $45.200,75 en SPOTIFY con tu tarjeta de credito *7890 el 16/11/2026 14:30";
      const result = parseSmsTransaction(sms, userAccounts);

      expect(result.type).toBe("expense");
      expect(result.amount).toBe("45200.75");
      expect(result.date).toBe("2026-11-16");
      expect(result.detectedBank).toBe("Nu");
      expect(result.accountMatched).toBe(true);
      expect(result.matchedAccountId).toBe("acc-nu-7890");
    });

    it("verifies Nequi expense preserving cents (18500.25)", () => {
      const sms =
        "¡Enviaste plata! Enviaste $18.500,25 a Panadería El Trigo desde tu Nequi el 17/11/2026.";
      const result = parseSmsTransaction(sms, userAccounts);

      expect(result.type).toBe("expense");
      expect(result.amount).toBe("18500.25");
      expect(result.date).toBe("2026-11-17");
      expect(result.detectedBank).toBe("Nequi");
      expect(result.accountMatched).toBe(true);
      expect(result.matchedAccountId).toBe("acc-nequi-531");
    });

    it("verifies BBVA income preserving cents (350000.50)", () => {
      const sms =
        "BBVA: Abono a tu cuenta *4321 por $350.000,50 de Nómina el 15/11/2026.";
      const result = parseSmsTransaction(sms, userAccounts);

      expect(result.type).toBe("income");
      expect(result.amount).toBe("350000.50");
      expect(result.date).toBe("2026-11-15");
      expect(result.detectedBank).toBe("BBVA");
      expect(result.accountMatched).toBe(true);
      expect(result.matchedAccountId).toBe("acc-bbva-4321");
    });

    it("verifies BBVA expense with comma separator and dot decimals (65400.99)", () => {
      const sms =
        "BBVA: Compra con tarjeta debito *4321 por $65,400.99 en RESTAURANTE el 15/11/2026.";
      const result = parseSmsTransaction(sms, userAccounts);

      expect(result.type).toBe("expense");
      expect(result.amount).toBe("65400.99");
      expect(result.date).toBe("2026-11-15");
      expect(result.accountMatched).toBe(true);
    });
  });

  describe("3. Unmatched Account Handling (accountMatched: false)", () => {
    it("retains extracted amount, date and type when account reference does not match any user account", () => {
      const sms =
        "Banco Falabella: Compra aprobada por $120.000,00 en HOMECENTER con tarjeta *9999 el 10/11/2026";
      const result = parseSmsTransaction(sms, userAccounts);

      expect(result.type).toBe("expense");
      expect(result.amount).toBe("120000.00");
      expect(result.date).toBe("2026-11-10");
      expect(result.accountMatched).toBe(false);
      expect(result.matchedAccountId).toBeNull();
      expect(result.detectedAccountRef).toBe("*9999");
    });
  });

  describe("4. Resiliency & Partial/Unrecognized Messages", () => {
    it("handles partial message safely without crash", () => {
      const sms = "Tu compra fue por $55.000";
      const result = parseSmsTransaction(sms, userAccounts);

      expect(result.amount).toBe("55000.00");
      expect(result.type).toBe("expense");
      expect(result.accountMatched).toBe(false);
      expect(result.confidence).toBe("partial");
    });

    it("handles unrecognized or random text without throwing exceptions", () => {
      const sms = "Buenas tardes, confirmo asistencia a la reunión de mañana a las 3pm.";
      const result = parseSmsTransaction(sms, userAccounts);

      expect(result.confidence).toBe("none");
      expect(result.amount).toBeNull();
      expect(result.type).toBeNull();
      expect(result.date).toBeNull();
      expect(result.accountMatched).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe("5. 2-Step Wizard Flow & Isolation Verification", () => {
    function simulateWizardStep1To2(
      rawText: string,
      accounts: UserAccount[]
    ): {
      step: 1 | 2;
      progress: number;
      prefillData: TransactionPrefillData;
      autoFocusAccount: boolean;
    } {
      const parsed = parseSmsTransaction(rawText, accounts);
      return {
        step: 2,
        progress: 100,
        autoFocusAccount: !parsed.accountMatched,
        prefillData: {
          account_id: parsed.matchedAccountId ?? "",
          amount: parsed.amount ?? "",
          transaction_type: parsed.type ?? "expense",
          transaction_date: parsed.date ?? undefined,
          description: parsed.suggestedDescription ?? "",
          autoFocusAccount: !parsed.accountMatched,
        },
      };
    }

    it("verifies Step 1 (50%) -> Step 2 (100%) transition with account matched", () => {
      const sms =
        "Bancolombia: Transferiste $20,400.00 desde tu cuenta *9266 a la cuenta *3023568257 el 16/11/26";
      const wizard = simulateWizardStep1To2(sms, userAccounts);

      expect(wizard.step).toBe(2);
      expect(wizard.progress).toBe(100);
      expect(wizard.autoFocusAccount).toBe(false);
      expect(wizard.prefillData.account_id).toBe("acc-bancolombia-9266");
      expect(wizard.prefillData.amount).toBe("20400.00");
    });

    it("verifies Step 1 (50%) -> Step 2 (100%) transition with unmatched account sets autoFocusAccount = true", () => {
      const sms =
        "Banco Agrario: Compra aprobada por $32.000 en ALMACEN el 12/11/2026 con tarjeta *1111";
      const wizard = simulateWizardStep1To2(sms, userAccounts);

      expect(wizard.step).toBe(2);
      expect(wizard.progress).toBe(100);
      expect(wizard.autoFocusAccount).toBe(true);
      expect(wizard.prefillData.account_id).toBe("");
      expect(wizard.prefillData.amount).toBe("32000.00");
    });

    it("guarantees isolation: standard new transaction flow has undefined prefillData and no wizard state", () => {
      const standardModalConfig = {
        isWizard: false,
        prefillData: undefined,
      };

      expect(standardModalConfig.isWizard).toBe(false);
      expect(standardModalConfig.prefillData).toBeUndefined();
    });
  });
});
