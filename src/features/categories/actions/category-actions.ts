"use server";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";
import type { ActionResult } from "@/types/actions";

export type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

const DEFAULT_CATEGORIES = [
  { name: "Salario", category_type: "income" as const, icon: "wallet" },
  { name: "Freelance", category_type: "income" as const, icon: "laptop" },
  { name: "Inversiones", category_type: "income" as const, icon: "trending-up" },
  { name: "Otros Ingresos", category_type: "income" as const, icon: "plus-circle" },
  { name: "Alimentación", category_type: "expense" as const, icon: "utensils" },
  { name: "Transporte", category_type: "expense" as const, icon: "car" },
  { name: "Vivienda", category_type: "expense" as const, icon: "home" },
  { name: "Salud", category_type: "expense" as const, icon: "heart" },
  { name: "Entretenimiento", category_type: "expense" as const, icon: "film" },
  { name: "Compras", category_type: "expense" as const, icon: "shopping-bag" },
  { name: "Educación", category_type: "expense" as const, icon: "book" },
  { name: "Otros Gastos", category_type: "expense" as const, icon: "more-horizontal" },
];

/**
 * Obtiene la lista de categorías asociadas al usuario autenticado.
 * Si el usuario no tiene categorías, inicializa las categorías por defecto.
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
        is_default: true,
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
