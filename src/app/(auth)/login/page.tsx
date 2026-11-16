"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { LogIn, Loader2, AlertCircle, CheckCircle2, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignInSchema, type SignInInput } from "@/lib/validations/auth";
import { signIn } from "@/features/auth/actions/auth-actions";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") || "/";
  const isVerified = searchParams.get("verified") === "true";
  const authError = searchParams.get("error");

  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInInput>({
    resolver: zodResolver(SignInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: SignInInput) => {
    setIsPending(true);
    setFormError(null);

    try {
      const result = await signIn(values);

      if (!result.success) {
        setFormError(result.error);
        setIsPending(false);
        return;
      }

      router.push(nextUrl);
      router.refresh();
    } catch {
      setFormError("Error inesperado al conectar con el servidor.");
      setIsPending(false);
    }
  };

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900">
      <CardHeader className="space-y-1 pb-4 text-center">
        <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Iniciar Sesión
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Ingresa tus credenciales para acceder a tus finanzas y tarjetas.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4 pt-2">
          {isVerified && (
            <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 flex items-start gap-2.5 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>¡Correo electrónico confirmado exitosamente! Ya puedes iniciar sesión con tu cuenta.</span>
            </div>
          )}

          {authError && (
            <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 flex items-start gap-2.5 text-xs text-amber-700 dark:text-amber-300">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <span>El enlace de verificación no es válido o ha expirado. Por favor intenta iniciar sesión.</span>
            </div>
          )}

          {formError && (
            <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* Campo Correo */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Correo Electrónico
            </Label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                id="email"
                type="email"
                placeholder="tu@correo.com"
                className="pl-9 text-xs sm:text-sm"
                disabled={isPending}
                {...register("email")}
              />
            </div>
            {errors.email && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400">{errors.email.message}</p>
            )}
          </div>

          {/* Campo Contraseña */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="password"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Contraseña
              </Label>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                className="pl-9 text-xs sm:text-sm"
                disabled={isPending}
                {...register("password")}
              />
            </div>
            {errors.password && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400">
                {errors.password.message}
              </p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4 pt-2">
          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 text-xs sm:text-sm font-semibold h-10"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Ingresando...
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4 mr-2" />
                Iniciar Sesión
              </>
            )}
          </Button>

          <p className="text-xs text-center text-slate-500 dark:text-slate-400">
            ¿No tienes una cuenta aún?{" "}
            <Link
              href="/signup"
              className="font-bold text-blue-600 dark:text-blue-400 hover:underline inline-block"
            >
              Regístrate aquí
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <Card className="border-slate-200 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900 p-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
          <p className="text-xs text-slate-500 mt-2">Cargando formulario...</p>
        </Card>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
