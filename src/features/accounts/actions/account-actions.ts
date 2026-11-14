"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CreateAccountSchema, type CreateAccountInput } from "@/lib/validations/finance";
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
