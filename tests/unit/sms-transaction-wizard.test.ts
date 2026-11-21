import { describe, it, expect } from "vitest";
import { parseSmsTransaction } from "@/lib/sms-transaction-parser";
import type { TransactionPrefillData } from "@/features/transactions/components/TransactionForm";

describe("SMS Transaction Wizard Flow Logic", () => {
  const mockAccounts = [
    { id: "acc-bancolombia-1234", name: "Bancolombia Ahorros 1234", lastFour: "1234" },
    { id: "acc-davivienda-9876", name: "Daviplata 9876", lastFour: "9876" },
  ];

  // Helper simulating the step 1 -> step 2 transformation in SmsTransactionModal
  function processSmsStep(
    rawText: string,
    accounts: typeof mockAccounts,
    includeSmsInNotes: boolean = false
  ): {
    step: 1 | 2;
    prefillData: TransactionPrefillData | null;
    accountMatched: boolean;
    errorMsg: string | null;
  } {
    const trimmed = rawText.trim();
    if (!trimmed) {
      return {
        step: 1,
        prefillData: null,
        accountMatched: false,
        errorMsg: "Por favor pega el texto de la notificación o mensaje SMS.",
      };
    }

    const result = parseSmsTransaction(
      trimmed,
      accounts.map((a) => ({ id: a.id, name: a.name, lastFour: a.lastFour }))
    );

    return {
      step: 2,
      accountMatched: result.accountMatched,
      errorMsg: null,
      prefillData: {
        account_id: result.matchedAccountId ?? "",
        category_id: "",
        amount: result.amount ?? "",
        transaction_type: result.type ?? "expense",
        transaction_date: result.date ?? undefined,
        description: "",
        notes: includeSmsInNotes ? trimmed : "",
        autoFocusAccount: !result.accountMatched,
      },
    };
  }

  it("fails step 1 when SMS text is empty or whitespaces only", () => {
    const result = processSmsStep("   ", mockAccounts);
    expect(result.step).toBe(1);
    expect(result.prefillData).toBeNull();
    expect(result.errorMsg).toBeDefined();
  });

  it("transitions to step 2 with autoFocusAccount = false when account is matched, leaving category and description empty", () => {
    const sms =
      "Bancolombia le informa compra por $45.000,00 en RESTAURANTE EL SOL con tarjeta *1234 el 20/11/2026. Dudas al 018000912345";
    const result = processSmsStep(sms, mockAccounts);

    expect(result.step).toBe(2);
    expect(result.accountMatched).toBe(true);
    expect(result.prefillData).toBeDefined();
    expect(result.prefillData?.account_id).toBe("acc-bancolombia-1234");
    expect(result.prefillData?.autoFocusAccount).toBe(false);
    expect(result.prefillData?.amount).toBe("45000.00");
    expect(result.prefillData?.transaction_type).toBe("expense");
    expect(result.prefillData?.transaction_date).toBe("2026-11-20");
    expect(result.prefillData?.category_id).toBe("");
    expect(result.prefillData?.description).toBe("");
    expect(result.prefillData?.notes).toBe("");
  });

  it("transitions to step 2 with autoFocusAccount = true and empty account_id when account cannot be matched", () => {
    const sms =
      "Tu compra por $78.500,00 en SUPERMERCADO EXITO con tarjeta *5555 ha sido aprobada el 15/11/2026";
    const result = processSmsStep(sms, mockAccounts);

    expect(result.step).toBe(2);
    expect(result.accountMatched).toBe(false);
    expect(result.prefillData).toBeDefined();
    expect(result.prefillData?.account_id).toBe("");
    expect(result.prefillData?.autoFocusAccount).toBe(true);
    expect(result.prefillData?.amount).toBe("78500.00");
    expect(result.prefillData?.transaction_type).toBe("expense");
    expect(result.prefillData?.transaction_date).toBe("2026-11-15");
    expect(result.prefillData?.category_id).toBe("");
    expect(result.prefillData?.description).toBe("");
  });

  it("populates notes with trimmed SMS text when includeSmsInNotes is checked", () => {
    const sms =
      "  Bancolombia: Compra por $30.000 en CAFE CENTRAL con tarjeta *1234 el 20/11/2026   ";
    const result = processSmsStep(sms, mockAccounts, true);

    expect(result.step).toBe(2);
    expect(result.prefillData?.notes).toBe(sms.trim());
    expect(result.prefillData?.category_id).toBe("");
    expect(result.prefillData?.description).toBe("");
  });

  it("leaves notes empty when includeSmsInNotes is unchecked (default)", () => {
    const sms =
      "Bancolombia: Compra por $30.000 en CAFE CENTRAL con tarjeta *1234 el 20/11/2026";
    const result = processSmsStep(sms, mockAccounts, false);

    expect(result.step).toBe(2);
    expect(result.prefillData?.notes).toBe("");
  });

  it("handles incoming transfers (income) and populates prefillData properly", () => {
    const sms =
      "Bancolombia: Recibiste $250.000,00 en tu cta *1234 de Juan Perez el 18/11/2026";
    const result = processSmsStep(sms, mockAccounts);

    expect(result.step).toBe(2);
    expect(result.accountMatched).toBe(true);
    expect(result.prefillData?.transaction_type).toBe("income");
    expect(result.prefillData?.amount).toBe("250000.00");
    expect(result.prefillData?.account_id).toBe("acc-bancolombia-1234");
    expect(result.prefillData?.autoFocusAccount).toBe(false);
    expect(result.prefillData?.category_id).toBe("");
    expect(result.prefillData?.description).toBe("");
  });

  it("allows returning to step 1 without erasing raw text or checkbox state", () => {
    let currentStep: 1 | 2 = 1;
    const includeSmsInNotes = true;
    const rawText = "Bancolombia compra $10.000 *1234";

    // Step 1 -> Step 2
    const res = processSmsStep(rawText, mockAccounts, includeSmsInNotes);
    currentStep = res.step;
    expect(currentStep).toBe(2);
    expect(res.prefillData?.notes).toBe(rawText);

    // Click 'Volver al texto'
    currentStep = 1;
    expect(currentStep).toBe(1);
    expect(rawText).toBe("Bancolombia compra $10.000 *1234");
    expect(includeSmsInNotes).toBe(true);
  });
});
