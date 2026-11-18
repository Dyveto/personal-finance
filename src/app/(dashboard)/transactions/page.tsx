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
    (!txResult.success && typeof txResult.error === "string" && txResult.error.includes("Unauthorized")) ||
    (!accountsResult.success && typeof accountsResult.error === "string" && accountsResult.error.includes("Unauthorized")) ||
    (!categoriesResult.success && typeof categoriesResult.error === "string" && categoriesResult.error.includes("Unauthorized"));

  if (isAuthError) {
    return (
      <div className="w-full h-auto pb-12 space-y-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-heading font-bold text-slate-900 dark:text-[#F8FAFC] tracking-tight">
            Transacciones y Movimientos
          </h2>
          <p className="text-sm text-slate-500 dark:text-[#94A3B8] mt-1">
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
    <div className="w-full h-auto pb-12">
      <TransactionsClientView
        initialTransactions={transactions}
        accounts={accounts}
        categories={categories}
      />
    </div>
  );
}
