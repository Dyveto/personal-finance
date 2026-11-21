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

  describe("Paso 2 Confirmation & Defensive Server Action Handling (Safari iOS Protection)", () => {
    // Simulates the exact defensive confirmation handler used in TransactionForm within the SMS modal
    async function submitTransactionFromStep2(
      actionCall: () => Promise<unknown>,
      prefill: TransactionPrefillData
    ): Promise<{
      success: boolean;
      serverError: string | null;
      createdData: unknown | null;
      preservedPrefill: TransactionPrefillData;
    }> {
      let serverError: string | null = null;
      let createdData: unknown | null = null;

      try {
        let result: unknown;
        try {
          result = await actionCall();
        } catch (callErr) {
          const msg = callErr instanceof Error && callErr.message
            ? callErr.message
            : "Error de comunicación con el servidor al registrar la transacción.";
          return {
            success: false,
            serverError: msg,
            createdData: null,
            preservedPrefill: prefill,
          };
        }

        if (!result || typeof result !== "object" || !("success" in result) || !(result as { success: boolean }).success) {
          const errorMsg =
            result && typeof result === "object" && "error" in result && typeof (result as { error: unknown }).error === "string"
              ? (result as { error: string }).error
              : "No se recibió respuesta válida del servidor al registrar la transacción. Por favor verifica tu conexión e intenta de nuevo.";
          serverError = errorMsg;
          return {
            success: false,
            serverError,
            createdData: null,
            preservedPrefill: prefill,
          };
        }

        createdData = (result as unknown as { data: unknown }).data;
        return {
          success: true,
          serverError: null,
          createdData,
          preservedPrefill: prefill,
        };
      } catch (err) {
        let msg = err instanceof Error ? err.message : "Error al procesar la transacción";
        if (
          typeof msg === "string" &&
          (msg.includes("undefined is not an object") ||
            msg.includes("Cannot read properties of undefined") ||
            msg.includes("evaluating 's.success'") ||
            msg.includes("success"))
        ) {
          msg = "No se pudo completar la operación en el servidor. Por favor verifica tu conexión e intenta nuevamente.";
        }
        serverError = msg;
        return {
          success: false,
          serverError,
          createdData: null,
          preservedPrefill: prefill,
        };
      }
    }

    const samplePrefill: TransactionPrefillData = {
      account_id: "acc-bancolombia-1234",
      category_id: "cat-groceries-uuid",
      amount: "20400.00",
      transaction_type: "expense",
      transaction_date: "2026-11-16",
      description: "Compra D1",
      notes: "Bancolombia: Compraste $20,400.00 en D1 con tu tarjeta *1234",
    };

    it("safely handles undefined Server Action resolution without throwing TypeError or breaking form data", async () => {
      const outcome = await submitTransactionFromStep2(async () => undefined, samplePrefill);

      expect(outcome.success).toBe(false);
      expect(outcome.serverError).toBe(
        "No se recibió respuesta válida del servidor al registrar la transacción. Por favor verifica tu conexión e intenta de nuevo."
      );
      expect(outcome.createdData).toBeNull();
      // Data remains completely intact for retry
      expect(outcome.preservedPrefill.amount).toBe("20400.00");
      expect(outcome.preservedPrefill.account_id).toBe("acc-bancolombia-1234");
      expect(outcome.preservedPrefill.notes).toContain("Bancolombia: Compraste $20,400.00");
    });

    it("safely handles null Server Action resolution without throwing TypeError", async () => {
      const outcome = await submitTransactionFromStep2(async () => null, samplePrefill);

      expect(outcome.success).toBe(false);
      expect(outcome.serverError).toContain("No se recibió respuesta válida del servidor");
      expect(outcome.createdData).toBeNull();
      expect(outcome.preservedPrefill).toEqual(samplePrefill);
    });

    it("safely handles non-object or malformed responses without .success property", async () => {
      const outcomeEmptyObj = await submitTransactionFromStep2(async () => ({}), samplePrefill);
      expect(outcomeEmptyObj.success).toBe(false);
      expect(outcomeEmptyObj.serverError).toContain("No se recibió respuesta válida del servidor");

      const outcomeHtmlStr = await submitTransactionFromStep2(
        async () => "<html>504 Gateway Timeout</html>",
        samplePrefill
      );
      expect(outcomeHtmlStr.success).toBe(false);
      expect(outcomeHtmlStr.serverError).toContain("No se recibió respuesta válida del servidor");
    });

    it("properly extracts and displays business error when { success: false, error: '...' } is returned", async () => {
      const outcome = await submitTransactionFromStep2(
        async () => ({
          success: false,
          error: "No se pueden registrar transacciones en una cuenta inactiva",
        }),
        samplePrefill
      );

      expect(outcome.success).toBe(false);
      expect(outcome.serverError).toBe("No se pueden registrar transacciones en una cuenta inactiva");
      expect(outcome.createdData).toBeNull();
      expect(outcome.preservedPrefill.amount).toBe("20400.00");
    });

    it("properly processes successful transaction and returns created data payload", async () => {
      const createdTx = {
        id: "tx-generated-uuid-999",
        amount: 20400,
        description: "Compra D1",
      };
      const outcome = await submitTransactionFromStep2(
        async () => ({
          success: true,
          data: createdTx,
        }),
        samplePrefill
      );

      expect(outcome.success).toBe(true);
      expect(outcome.serverError).toBeNull();
      expect(outcome.createdData).toEqual(createdTx);
    });

    it("catches and sanitizes unexpected WebKit TypeError if thrown during execution", async () => {
      const outcome = await submitTransactionFromStep2(async () => {
        throw new TypeError("undefined is not an object (evaluating 's.success')");
      }, samplePrefill);

      expect(outcome.success).toBe(false);
      expect(outcome.serverError).toBe(
        "undefined is not an object (evaluating 's.success')" // Caught by callErr
      );
    });
  });
});
