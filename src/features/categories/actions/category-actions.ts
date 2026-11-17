"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";
import type { ActionResult } from "@/types/actions";
import {
  CreateCategorySchema,
  type CreateCategoryInput,
  UpdateCategorySchema,
  type UpdateCategoryInput,
  UuidParamSchema,
} from "@/lib/validations/finance";

export type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
export type CategoryInsert = Database["public"]["Tables"]["categories"]["Insert"];
export type CategoryUpdate = Database["public"]["Tables"]["categories"]["Update"];

const DEFAULT_CATEGORIES = [
  { name: "Salario", category_type: "income" as const, icon: "wallet", color: "#10B981" },
  { name: "Freelance", category_type: "income" as const, icon: "laptop", color: "#3B82F6" },
  { name: "Inversiones", category_type: "income" as const, icon: "trending-up", color: "#8B5CF6" },
  { name: "Otros Ingresos", category_type: "income" as const, icon: "plus-circle", color: "#06B6D4" },
  { name: "Alimentación", category_type: "expense" as const, icon: "utensils", color: "#F59E0B" },
  { name: "Transporte", category_type: "expense" as const, icon: "car", color: "#3B82F6" },
  { name: "Vivienda", category_type: "expense" as const, icon: "home", color: "#8B5CF6" },
  { name: "Salud", category_type: "expense" as const, icon: "heart", color: "#F43F5E" },
  { name: "Entretenimiento", category_type: "expense" as const, icon: "film", color: "#EC4899" },
  { name: "Compras", category_type: "expense" as const, icon: "shopping-bag", color: "#06B6D4" },
  { name: "Educación", category_type: "expense" as const, icon: "book", color: "#10B981" },
  { name: "Otros Gastos", category_type: "expense" as const, icon: "more-horizontal", color: "#64748B" },
];

/**
 * Obtiene la lista de categorías asociadas al usuario autenticado.
 * Si el usuario no tiene categorías, inicializa las categorías predeterminadas en español.
 */
export async function listCategories(
  type?: "income" | "expense"
): Promise<ActionResult<CategoryRow[]>> {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized: User is not authenticated" };
    }

    let query = supabase
      .from("categories")
      .select("*")
      .eq("user_id", user.id)
      .order("name", { ascending: true });

    if (type) {
      query = query.eq("category_type", type);
    }

    const { data: initialCategories, error } = await query;

    if (error) {
      return { success: false, error: `Database error: ${error.message}` };
    }

    let categories = initialCategories;

    // Si el usuario aún no tiene categorías sembradas, crearlas
    if (!categories || categories.length === 0) {
      const inserts = DEFAULT_CATEGORIES.map((cat) => ({
        user_id: user.id,
        name: cat.name,
        category_type: cat.category_type,
        icon: cat.icon,
        color: cat.color,
        is_default: true,
        is_active: true,
      }));

      const { data: seeded, error: seedError } = await supabase
        .from("categories")
        .insert(inserts)
        .select();

      if (!seedError && seeded) {
        categories = type ? seeded.filter((c) => c.category_type === type) : seeded;
      }
    }

    return { success: true, data: categories || [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error while fetching categories";
    return { success: false, error: message };
  }
}

/**
 * Crea una nueva categoría personalizada para el usuario autenticado.
 */
export async function createCategory(
  rawInput: unknown
): Promise<ActionResult<CategoryRow>> {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized: User is not authenticated" };
    }

    const parseResult = CreateCategorySchema.safeParse(rawInput);
    if (!parseResult.success) {
      return {
        success: false,
        error: "Validation failed. Please verify the category data.",
        validationErrors: parseResult.error.flatten().fieldErrors,
      };
    }

    const validated: CreateCategoryInput = parseResult.data;

    // Verificar si ya existe una categoría con ese nombre y tipo para el usuario
    const { data: existing, error: searchError } = await supabase
      .from("categories")
      .select("id, is_active")
      .eq("user_id", user.id)
      .ilike("name", validated.name)
      .eq("category_type", validated.category_type)
      .maybeSingle();

    if (searchError) {
      return { success: false, error: `Error verificando categoría existente: ${searchError.message}` };
    }

    if (existing) {
      if (existing.is_active) {
        return {
          success: false,
          error: `Ya tienes una categoría registrada con el nombre '${validated.name}' para ${
            validated.category_type === "income" ? "ingresos" : "gastos"
          }`,
        };
      } else {
        // Reactivar la categoría si estaba archivada
        const { data: reactivated, error: reactivateError } = await supabase
          .from("categories")
          .update({
            is_active: true,
            icon: validated.icon ?? null,
            color: validated.color ?? null,
          })
          .eq("id", existing.id)
          .eq("user_id", user.id)
          .select()
          .single();

        if (reactivateError || !reactivated) {
          return { success: false, error: `Error reactivando categoría: ${reactivateError?.message}` };
        }

        revalidatePath("/transactions");
        revalidatePath("/");
        return { success: true, data: reactivated };
      }
    }

    // Insertar nueva categoría personalizada
    const insertPayload: CategoryInsert = {
      user_id: user.id,
      name: validated.name,
      category_type: validated.category_type,
      icon: validated.icon ?? null,
      color: validated.color ?? null,
      is_default: false,
      is_active: validated.is_active ?? true,
    };

    const { data: inserted, error: insertError } = await supabase
      .from("categories")
      .insert(insertPayload)
      .select()
      .single();

    if (insertError || !inserted) {
      return { success: false, error: `Error creando la categoría: ${insertError?.message || "Error desconocido"}` };
    }

    revalidatePath("/transactions");
    revalidatePath("/");

    return { success: true, data: inserted };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al crear la categoría";
    return { success: false, error: message };
  }
}

