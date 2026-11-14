import { ShieldCheck, TrendingUp } from "lucide-react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8">
      {/* Logo & Marca */}
      <div className="mb-6 text-center">
        <Link href="/" className="inline-flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:bg-blue-700 transition-colors">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="text-left">
            <span className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight leading-none block">
              Finanzas
            </span>
            <span className="text-[10px] uppercase font-semibold text-blue-600 dark:text-blue-400 tracking-wider">
              Control & Tarjetas
            </span>
          </div>
        </Link>
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
