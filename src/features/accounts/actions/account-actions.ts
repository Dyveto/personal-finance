"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  CreateAccountSchema,
  UpdateAccountSchema,
  type CreateAccountInput,
  type UpdateAccountInput,
} from "@/lib/validations/finance";
import type { Database } from "@/types/database.types";
import type { ActionResult } from "@/types/actions";

export type AccountRow = Database["public"]["Tables"]["accounts"]["Row"];

/**
 * Obtiene la lista de cuentas asociadas al usuario autenticado.
 *
 * @returns Lista de cuentas activas ordenadas por fecha de creación descendente.
 */
export async function listAccounts(): Promise<ActionResult<AccountRow[]>> {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized: User is not authenticated" };
    }

    const { data: accounts, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: `Database error: ${error.message}` };
    }

    return { success: true, data: accounts || [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error while fetching accounts";
    return { success: false, error: message };
  }
}

/**
 * Obtiene una cuenta específica verificando que pertenezca al usuario autenticado.
 *
 * @param accountId UUID de la cuenta.
 */
export async function getAccountById(accountId: string): Promise<ActionResult<AccountRow>> {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized: User is not authenticated" };
    }

    const { data: account, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .single();

    if (error || !account) {
      return { success: false, error: "Account not found or access denied" };
    }

    return { success: true, data: account };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error while fetching account";
    return { success: false, error: message };
  }
}

/**
 * Crea una nueva cuenta bancaria, efectivo o tarjeta de crédito para el usuario autenticado.
 * El user_id se deriva exclusivamente de la sesión del servidor.
 *
 * @param rawInput Datos de la cuenta a validar mediante CreateAccountSchema.
 */
export async function createAccount(
  rawInput: unknown
): Promise<ActionResult<AccountRow>> {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized: User is not authenticated" };
    }

    const parseResult = CreateAccountSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const formattedErrors = parseResult.error.flatten().fieldErrors;
      return {
        success: false,
        error: "Validation failed. Please verify the submitted data.",
        validationErrors: formattedErrors,
      };
    }

    const validatedData: CreateAccountInput = parseResult.data;

    const insertPayload: Database["public"]["Tables"]["accounts"]["Insert"] = {
      user_id: user.id,
      name: validatedData.name,
      account_type: validatedData.account_type,
      institution: validatedData.institution ?? null,
      currency: validatedData.currency,
      initial_balance: validatedData.initial_balance,
      current_balance: validatedData.initial_balance, // El balance actual inicializa igual al inicial
      credit_limit:
        validatedData.account_type === "credit_card" ? validatedData.credit_limit : null,
      closing_day:
        validatedData.account_type === "credit_card" ? validatedData.closing_day : null,
      payment_due_day:
        validatedData.account_type === "credit_card" ? validatedData.payment_due_day : null,
      color: validatedData.color ?? null,
      is_active: true,
    };

    const { data: createdAccount, error: insertError } = await supabase
      .from("accounts")
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      return { success: false, error: `Failed to create account: ${insertError.message}` };
    }

    revalidatePath("/accounts");
    revalidatePath("/dashboard");

    return { success: true, data: createdAccount };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error while creating account";
    return { success: false, error: message };
  }
}

/**
 * Actualiza una cuenta bancaria, efectivo o tarjeta de crédito existente del usuario autenticado.
 * Verifica rigurosamente la sesión del usuario y la titularidad de la cuenta.
 *
 * @param accountId UUID de la cuenta a modificar.
 * @param rawInput Datos de la cuenta a validar mediante UpdateAccountSchema.
 */
export async function updateAccount(
  accountId: string,
  rawInput: unknown
): Promise<ActionResult<AccountRow>> {
  try {
    if (
      !accountId ||
      typeof accountId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountId)
    ) {
      return { success: false, error: "Identificador de cuenta inválido" };
    }

    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized: User is not authenticated" };
    }

    const parseResult = UpdateAccountSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const formattedErrors = parseResult.error.flatten().fieldErrors;
      return {
        success: false,
        error: "Validation failed. Please verify the submitted data.",
        validationErrors: formattedErrors,
      };
    }

    const validatedData: UpdateAccountInput = parseResult.data;

    const updatePayload: Database["public"]["Tables"]["accounts"]["Update"] = {
      name: validatedData.name,
      account_type: validatedData.account_type,
      institution: validatedData.institution ?? null,
      currency: validatedData.currency ?? "COP",
      color: validatedData.color ?? null,
      updated_at: new Date().toISOString(),
    };

    if (validatedData.is_active !== undefined) {
      updatePayload.is_active = validatedData.is_active;
    }

    if (validatedData.account_type === "credit_card") {
      // Regla de integridad financiera:
      // En tarjetas de crédito, la deuda (current_balance) se deriva estrictamente de los consumos
      // activos no pagados y de los pagos de extractos registrados. Se omite la edición manual
      // directa del saldo para evitar romper la proyección de cuotas e inconsistencias contables.
      if (validatedData.credit_limit !== undefined) {
        updatePayload.credit_limit = validatedData.credit_limit;
      }
      if (validatedData.closing_day !== undefined) {
        updatePayload.closing_day = validatedData.closing_day;
      }
      if (validatedData.payment_due_day !== undefined) {
        updatePayload.payment_due_day = validatedData.payment_due_day;
      }
    } else {
      // Para cuentas estándar (efectivo y bancos), se permite ajustar el saldo disponible
      const balance =
        validatedData.current_balance ?? validatedData.balance ?? validatedData.initial_balance;
      if (balance !== undefined) {
        updatePayload.current_balance = balance;
      }
      updatePayload.credit_limit = null;
      updatePayload.closing_day = null;
      updatePayload.payment_due_day = null;
    }

    const { data: updatedAccount, error: updateError } = await supabase
      .from("accounts")
      .update(updatePayload)
      .eq("id", accountId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateError) {
      if (updateError.message.includes("accounts_credit_rules")) {
        return {
          success: false,
          error: "Los datos de la tarjeta no cumplen con las reglas financieras (cupo > 0 y días entre 1 y 31).",
        };
      }
      return { success: false, error: `Failed to update account: ${updateError.message}` };
    }

    if (!updatedAccount) {
      return { success: false, error: "Account not found or access denied" };
    }

    revalidatePath("/accounts");
    revalidatePath("/credit-cards");
    revalidatePath("/transactions");
    revalidatePath("/");

    return { success: true, data: updatedAccount };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error while updating account";
    return { success: false, error: message };
  }
}
