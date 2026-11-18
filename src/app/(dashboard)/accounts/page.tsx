import { listAccounts } from "@/features/accounts/actions/account-actions";
import { AccountsClientView } from "@/features/accounts/components/AccountsClientView";
import { AlertCircle } from "lucide-react";

export const metadata = {
  title: "Cuentas y Tarjetas | Personal Finance",
  description: "Administración de cuentas bancarias, efectivo y tarjetas de crédito.",
};

export default async function AccountsPage() {
  const result = await listAccounts();

  if (!result.success) {
    const isAuthError = typeof result.error === "string" && result.error.includes("Unauthorized");

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Gestión de Cuentas y Tarjetas
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Administra tus cuentas bancarias, billeteras de efectivo y tarjetas de crédito.
          </p>
        </div>

        <div className="p-6 rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-base font-bold text-amber-900 dark:text-amber-200">
              {isAuthError ? "Inicio de sesión requerido" : "Aviso al cargar cuentas"}
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              {isAuthError
                ? "Debes iniciar sesión con Supabase Auth para ver y gestionar tus cuentas privadas."
                : result.error}
            </p>
          </div>
        </div>

        <AccountsClientView initialAccounts={[]} />
      </div>
    );
  }

  return <AccountsClientView initialAccounts={result.data} />;
}
