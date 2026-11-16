import Link from "next/link";
import {
  Wallet,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  PlusCircle,
  PiggyBank,
  AlertCircle,
  Building2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { listAccounts } from "@/features/accounts/actions/account-actions";
import { listTransactions } from "@/features/transactions/actions/transaction-actions";
import { listCategories } from "@/features/categories/actions/category-actions";
import { listAllStatements } from "@/features/credit-cards/actions/statement-actions";
import { formatMoneyCOP, addMoney, roundMoney } from "@/lib/finance/money";
import {
  FinancialCharts,
  type MonthlyFlowItem,
  type CategoryExpenseItem,
} from "@/features/dashboard/components/FinancialCharts";
import { InstallmentProjectionsCard } from "@/features/dashboard/components/InstallmentProjectionsCard";
import {
  projectTransactionInstallments,
  type ProjectedInstallment,
} from "@/lib/finance/projections";

export default async function DashboardPage() {
  // Consumir Server Actions concurrentemente
  const [accountsResult, transactionsResult, categoriesResult, statementsResult] = await Promise.all([
    listAccounts(),
    listTransactions({ limit: 50 }),
    listCategories(),
    listAllStatements(),
  ]);

  const accounts = accountsResult.success ? accountsResult.data : [];
  const transactions = transactionsResult.success ? transactionsResult.data : [];
  const categories = categoriesResult.success ? categoriesResult.data : [];
  const statements = statementsResult.success ? statementsResult.data : [];
  const paymentAccounts = accounts.filter(
    (a) => a.account_type === "cash" || a.account_type === "bank"
  );
  const authRequired = !accountsResult.success && accountsResult.error.includes("Unauthorized");

  // Mapas auxiliares
  const accountsMap = new Map(accounts.map((a) => [a.id, a]));
  const categoriesMap = new Map(categories.map((c) => [c.id, c.name]));

  // Cálculos financieros distinguiendo dinero disponible vs deuda en tarjetas
  let availableMoney = "0.00";
  let creditDebt = "0.00";
  let totalCreditLimit = "0.00";

  for (const acc of accounts) {
    const balStr = roundMoney(acc.current_balance);
    if (acc.account_type === "cash" || acc.account_type === "bank") {
      availableMoney = addMoney(availableMoney, balStr);
    } else if (acc.account_type === "credit_card") {
      creditDebt = addMoney(creditDebt, balStr);
      if (acc.credit_limit) {
        totalCreditLimit = addMoney(totalCreditLimit, roundMoney(acc.credit_limit));
      }
    }
  }

  // 1. Datos para Gráfico de Flujo Mensual (Ingresos vs. Gastos)
  const monthlyFlowMap = new Map<string, { income: number; expense: number }>();
  for (const tx of transactions) {
    const monthKey = tx.transaction_date.slice(0, 7); // YYYY-MM
    const current = monthlyFlowMap.get(monthKey) || { income: 0, expense: 0 };
    if (tx.transaction_type === "income") {
      current.income += tx.amount;
    } else {
      current.expense += tx.amount;
    }
    monthlyFlowMap.set(monthKey, current);
  }

  const monthlyData: MonthlyFlowItem[] = Array.from(monthlyFlowMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, data]) => ({
      month,
      income: parseFloat(data.income.toFixed(2)),
      expense: parseFloat(data.expense.toFixed(2)),
    }));

  // 2. Datos para Gráfico de Categorías de Gastos
  const categoryExpenseMap = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.transaction_type === "expense") {
      const catName = categoriesMap.get(tx.category_id) || "Otros Gastos";
      categoryExpenseMap.set(catName, (categoryExpenseMap.get(catName) || 0) + tx.amount);
    }
  }

  const categoryData: CategoryExpenseItem[] = Array.from(categoryExpenseMap.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([name, value]) => ({
      name,
      value: parseFloat(value.toFixed(2)),
    }));

  // 3. Proyección de Compras Diferidas en Tarjetas de Crédito
  const allProjections: ProjectedInstallment[] = [];
  for (const tx of transactions) {
    if (tx.is_installment && tx.installment_count > 1) {
      const card = accountsMap.get(tx.account_id);
      if (
        card &&
        card.account_type === "credit_card" &&
        card.closing_day &&
        card.payment_due_day
      ) {
        const projected = projectTransactionInstallments(tx, {
          id: card.id,
          name: card.name,
          closing_day: card.closing_day,
          payment_due_day: card.payment_due_day,
        });
        allProjections.push(...projected);
      }
    }
  }

  return (
    <div className="space-y-8">
      {/* Welcome Banner & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Resumen Financiero
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Control de cuentas, tarjetas de crédito, gráficos interactivos y proyecciones.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link href="/transactions">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5">
              <PlusCircle className="w-4 h-4" />
              <span>Nueva Transacción</span>
            </Button>
          </Link>
          <Link href="/accounts">
            <Button variant="outline" className="border-slate-300 dark:border-slate-700">
              Gestionar Cuentas
            </Button>
          </Link>
        </div>
      </div>

      {/* Alerta de sesión no iniciada (si corresponde) */}
      {authRequired && (
        <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              Modo Invitado / Sesión requerida
            </p>
            <p className="text-amber-700 dark:text-amber-300 mt-0.5">
              Inicia sesión con Supabase Auth para acceder a tus cuentas reales y proyecciones aisladas por RLS.
            </p>
          </div>
        </div>
      )}

      {/* Tarjetas Principales de Métricas Financieras */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* 1. Dinero Disponible (Efectivo + Bancos) */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
              Dinero Disponible
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {formatMoneyCOP(availableMoney)}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Total en cuentas de ahorro, corriente y efectivo
            </p>
          </div>
        </div>

        {/* 2. Deuda Total en Tarjetas de Crédito */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
              Deuda en Tarjetas
            </span>
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl md:text-3xl font-extrabold text-rose-600 dark:text-rose-400 tracking-tight">
              {formatMoneyCOP(creditDebt)}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Monto pendiente por pagar en extractos
            </p>
          </div>
        </div>

        {/* 3. Cupo Total de Crédito */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
              Cupo de Crédito Total
            </span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <PiggyBank className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {formatMoneyCOP(totalCreditLimit)}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Límite de crédito consolidado disponible
            </p>
          </div>
        </div>
      </div>

      {/* Gráficos Financieros Interactivos (Recharts) */}
      <FinancialCharts monthlyData={monthlyData} categoryData={categoryData} />

      {/* Tarjeta de Proyección de Cuotas Diferidas y Control de Extractos */}
      <InstallmentProjectionsCard
        projections={allProjections}
        paymentAccounts={paymentAccounts}
        statements={statements}
      />

      {/* Cuentas y Transacciones Recientes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Cuentas Activas
            </h3>
            <Link
              href="/accounts"
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Ver todas ({accounts.length})
            </Link>
          </div>

          {accounts.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 text-center">
              <Building2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                No tienes cuentas registradas
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Agrega tu primera cuenta bancaria o tarjeta para comenzar.
              </p>
              <div className="mt-4">
                <Link href="/accounts">
                  <Button size="sm" variant="outline">
                    Registrar Cuenta
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {accounts.map((acc) => {
                const isCredit = acc.account_type === "credit_card";
                return (
                  <div
                    key={acc.id}
                    className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                          {isCredit ? "Tarjeta de Crédito" : acc.account_type === "bank" ? "Banco" : "Efectivo"}
                        </span>
                        <h4 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                          {acc.name}
                        </h4>
                        {acc.institution && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {acc.institution}
                          </span>
                        )}
                      </div>
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          isCredit
                            ? "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400"
                            : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
                        }`}
                      >
                        {isCredit ? <CreditCard className="w-4 h-4" /> : <Wallet className="w-4 h-4" />}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-end justify-between">
                      <div>
                        <span className="text-[11px] text-slate-400 block">
                          {isCredit ? "Deuda actual:" : "Saldo disponible:"}
                        </span>
                        <span
                          className={`text-lg font-extrabold ${
                            isCredit
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-slate-900 dark:text-white"
                          }`}
                        >
                          {formatMoneyCOP(acc.current_balance)}
                        </span>
                      </div>
                      {isCredit && acc.closing_day && (
                        <div className="text-right">
                          <span className="text-[11px] text-slate-400 block">Corte día:</span>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            {acc.closing_day}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Últimas Transacciones */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Transacciones Recientes
            </h3>
            <Link
              href="/transactions"
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Ver historial
            </Link>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            {transactions.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="w-7 h-7 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Sin transacciones recientes
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {transactions.slice(0, 5).map((tx) => {
                  const isIncome = tx.transaction_type === "income";
                  return (
                    <div key={tx.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isIncome
                              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {isIncome ? (
                            <ArrowDownRight className="w-4 h-4" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {tx.description}
                          </p>
                          <span className="text-[11px] text-slate-400 block">
                            {tx.transaction_date}
                            {tx.is_installment && ` · ${tx.installment_count} cuotas`}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-sm font-bold flex-shrink-0 ${
                          isIncome
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-slate-900 dark:text-white"
                        }`}
                      >
                        {isIncome ? "+" : "-"}
                        {formatMoneyCOP(tx.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