/**
 * Actualiza una categoría existente del usuario autenticado.
 */
export async function updateCategory(
  categoryId: string,
  rawInput: unknown
): Promise<ActionResult<CategoryRow>> {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized: User is not authenticated" };
    }

    const idValidation = UuidParamSchema.safeParse(categoryId);
    if (!idValidation.success) {
      return { success: false, error: "ID de categoría inválido" };
    }

    const parseResult = UpdateCategorySchema.safeParse(rawInput);
    if (!parseResult.success) {
      return {
        success: false,
        error: "Validation failed. Please verify the category update data.",
        validationErrors: parseResult.error.flatten().fieldErrors,
      };
    }

    const validated: UpdateCategoryInput = parseResult.data;

    // Verificar existencia y pertenencia de la categoría
    const { data: existing, error: fetchError } = await supabase
      .from("categories")
      .select("*")
      .eq("id", categoryId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !existing) {
      return { success: false, error: "Categoría no encontrada o acceso denegado" };
    }

    const targetType = validated.category_type ?? existing.category_type;
    const targetName = validated.name ?? existing.name;

    // Si se modifica el nombre o tipo, verificar que no colisione con otra categoría del mismo usuario
    if (validated.name || validated.category_type) {
      const { data: collision, error: collisionError } = await supabase
        .from("categories")
        .select("id")
        .eq("user_id", user.id)
        .neq("id", categoryId)
        .ilike("name", targetName)
        .eq("category_type", targetType)
        .maybeSingle();

      if (collisionError) {
        return { success: false, error: `Error validando duplicados: ${collisionError.message}` };
      }

      if (collision) {
        return {
          success: false,
          error: `Ya existe otra categoría llamada '${targetName}' para ${
            targetType === "income" ? "ingresos" : "gastos"
          }`,
        };
      }
    }

    // Si se modifica el tipo de categoría, verificar si tiene transacciones asociadas
    if (validated.category_type && validated.category_type !== existing.category_type) {
      const { count, error: txCheckError } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("category_id", categoryId)
        .eq("user_id", user.id);

      if (txCheckError) {
        return { success: false, error: `Error verificando transacciones vinculadas: ${txCheckError.message}` };
      }

      if (count && count > 0) {
        return {
          success: false,
          error: "No se puede cambiar el tipo de una categoría que ya tiene transacciones registradas",
        };
      }
    }

    const updatePayload: CategoryUpdate = {};
    if (validated.name !== undefined) updatePayload.name = validated.name;
    if (validated.category_type !== undefined) updatePayload.category_type = validated.category_type;
    if (validated.icon !== undefined) updatePayload.icon = validated.icon;
    if (validated.color !== undefined) updatePayload.color = validated.color;
    if (validated.is_active !== undefined) updatePayload.is_active = validated.is_active;

    const { data: updated, error: updateError } = await supabase
      .from("categories")
      .update(updatePayload)
      .eq("id", categoryId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateError || !updated) {
      return { success: false, error: `Error actualizando categoría: ${updateError?.message || "Error desconocido"}` };
    }

    revalidatePath("/transactions");
    revalidatePath("/");

    return { success: true, data: updated };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al actualizar la categoría";
    return { success: false, error: message };
  }
}

/**
 * Elimina una categoría o la archiva si tiene transacciones registradas.
 */
export async function deleteCategory(
  categoryId: string,
  options?: { forceArchive?: boolean }
): Promise<ActionResult<{ deleted: boolean; archived?: boolean }>> {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized: User is not authenticated" };
    }

    const idValidation = UuidParamSchema.safeParse(categoryId);
    if (!idValidation.success) {
      return { success: false, error: "ID de categoría inválido" };
    }

    // Verificar existencia y pertenencia
    const { data: existing, error: fetchError } = await supabase
      .from("categories")
      .select("id, name")
      .eq("id", categoryId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !existing) {
      return { success: false, error: "Categoría no encontrada o acceso denegado" };
    }

    // Verificar si existen transacciones asociadas
    const { count, error: txCountError } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("category_id", categoryId)
      .eq("user_id", user.id);

    if (txCountError) {
      return { success: false, error: `Error comprobando transacciones de la categoría: ${txCountError.message}` };
    }

    if (count && count > 0) {
      if (options?.forceArchive) {
        const { error: archiveError } = await supabase
          .from("categories")
          .update({ is_active: false })
          .eq("id", categoryId)
          .eq("user_id", user.id);

        if (archiveError) {
          return { success: false, error: `Error al archivar la categoría: ${archiveError.message}` };
        }

        revalidatePath("/transactions");
        revalidatePath("/");
        return { success: true, data: { deleted: false, archived: true } };
      }

      return {
        success: false,
        error: `No es posible eliminar la categoría '${existing.name}' porque contiene ${count} transacción(es) registrada(s). Puedes archivarla en su lugar.`,
      };
    }

    // Si no tiene transacciones, se elimina de forma definitiva
    const { error: deleteError } = await supabase
      .from("categories")
      .delete()
      .eq("id", categoryId)
      .eq("user_id", user.id);

    if (deleteError) {
      return { success: false, error: `Error al eliminar la categoría: ${deleteError.message}` };
    }

    revalidatePath("/transactions");
    revalidatePath("/");

    return { success: true, data: { deleted: true } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al eliminar la categoría";
    return { success: false, error: message };
  }
}
