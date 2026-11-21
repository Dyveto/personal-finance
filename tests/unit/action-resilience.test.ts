import { describe, it, expect } from "vitest";
import type { ActionResult } from "@/types/actions";
import type { TransactionRow } from "@/types/database.types";

describe("Safari iOS & Client Defensive Action Response Handling", () => {
  function evaluateActionResponse(result: unknown): {
    isSuccessful: boolean;
    data?: unknown;
    error: string;
  } {
    if (!result || typeof result !== "object" || !("success" in result)) {
      return {
        isSuccessful: false,
        error: "No se recibió respuesta válida del servidor. Por favor verifica tu conexión e intenta de nuevo.",
      };
    }

    const actionRes = result as ActionResult<unknown>;
    if (!actionRes.success) {
      return {
        isSuccessful: false,
        error: typeof actionRes.error === "string" ? actionRes.error : "Error desconocido",
      };
    }

    return {
      isSuccessful: true,
      data: actionRes.data,
      error: "",
    };
  }

  function sanitizeRuntimeError(err: unknown): string {
    const rawMsg = err instanceof Error ? err.message : String(err);
    if (
      rawMsg.includes("undefined is not an object") ||
      rawMsg.includes("Cannot read properties of undefined") ||
      rawMsg.includes("evaluating 's.success'") ||
      rawMsg.includes("evaluating 'result.success'") ||
      rawMsg.includes(".success")
    ) {
      return "No se pudo completar la operación en el servidor. Por favor verifica tu conexión e intenta nuevamente.";
    }
    return rawMsg;
  }

  it("handles undefined result safely without throwing TypeError", () => {
    expect(() => evaluateActionResponse(undefined)).not.toThrow();
    const evaluation = evaluateActionResponse(undefined);
    expect(evaluation.isSuccessful).toBe(false);
    expect(evaluation.error).toContain("No se recibió respuesta válida del servidor");
  });

  it("handles null result safely without throwing TypeError", () => {
    expect(() => evaluateActionResponse(null)).not.toThrow();
    const evaluation = evaluateActionResponse(null);
    expect(evaluation.isSuccessful).toBe(false);
    expect(evaluation.error).toContain("No se recibió respuesta válida del servidor");
  });

  it("handles non-object primitive results safely", () => {
    expect(() => evaluateActionResponse("500 Internal Server Error")).not.toThrow();
    expect(evaluateActionResponse("500 Internal Server Error").isSuccessful).toBe(false);
    expect(evaluateActionResponse(12345).isSuccessful).toBe(false);
    expect(evaluateActionResponse(true).isSuccessful).toBe(false);
  });

  it("handles empty object or missing success property safely", () => {
    expect(() => evaluateActionResponse({})).not.toThrow();
    const evaluation = evaluateActionResponse({});
    expect(evaluation.isSuccessful).toBe(false);
  });

  it("extracts explicit error message when success is false", () => {
    const errorResponse: ActionResult<TransactionRow> = {
      success: false,
      error: "Income transactions cannot be registered against a credit card account",
    };
    const evaluation = evaluateActionResponse(errorResponse);
    expect(evaluation.isSuccessful).toBe(false);
    expect(evaluation.error).toBe("Income transactions cannot be registered against a credit card account");
  });

  it("extracts data payload successfully when success is true", () => {
    const successResponse = {
      success: true,
      data: { id: "tx-123", amount: 20400.0, description: "Compra Nequi" },
    };
    const evaluation = evaluateActionResponse(successResponse);
    expect(evaluation.isSuccessful).toBe(true);
    expect(evaluation.data).toEqual({ id: "tx-123", amount: 20400.0, description: "Compra Nequi" });
    expect(evaluation.error).toBe("");
  });

  it("sanitizes Safari iOS 'undefined is not an object (evaluating s.success)' message", () => {
    const safariError = new TypeError("undefined is not an object (evaluating 's.success')");
    const sanitized = sanitizeRuntimeError(safariError);
    expect(sanitized).toBe(
      "No se pudo completar la operación en el servidor. Por favor verifica tu conexión e intenta nuevamente."
    );
    expect(sanitized).not.toContain("evaluating");
  });

  it("sanitizes Chrome V8 'Cannot read properties of undefined (reading success)' message", () => {
    const chromeError = new TypeError("Cannot read properties of undefined (reading 'success')");
    const sanitized = sanitizeRuntimeError(chromeError);
    expect(sanitized).toBe(
      "No se pudo completar la operación en el servidor. Por favor verifica tu conexión e intenta nuevamente."
    );
  });

  it("preserves standard user-facing error messages unchanged", () => {
    const customError = new Error("El monto debe ser estrictamente mayor a 0");
    const sanitized = sanitizeRuntimeError(customError);
    expect(sanitized).toBe("El monto debe ser estrictamente mayor a 0");
  });
});
