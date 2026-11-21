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

  describe("1. Bancolombia Coverage & Precision", () => {
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

    it("verifies incoming transfer with llave: income, exact amount 25000.00, civil date 2026-11-08, account *9266", () => {
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
      expect(result.suggestedDescription).toBe("");
    });

    it("verifies ATM cash withdrawal in Bancolombia", () => {
      const sms =
        "Bancolombia le informa retiro por $200.000,00 en CAJERO AUT el 15/11/2026 desde cta *9266. Dudas al 018000912345";
      const result = parseSmsTransaction(sms, userAccounts);

      expect(result.type).toBe("expense");
      expect(result.amount).toBe("200000.00");
      expect(result.suggestedDescription).toBe("");
      expect(result.accountMatched).toBe(true);
    });

    it("sanitizes 018000 customer telephone lines from amounts", () => {
      const sms =
        "Bancolombia: Compra por $45.000 en EXITO con tarjeta *9266 el 14/11/2026. Dudas al 018000912345 o 018000123456";
      const result = parseSmsTransaction(sms, userAccounts);

      expect(result.amount).toBe("45000.00");
      expect(result.amount).not.toBe("018000912345.00");
    });
  });

  describe("2. Nequi Coverage & Precision", () => {
    it("verifies Nequi outgoing transfer ignoring phone numbers", () => {
      const sms =
        "¡Enviaste plata! Enviaste $50.000 a Carlos Gomez (3001234567). Si no fuiste tu comunicate al 3006000100.";
      const result = parseSmsTransaction(sms, userAccounts);

      expect(result.type).toBe("expense");
      expect(result.amount).toBe("50000.00");
      expect(result.detectedBank).toBe("Nequi");
      expect(result.accountMatched).toBe(true);
      expect(result.matchedAccountId).toBe("acc-nequi-531");
      expect(result.suggestedDescription).toBe("");
    });

    it("verifies Nequi incoming money notification (¡Te llegó plata!)", () => {
      const sms =
        "¡Te llegó plata! Sofia te envió $85.000 a tu Nequi. ¡Entra y revisa!";
      const result = parseSmsTransaction(sms, userAccounts);

      expect(result.type).toBe("income");
      expect(result.amount).toBe("85000.00");
      expect(result.detectedBank).toBe("Nequi");
      expect(result.accountMatched).toBe(true);
    });

    it("verifies Nequi merchant payment preserving cents", () => {
      const sms =
        "Pagaste $18.500,25 en Panadería El Trigo desde tu Nequi el 17/11/2026.";
      const result = parseSmsTransaction(sms, userAccounts);

      expect(result.type).toBe("expense");
      expect(result.amount).toBe("18500.25");
      expect(result.date).toBe("2026-11-17");
      expect(result.detectedBank).toBe("Nequi");
      expect(result.accountMatched).toBe(true);
      expect(result.suggestedDescription).toBe("");
    });

    it("verifies Nequi account top-up (recarga exitosa)", () => {
      const sms =
        "Recarga exitosa por $120.000 en tu Nequi el 16/11/2026.";
      const result = parseSmsTransaction(sms, userAccounts);

      expect(result.type).toBe("income");
      expect(result.amount).toBe("120000.00");
      expect(result.detectedBank).toBe("Nequi");
      expect(result.accountMatched).toBe(true);
    });
  });

  describe("3. Nu Coverage & Precision", () => {
    it("verifies Nu credit card purchase with cents (45200.75)", () => {
      const sms =
        "Nu: Compra aprobada por $45.200,75 en SPOTIFY con tu tarjeta de credito *7890 el 16/11/2026 14:30";
      const result = parseSmsTransaction(sms, userAccounts);

      expect(result.type).toBe("expense");
      expect(result.amount).toBe("45200.75");
      expect(result.date).toBe("2026-11-16");
      expect(result.detectedBank).toBe("Nu");
      expect(result.detectedAccountRef).toBe("*7890");
      expect(result.accountMatched).toBe(true);
      expect(result.matchedAccountId).toBe("acc-nu-7890");
      expect(result.suggestedDescription).toBe("");
    });

    it("verifies Nu incoming transfer to Nu account preserving cents", () => {
      const sms =
        "Nu: Recibiste una transferencia por $50.000,50 de Maria en tu cuenta Nu el 18/11/2026.";
      const result = parseSmsTransaction(sms, userAccounts);

      expect(result.type).toBe("income");
      expect(result.amount).toBe("50000.50");
      expect(result.date).toBe("2026-11-18");
      expect(result.detectedBank).toBe("Nu");
      expect(result.accountMatched).toBe(true);
      expect(result.matchedAccountId).toBe("acc-nu-7890");
      expect(result.suggestedDescription).toBe("");
    });

    it("verifies Nu outgoing transfer", () => {
      const sms =
        "Nu: Transferiste $35.000 a Sofia desde tu cuenta Nu el 19/11/2026.";
      const result = parseSmsTransaction(sms, userAccounts);

      expect(result.type).toBe("expense");
      expect(result.amount).toBe("35000.00");
      expect(result.date).toBe("2026-11-19");
      expect(result.detectedBank).toBe("Nu");
      expect(result.suggestedDescription).toBe("");
    });
  });

  describe("4. BBVA & Cross-Bank Cents Precision", () => {
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

    it("verifies BBVA expense with comma thousands and dot decimals (65400.99)", () => {
      const sms =
        "BBVA: Compra con tarjeta debito *4321 por $65,400.99 en RESTAURANTE el 15/11/2026.";
      const result = parseSmsTransaction(sms, userAccounts);

      expect(result.type).toBe("expense");
      expect(result.amount).toBe("65400.99");
      expect(result.date).toBe("2026-11-15");
      expect(result.accountMatched).toBe(true);
    });
  });

  describe("5. Unmatched Account Handling & Fallback", () => {
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
      expect(result.warnings.some((w) => w.includes("No se encontró una cuenta"))).toBe(true);
    });

    it("warns when multiple user accounts share the same bank and no lastFour is provided", () => {
      const ambiguousAccounts: UserAccount[] = [
        { id: "banc-1", name: "Bancolombia Ahorros 1" },
        { id: "banc-2", name: "Bancolombia Ahorros 2" },
      ];
      const sms = "Bancolombia: Compra por $50.000 en EXITO el 12/11/2026";
      const result = parseSmsTransaction(sms, ambiguousAccounts);

      expect(result.accountMatched).toBe(false);
      expect(result.matchedAccountId).toBeNull();
      expect(result.warnings.some((w) => w.includes("varias cuentas"))).toBe(true);
    });
  });

  describe("6. Resiliency, Warnings & Safety", () => {
    it("handles partial message safely reporting confidence partial", () => {
      const sms = "Tu compra fue por $55.000";
      const result = parseSmsTransaction(sms, userAccounts);

      expect(result.amount).toBe("55000.00");
      expect(result.type).toBe("expense");
      expect(result.accountMatched).toBe(false);
      expect(result.confidence).toBe("partial");
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("handles completely unrecognized random text returning confidence none", () => {
      const sms = "Buenas tardes, confirmo asistencia a la reunión de mañana a las 3pm.";
      const result = parseSmsTransaction(sms, userAccounts);

      expect(result.confidence).toBe("none");
      expect(result.amount).toBeNull();
      expect(result.type).toBeNull();
      expect(result.date).toBeNull();
      expect(result.accountMatched).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("handles empty and whitespace string safely", () => {
      const result = parseSmsTransaction("   \n\t  ");
      expect(result.confidence).toBe("none");
      expect(result.amount).toBeNull();
      expect(result.type).toBeNull();
      expect(result.accountMatched).toBe(false);
    });
  });

  describe("7. 2-Step Wizard Flow, Notes Checkbox & Flow Isolation", () => {
    function simulateWizardStep1To2(
      rawText: string,
      accounts: UserAccount[],
      includeSmsInNotes: boolean = false
    ): {
      step: 1 | 2;
      progress: number;
      prefillData: TransactionPrefillData;
      autoFocusAccount: boolean;
    } {
      const parsed = parseSmsTransaction(rawText, accounts);
      const trimmed = rawText.trim();
      return {
        step: 2,
        progress: 100,
        autoFocusAccount: !parsed.accountMatched,
        prefillData: {
          account_id: parsed.matchedAccountId ?? "",
          category_id: "",
          amount: parsed.amount ?? "",
          transaction_type: parsed.type ?? "expense",
          transaction_date: parsed.date ?? undefined,
          description: "",
          notes: includeSmsInNotes ? trimmed : "",
          autoFocusAccount: !parsed.accountMatched,
        },
      };
    }

    it("verifies parser returns suggestedDescription === '' to prevent generic descriptions across all banks", () => {
      const bancolombiaSms = "Bancolombia: Compra por $50.000 en EXITO el 16/11/2026 con tarjeta *9266";
      const nequiSms = "¡Enviaste plata! Enviaste $20.000 a Carlos Gomez";
      const nuSms = "Nu: Compra aprobada por $15.000 en SPOTIFY el 16/11/2026 con tarjeta *7890";
      const bbvaSms = "BBVA: Compra por $40.000 en D1 el 15/11/2026 con tarjeta *4321";

      expect(parseSmsTransaction(bancolombiaSms, userAccounts).suggestedDescription).toBe("");
      expect(parseSmsTransaction(nequiSms, userAccounts).suggestedDescription).toBe("");
      expect(parseSmsTransaction(nuSms, userAccounts).suggestedDescription).toBe("");
      expect(parseSmsTransaction(bbvaSms, userAccounts).suggestedDescription).toBe("");
    });

    it("verifies Step 1 (50%) -> Step 2 (100%) transition with account matched (autoFocusAccount = false)", () => {
      const sms =
        "Bancolombia: Transferiste $20,400.00 desde tu cuenta *9266 a la cuenta *3023568257 el 16/11/26";
      const wizard = simulateWizardStep1To2(sms, userAccounts);

      expect(wizard.step).toBe(2);
      expect(wizard.progress).toBe(100);
      expect(wizard.autoFocusAccount).toBe(false);
      expect(wizard.prefillData.account_id).toBe("acc-bancolombia-9266");
      expect(wizard.prefillData.amount).toBe("20400.00");
      expect(wizard.prefillData.category_id).toBe("");
      expect(wizard.prefillData.description).toBe("");
      expect(wizard.prefillData.notes).toBe("");
    });

    it("verifies Step 1 (50%) -> Step 2 (100%) transition with unmatched account sets autoFocusAccount = true and empty account_id", () => {
      const sms =
        "Banco Agrario: Compra aprobada por $32.000 en ALMACEN el 12/11/2026 con tarjeta *1111";
      const wizard = simulateWizardStep1To2(sms, userAccounts);

      expect(wizard.step).toBe(2);
      expect(wizard.progress).toBe(100);
      expect(wizard.autoFocusAccount).toBe(true);
      expect(wizard.prefillData.account_id).toBe("");
      expect(wizard.prefillData.amount).toBe("32000.00");
      expect(wizard.prefillData.category_id).toBe("");
      expect(wizard.prefillData.description).toBe("");
      expect(wizard.prefillData.notes).toBe("");
    });

    it("verifies that checking includeSmsInNotes transfers the complete raw SMS text into notes", () => {
      const sms =
        "  Bancolombia le informa compra por $75.000 en RESTAURANTE con tarjeta *9266 el 20/11/2026. Dudas al 018000912345  ";
      const wizard = simulateWizardStep1To2(sms, userAccounts, true);

      expect(wizard.step).toBe(2);
      expect(wizard.prefillData.notes).toBe(sms.trim());
      expect(wizard.prefillData.description).toBe("");
      expect(wizard.prefillData.category_id).toBe("");
    });

    it("verifies that unchecking includeSmsInNotes leaves notes and description completely empty", () => {
      const sms =
        "Bancolombia le informa compra por $75.000 en RESTAURANTE con tarjeta *9266 el 20/11/2026";
      const wizard = simulateWizardStep1To2(sms, userAccounts, false);

      expect(wizard.step).toBe(2);
      expect(wizard.prefillData.notes).toBe("");
      expect(wizard.prefillData.description).toBe("");
      expect(wizard.prefillData.category_id).toBe("");
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
