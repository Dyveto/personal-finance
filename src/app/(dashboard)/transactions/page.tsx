import { listTransactions } from "@/features/transactions/actions/transaction-actions";
import { listAccounts } from "@/features/accounts/actions/account-actions";
import { listCategories } from "@/features/categories/actions/category-actions";
import { TransactionsClientView } from "@/features/transactions/components/TransactionsClientView";
import { AlertCircle } from "lucide-react";

export const metadata = {
  title: "Transacciones | Personal Finance",
  description: "Historial de ingresos, gastos y compras diferidas a cuotas.",
};

export default async function TransactionsPage() {
  const [txResult, accountsResult, categoriesResult] = await Promise.all([
    listTransactions(),
    listAccounts(),
    listCategories(),
  ]);

  const transactions = txResult.success ? txResult.data : [];
  const accounts = accountsResult.success ? accountsResult.data : [];
  const categories = categoriesResult.success ? categoriesResult.data : [];

  const isAuthError =
    (!txResult.success && txResult.error.includes("Unauthorized")) ||
    (!accountsResult.success && accountsResult.error.includes("Unauthorized"));

  if (isAuthError) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Transacciones y Movimientos
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Registro de ingresos, gastos y compras diferidas a cuotas.
          </p>
        </div>

        <div className="p-6 rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-base font-bold text-amber-900 dark:text-amber-200">
              Inicio de sesión requerido
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              Inicia sesión con Supabase Auth para acceder a tus movimientos financieros privados y registrar transacciones.
            </p>
          </div>
        </div>

        <TransactionsClientView
          initialTransactions={[]}
          accounts={accounts}
          categories={categories}
        />
      </div>
    );
  }

  return (
    <TransactionsClientView
      initialTransactions={transactions}
      accounts={accounts}
      categories={categories}
    />
  );
}
