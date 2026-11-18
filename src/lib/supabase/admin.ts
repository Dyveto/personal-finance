import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Crea un cliente Supabase con privilegios administrativos (service_role).
 * Se utiliza EXCLUSIVAMENTE en el entorno de servidor (Node.js / Server Actions / Migraciones internas).
 * NUNCA exponer la Service Role Key al navegador ni en Client Components.
 */
// Polyfill para entornos Node.js < 22 donde Supabase JS requiere WebSocket global para su cliente realtime.
if (typeof globalThis.WebSocket === "undefined") {
  // @ts-expect-error Polyfill mínimo para entornos Node sin WebSocket nativo donde no se utiliza realtime
  globalThis.WebSocket = class DummyWebSocket {};
}

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase admin environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
