"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/types/actions";
import type { TransactionInsert } from "@/types/database.types";
import {
  EXCEL_MOVEMENTS,
  type ExcelMovementRecord,
} from "@/features/transactions/data/excel-movements";
import { addMoney, roundMoney } from "@/lib/finance/money";

export interface MigrationSummary {
  userId: string;
  userEmail: string;
  accountsCreated: string[];
  accountsExisting: string[];
  categoriesCreated: string[];
  categoriesExisting: string[];
  totalMovementsProcessed: number;
  transactionsInserted: number;
  transactionsSkippedDuplicates: number;
  totalIncomeInserted: string;
  totalExpenseInserted: string;
}

interface RequiredCategoryConfig {
  name: string;
  category_type: "income" | "expense";
  icon: string;
  color: string;
}

const REQUIRED_CATEGORIES: RequiredCategoryConfig[] = [
  { name: "Comida", category_type: "expense", icon: "utensils", color: "#F59E0B" },
  { name: "Compras", category_type: "expense", icon: "shopping-bag", color: "#06B6D4" },
  { name: "Compras", category_type: "income", icon: "shopping-bag", color: "#06B6D4" },
  { name: "Educación", category_type: "expense", icon: "book", color: "#10B981" },
  { name: "Entretenimiento", category_type: "expense", icon: "film", color: "#EC4899" },
  { name: "Entretenimiento", category_type: "income", icon: "film", color: "#EC4899" },
  { name: "Gym", category_type: "expense", icon: "activity", color: "#3B82F6" },
  { name: "Internado", category_type: "expense", icon: "briefcase", color: "#8B5CF6" },
  { name: "Internado", category_type: "income", icon: "briefcase", color: "#8B5CF6" },
  { name: "Otros gastos", category_type: "expense", icon: "more-horizontal", color: "#64748B" },
  { name: "Otros ingresos", category_type: "income", icon: "plus-circle", color: "#06B6D4" },
  { name: "Salud", category_type: "expense", icon: "heart", color: "#F43F5E" },
  { name: "Servicio", category_type: "expense", icon: "zap", color: "#EAB308" },
  { name: "Subscripciones", category_type: "expense", icon: "tv", color: "#8B5CF6" },
  { name: "Transporte", category_type: "expense", icon: "car", color: "#3B82F6" },
];

const REQUIRED_ACCOUNTS = [
  {
    name: "Efectivo",
    account_type: "cash" as const,
    institution: null,
    color: "#10B981",
  },
  {
    name: "Nequi",
    account_type: "bank" as const,
    institution: "Nequi",
    color: "#8B5CF6",
  },
  {
    name: "Bancolombia",
    account_type: "bank" as const,
    institution: "Bancolombia",
    color: "#F59E0B",
  },
];

/**
 * Genera una llave determinística de combinación única para prevenir duplicados.
 */
function buildTransactionKey(
  userId: string,
  accountId: string,
  date: string,
  amount: number,
  description: string
): string {
  const normDesc = description.trim().toLowerCase();
  const normAmount = Number(amount).toFixed(2);
  return `${userId}_${accountId}_${date}_${normAmount}_${normDesc}`;
}

/**
 * Server Action segura e idempotente para migrar los movimientos financieros
 * del archivo Excel al usuario destino (por defecto calderongoenaga2004@gmail.com).
 */
