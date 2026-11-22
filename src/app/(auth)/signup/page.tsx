"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { UserPlus, Loader2, AlertCircle, CheckCircle2, Lock, Mail } from "lucide-react";
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
import { SignUpSchema, type SignUpInput } from "@/lib/validations/auth";
import { signUp } from "@/features/auth/actions/auth-actions";

export default function SignUpPage() {
  const router = useRouter();

  const [formError, setFormError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpInput>({
    resolver: zodResolver(SignUpSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: SignUpInput) => {
    setIsPending(true);
    setFormError(null);
    setSuccessNotice(null);

    try {
      const result = await signUp(values);

      if (!result || typeof result !== "object" || !("success" in result) || !result.success) {
        setFormError(
          result && typeof result === "object" && "error" in result && typeof result.error === "string"
            ? result.error
            : "No se recibió respuesta válida del servidor al registrar la cuenta."
        );
        setIsPending(false);
        return;
      }

      if (result.data.requiresEmailConfirmation) {
        setSuccessNotice(
          "¡Cuenta creada exitosamente! Revisa tu correo electrónico para confirmar tu cuenta antes de iniciar sesión."
        );
        setIsPending(false);
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setFormError("Error inesperado al conectar con el servidor.");
      setIsPending(false);
    }
  };

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900">
      <CardHeader className="space-y-1 pb-4 text-center">
        <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Crear Cuenta
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Empieza a gestionar tus cuentas bancarias y tarjetas con máxima seguridad.
        </CardDescription>
      </CardHeader>

      {successNotice ? (
        <CardContent className="space-y-4 pt-4 text-center">
          <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
            <h4 className="font-bold text-sm">Registro completado</h4>
            <p className="text-xs">{successNotice}</p>
          </div>
          <Link href="/login" className="block pt-2">
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold h-10">
              Ir a Iniciar Sesión
            </Button>
          </Link>
        </CardContent>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4 pt-2">
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
                  className="pl-9 text-base sm:text-sm"
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
              <Label htmlFor="password" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Contraseña
              </Label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 8 caracteres (A-Z, a-z, 0-9)"
                  className="pl-9 text-base sm:text-sm"
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

            {/* Confirmar Contraseña */}
            <div className="space-y-1.5">
              <Label
                htmlFor="confirmPassword"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Confirmar Contraseña
              </Label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Repite tu contraseña"
                  className="pl-9 text-base sm:text-sm"
                  disabled={isPending}
                  {...register("confirmPassword")}
                />
              </div>
              {errors.confirmPassword && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400">
                  {errors.confirmPassword.message}
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
                  Creando cuenta...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Registrarse
                </>
              )}
            </Button>

            <p className="text-xs text-center text-slate-500 dark:text-slate-400">
              ¿Ya tienes una cuenta?{" "}
              <Link
                href="/login"
                className="font-bold text-blue-600 dark:text-blue-400 hover:underline inline-block"
              >
                Inicia sesión aquí
              </Link>
            </p>
          </CardFooter>
        </form>
      )}
    </Card>
  );
}
