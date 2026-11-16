"use server";

import { createClient } from "@/lib/supabase/server";
import { SignInSchema, SignUpSchema } from "@/lib/validations/auth";
import type { ActionResult } from "@/types/actions";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

export interface AuthUser {
  id: string;
  email?: string;
}

/**
 * Determina la URL base para redirecciones de autenticación de forma dinámica.
 * Prioriza NEXT_PUBLIC_SITE_URL, luego los encabezados HTTP (origin o x-forwarded-host),
 * y finalmente recurre a http://localhost:3000 como fallback de desarrollo.
 */
export function getBaseUrl(): string {
  const envSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envSiteUrl && envSiteUrl.trim() !== "") {
    return envSiteUrl.trim().replace(/\/$/, "");
  }

  try {
    const headersList = headers();
    const origin = headersList.get("origin");
    if (origin && origin.trim() !== "") {
      return origin.trim().replace(/\/$/, "");
    }

    const host = headersList.get("x-forwarded-host") || headersList.get("host");
    const proto = headersList.get("x-forwarded-proto") || "https";
    if (host) {
      return `${proto}://${host}`.replace(/\/$/, "");
    }
  } catch {
    // Si se ejecuta fuera del ciclo de request (ej. pruebas unitarias)
  }

  return "http://localhost:3000";
}

/**
 * Inicia sesión con correo y contraseña en Supabase Auth.
 * Sincroniza la sesión y cookies seguras.
 */
export async function signIn(rawInput: unknown): Promise<ActionResult<{ user: AuthUser }>> {
  try {
    const parseResult = SignInSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const fieldErrors = parseResult.error.flatten().fieldErrors;
      const validationErrors: Record<string, string[]> = {};
      for (const [key, val] of Object.entries(fieldErrors)) {
        if (val) validationErrors[key] = val;
      }
      return {
        success: false,
        error: "Datos de inicio de sesión inválidos",
        validationErrors,
      };
    }

    const { email, password } = parseResult.data;
    const supabase = createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        return {
          success: false,
          error: "Credenciales inválidas. Verifica tu correo y contraseña.",
        };
      }
      if (error.message.includes("Email not confirmed")) {
        return {
          success: false,
          error: "Correo no confirmado. Por favor revisa tu bandeja de entrada.",
        };
      }
      return {
        success: false,
        error: error.message || "Error al iniciar sesión",
      };
    }

    if (!data.user) {
      return {
        success: false,
        error: "No se pudo recuperar la información del usuario autenticado",
      };
    }

    revalidatePath("/", "layout");

    return {
      success: true,
      data: {
        user: {
          id: data.user.id,
          email: data.user.email,
        },
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado al iniciar sesión";
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Registra una nueva cuenta de usuario en Supabase Auth.
 */
export async function signUp(
  rawInput: unknown
): Promise<ActionResult<{ user: AuthUser | null; requiresEmailConfirmation: boolean }>> {
  try {
    const parseResult = SignUpSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const fieldErrors = parseResult.error.flatten().fieldErrors;
      const validationErrors: Record<string, string[]> = {};
      for (const [key, val] of Object.entries(fieldErrors)) {
        if (val) validationErrors[key] = val;
      }
      return {
        success: false,
        error: "Datos de registro inválidos",
        validationErrors,
      };
    }

    const { email, password } = parseResult.data;
    const supabase = createClient();

    const baseUrl = getBaseUrl();
    const emailRedirectTo = `${baseUrl}/auth/callback`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
      },
    });

    if (error) {
      if (error.message.includes("User already registered")) {
        return {
          success: false,
          error: "Ya existe un usuario registrado con este correo electrónico.",
        };
      }
      return {
        success: false,
        error: error.message || "Error al crear la cuenta",
      };
    }

    const requiresEmailConfirmation = !data.session;

    revalidatePath("/", "layout");

    return {
      success: true,
      data: {
        user: data.user
          ? {
              id: data.user.id,
              email: data.user.email,
            }
          : null,
        requiresEmailConfirmation,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado al registrar usuario";
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Cierra la sesión activa del usuario y limpia las cookies de autenticación.
 */
export async function signOut(): Promise<ActionResult<{ signedOut: true }>> {
  try {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      return {
        success: false,
        error: error.message || "Error al cerrar sesión",
      };
    }

    revalidatePath("/", "layout");

    return {
      success: true,
      data: { signedOut: true },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error inesperado al cerrar sesión",
    };
  }
}

/**
 * Obtiene el usuario autenticado actual desde el servidor de forma segura.
 */
export async function getAuthUser(): Promise<ActionResult<AuthUser | null>> {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return {
        success: true,
        data: null,
      };
    }

    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al obtener usuario autenticado",
    };
  }
}
