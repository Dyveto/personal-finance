"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types/actions";
import type { Json } from "@/types/database.types";
import {
  DashboardLayoutSchema,
  type DashboardLayoutConfig,
  DEFAULT_DASHBOARD_LAYOUT,
} from "@/lib/validations/finance";

/**
 * Obtiene la configuración de diseño del Dashboard para el usuario autenticado.
 * Si el usuario no tiene preferencias guardadas en la base de datos, inicializa
 * el registro con la configuración predeterminada de forma transparente.
 */
export async function getDashboardLayout(): Promise<ActionResult<DashboardLayoutConfig>> {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized: User is not authenticated" };
    }

    const { data, error } = await supabase
      .from("user_preferences")
      .select("dashboard_layout")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return { success: false, error: `Database error: ${error.message}` };
    }

    if (!data || !data.dashboard_layout) {
      // Si aún no existe el registro de preferencias para este usuario, inicializarlo
      const { error: insertError } = await supabase
        .from("user_preferences")
        .upsert(
          {
            user_id: user.id,
            dashboard_layout: DEFAULT_DASHBOARD_LAYOUT as unknown as Json,
          },
          { onConflict: "user_id" }
        );

      if (insertError) {
        console.error("Error al sembrar preferencias por defecto:", insertError.message);
      }

      return { success: true, data: DEFAULT_DASHBOARD_LAYOUT };
    }

    // Validar la estructura persistida con Zod
    const parsed = DashboardLayoutSchema.safeParse(data.dashboard_layout);
    if (!parsed.success) {
      // Si los datos guardados estuviesen corruptos o desactualizados, retornar el layout por defecto
      return { success: true, data: DEFAULT_DASHBOARD_LAYOUT };
    }

    return { success: true, data: parsed.data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado al obtener preferencias";
    return { success: false, error: message };
  }
}

/**
 * Guarda o actualiza la configuración personalizada del layout del Dashboard para el usuario autenticado.
 * Valida la estructura mediante Zod y persiste el JSONB de forma aislada.
 */
export async function saveDashboardLayout(
  layoutConfig: unknown
): Promise<ActionResult<DashboardLayoutConfig>> {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized: User is not authenticated" };
    }

    // Validación rigurosa con Zod
    const parseResult = DashboardLayoutSchema.safeParse(layoutConfig);
    if (!parseResult.success) {
      const validationErrors = parseResult.error.flatten().fieldErrors;
      return {
        success: false,
        error: "Configuración de layout de dashboard inválida",
        validationErrors,
      };
    }

    const validatedLayout = parseResult.data;

    // Actualizar o insertar de forma segura vinculada exclusivamente al user.id
    const { error: upsertError } = await supabase
      .from("user_preferences")
      .upsert(
        {
          user_id: user.id,
          dashboard_layout: validatedLayout as unknown as Json,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      return { success: false, error: `Database error: ${upsertError.message}` };
    }

    revalidatePath("/");
    return { success: true, data: validatedLayout };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado al guardar preferencias";
    return { success: false, error: message };
  }
}

/**
 * Restaura la disposición predeterminada de widgets para el usuario autenticado.
 */
export async function resetDashboardLayout(): Promise<ActionResult<DashboardLayoutConfig>> {
  return saveDashboardLayout(DEFAULT_DASHBOARD_LAYOUT);
}
