import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Route handler para intercambiar códigos PKCE o token hashes de Supabase Auth
 * por cookies de sesión seguras cuando el usuario confirma su correo electrónico.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  try {
    const supabase = createClient();

    if (token_hash && type) {
      const { error } = await supabase.auth.verifyOtp({
        type,
        token_hash,
      });
      if (!error) {
        return NextResponse.redirect(new URL(next, origin));
      }
    }

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(new URL(next, origin));
      }
    }
  } catch {
    // Si ocurre un error al inicializar o conectar con Supabase
    return NextResponse.redirect(new URL("/login?error=auth_callback_failed", origin));
  }

  // Si el usuario llega sin código o la sesión ya se verificó
  return NextResponse.redirect(new URL("/login?verified=true", origin));
}
