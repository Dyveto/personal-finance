import { ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/shared/BrandLogo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8">
      {/* Logo & Marca Oficial */}
      <div className="mb-8 text-center flex justify-center">
        <BrandLogo variant="full" size="xl" href="/" priority />
      </div>

      {/* Contenedor de formulario */}
      <div className="w-full max-w-md">{children}</div>

      {/* Pie de seguridad */}
      <div className="mt-8 text-center text-xs text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1.5">
        <ShieldCheck className="w-4 h-4 text-emerald-500" />
        <span>Autenticación segura respaldada por Supabase Auth & RLS</span>
      </div>
    </div>
  );
}