export async function migrateExcelTransactions(
  targetEmail: string = "calderongoenaga2004@gmail.com",
  customMovements?: ExcelMovementRecord[]
): Promise<ActionResult<MigrationSummary>> {
  try {
    const adminClient = createAdminClient();
    const movements = customMovements || EXCEL_MOVEMENTS;

    // 1. Identificar usuario por email
    const { data: usersData, error: usersError } = await adminClient.auth.admin.listUsers();
    if (usersError) {
      return {
        success: false,
        error: `Error al consultar usuarios en Supabase Auth: ${usersError.message}`,
      };
    }

    const targetUser = usersData.users.find(
      (u) => u.email && u.email.toLowerCase() === targetEmail.toLowerCase()
    );

    if (!targetUser) {
      return {
        success: false,
        error: `Usuario destino no encontrado en Supabase Auth: ${targetEmail}`,
      };
    }

    const userId = targetUser.id;

    // 2. Creación Automática de Cuentas (Efectivo, Nequi, Bancolombia)
    const { data: existingAccounts, error: accountsFetchError } = await adminClient
      .from("accounts")
      .select("*")
      .eq("user_id", userId);

    if (accountsFetchError) {
      return {
        success: false,
        error: `Error al consultar cuentas del usuario: ${accountsFetchError.message}`,
      };
    }

    const accountMap = new Map<string, string>(); // lowercase name -> account_id
    const accountsCreated: string[] = [];
    const accountsExisting: string[] = [];

    for (const acc of existingAccounts || []) {
      accountMap.set(acc.name.trim().toLowerCase(), acc.id);
      accountsExisting.push(acc.name);
    }

    for (const reqAcc of REQUIRED_ACCOUNTS) {
      const lower = reqAcc.name.toLowerCase();
      if (!accountMap.has(lower)) {
        const { data: newAcc, error: createAccError } = await adminClient
          .from("accounts")
          .insert({
            user_id: userId,
            name: reqAcc.name,
            account_type: reqAcc.account_type,
            institution: reqAcc.institution,
            currency: "COP",
            initial_balance: 0,
            current_balance: 0,
            color: reqAcc.color,
            is_active: true,
          })
          .select("id, name")
          .single();

        if (createAccError || !newAcc) {
          return {
            success: false,
            error: `Error al crear cuenta ${reqAcc.name}: ${createAccError?.message}`,
          };
        }

        accountMap.set(lower, newAcc.id);
        accountsCreated.push(newAcc.name);
      }
    }

    // 3. Gestión y Normalización de Categorías
    const { data: existingCategories, error: categoriesFetchError } = await adminClient
      .from("categories")
      .select("*")
      .eq("user_id", userId);

    if (categoriesFetchError) {
      return {
        success: false,
        error: `Error al consultar categorías del usuario: ${categoriesFetchError.message}`,
      };
    }

    const categoryMap = new Map<string, string>(); // `${name.toLowerCase()}_${type}` -> category_id
    const categoriesCreated: string[] = [];
    const categoriesExisting: string[] = [];

    for (const cat of existingCategories || []) {
      const key = `${cat.name.trim().toLowerCase()}_${cat.category_type}`;
      categoryMap.set(key, cat.id);
      categoriesExisting.push(`${cat.name} (${cat.category_type})`);
    }

    for (const reqCat of REQUIRED_CATEGORIES) {
      const key = `${reqCat.name.trim().toLowerCase()}_${reqCat.category_type}`;
      if (!categoryMap.has(key)) {
        const { data: newCat, error: createCatError } = await adminClient
          .from("categories")
          .insert({
            user_id: userId,
            name: reqCat.name,
            category_type: reqCat.category_type,
            icon: reqCat.icon,
            color: reqCat.color,
            is_default: false,
            is_active: true,
          })
          .select("id, name, category_type")
          .single();

        if (createCatError || !newCat) {
          return {
            success: false,
            error: `Error al crear categoría ${reqCat.name} (${reqCat.category_type}): ${createCatError?.message}`,
          };
        }

        categoryMap.set(key, newCat.id);
        categoriesCreated.push(`${newCat.name} (${newCat.category_type})`);
      }
    }

    // 4. Inserción Idempotente de Transacciones (Control de Duplicados)
    const { data: existingTransactions, error: txFetchError } = await adminClient
      .from("transactions")
      .select("account_id, transaction_date, amount, description")
      .eq("user_id", userId);

    if (txFetchError) {
      return {
        success: false,
        error: `Error al consultar transacciones existentes: ${txFetchError.message}`,
      };
    }

    const existingKeys = new Set<string>();
    for (const tx of existingTransactions || []) {
      const key = buildTransactionKey(
        userId,
        tx.account_id,
        tx.transaction_date,
        tx.amount,
        tx.description
      );
      existingKeys.add(key);
    }

    const toInsert: TransactionInsert[] = [];
    let skippedDuplicates = 0;
    let totalIncomeInserted = "0.00";
    let totalExpenseInserted = "0.00";

    for (const mov of movements) {
      const accountId = accountMap.get(mov.account_name.trim().toLowerCase());
      if (!accountId) {
        return {
          success: false,
          error: `Cuenta destino '${mov.account_name}' no encontrada para el movimiento fila ${mov.excel_row}`,
        };
      }

      // Normalización de categoría y mapeo al ID
      let targetCatName = mov.category_name;
      const rawLower = (mov.raw_category || "").toLowerCase();
      if (rawLower === "comida" || rawLower === "alimentación" || rawLower === "alimentacion") {
        targetCatName = "Comida";
      } else if (!rawLower || rawLower === "none") {
        targetCatName = mov.transaction_type === "expense" ? "Otros gastos" : "Otros ingresos";
      }

      const catKey = `${targetCatName.trim().toLowerCase()}_${mov.transaction_type}`;
      let categoryId = categoryMap.get(catKey);

      // Fallback a Comida o Otros gastos/ingresos si la combinación no estuviese
      if (!categoryId) {
        const fallbackKey =
          mov.transaction_type === "expense" ? "otros gastos_expense" : "otros ingresos_income";
        categoryId = categoryMap.get(fallbackKey);
      }

      if (!categoryId) {
        return {
          success: false,
          error: `No fue posible asignar una categoría válida para '${mov.category_name}' en fila ${mov.excel_row}`,
        };
      }

      const dupKey = buildTransactionKey(
        userId,
        accountId,
        mov.transaction_date,
        mov.amount,
        mov.description
      );

      if (existingKeys.has(dupKey)) {
        skippedDuplicates++;
        continue;
      }

      // Añadir clave para evitar duplicados en el mismo lote
      existingKeys.add(dupKey);

      const amountStr = roundMoney(mov.amount);
      if (mov.transaction_type === "income") {
        totalIncomeInserted = addMoney(totalIncomeInserted, amountStr);
      } else {
        totalExpenseInserted = addMoney(totalExpenseInserted, amountStr);
      }

      toInsert.push({
        user_id: userId,
        account_id: accountId,
        category_id: categoryId,
        description: mov.description.trim() || "Movimiento importado",
        amount: mov.amount,
        transaction_type: mov.transaction_type,
        transaction_date: mov.transaction_date,
        is_installment: false,
        installment_count: 1,
        notes: `Importado de Excel NCG (Fila ${mov.excel_row})`,
      });
    }

    if (toInsert.length > 0) {
      // Inserción en lotes de 50 para optimizar rendimiento de red y base de datos
      const chunkSize = 50;
      for (let i = 0; i < toInsert.length; i += chunkSize) {
        const chunk = toInsert.slice(i, i + chunkSize);
        const { error: insertError } = await adminClient.from("transactions").insert(chunk);
        if (insertError) {
          return {
            success: false,
            error: `Error al insertar lote de transacciones (${i} a ${i + chunk.length}): ${insertError.message}`,
          };
        }
      }

      // Recalcular saldos de las cuentas afectadas
      for (const accId of Array.from(accountMap.values())) {
        await adminClient.rpc("recalculate_account_balance", {
          target_account_id: accId,
        });
      }
    }

    try {
      revalidatePath("/");
      revalidatePath("/transactions");
      revalidatePath("/accounts");
    } catch {
      // Ignorar si se ejecuta fuera del ciclo de petición HTTP de Next.js (ej. script CLI de migración)
    }

    return {
      success: true,
      data: {
        userId,
        userEmail: targetEmail,
        accountsCreated,
        accountsExisting,
        categoriesCreated,
        categoriesExisting,
        totalMovementsProcessed: movements.length,
        transactionsInserted: toInsert.length,
        transactionsSkippedDuplicates: skippedDuplicates,
        totalIncomeInserted,
        totalExpenseInserted,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error inesperado en la migración";
    return { success: false, error: msg };
  }
}

/**
 * Consulta el estado actual de migración para el usuario objetivo.
 */
export async function getExcelMigrationStatus(
  targetEmail: string = "calderongoenaga2004@gmail.com"
): Promise<
  ActionResult<{
    userId: string;
    totalExpected: number;
    totalImported: number;
    accountsPresent: string[];
    isFullyMigrated: boolean;
  }>
> {
  try {
    const adminClient = createAdminClient();

    const { data: usersData, error: usersError } = await adminClient.auth.admin.listUsers();
    if (usersError) {
      return { success: false, error: usersError.message };
    }

    const targetUser = usersData.users.find(
      (u) => u.email && u.email.toLowerCase() === targetEmail.toLowerCase()
    );

    if (!targetUser) {
      return { success: false, error: `Usuario no encontrado: ${targetEmail}` };
    }

    const userId = targetUser.id;

    const { data: accounts } = await adminClient
      .from("accounts")
      .select("id, name")
      .eq("user_id", userId);

    const { count: txCount } = await adminClient
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    const imported = txCount || 0;
    const totalExpected = EXCEL_MOVEMENTS.length;

    return {
      success: true,
      data: {
        userId,
        totalExpected,
        totalImported: imported,
        accountsPresent: (accounts || []).map((a) => a.name),
        isFullyMigrated: imported >= totalExpected,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al consultar estado de migración";
    return { success: false, error: msg };
  }
}
