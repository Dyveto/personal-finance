import { listAccounts } from "@/features/accounts/actions/account-actions";
import { listTransactions } from "@/features/transactions/actions/transaction-actions";
import { listCategories } from "@/features/categories/actions/category-actions";
import { listAllStatements } from "@/features/credit-cards/actions/statement-actions";
import { getDashboardLayout } from "@/features/dashboard/actions/dashboard-actions";
import { addMoney, roundMoney } from "@/lib/finance/money";
import type {
  MonthlyFlowItem,
  CategoryExpenseItem,
} from "@/features/dashboard/components/FinancialCharts";
import {
  projectTransactionInstallments,
  type ProjectedInstallment,
} from "@/lib/finance/projections";
import { WelcomeHubDashboard } from "@/features/dashboard/components/WelcomeHubDashboard";

export default async function DashboardPage() {
  // Consumir Server Actions concurrentemente
  const [
    accountsResult,
    transactionsResult,
    categoriesResult,
    statementsResult,
    layoutResult,
  ] = await Promise.all([
    listAccounts(),
    listTransactions({ limit: 300 }),
    listCategories(),
    listAllStatements(),
    getDashboardLayout(),
  ]);

  const accounts = accountsResult.success ? accountsResult.data : [];
  const transactions = transactionsResult.success ? transactionsResult.data : [];
  const categories = categoriesResult.success ? categoriesResult.data : [];
  const statements = statementsResult.success ? statementsResult.data : [];
  const initialLayout = layoutResult.success ? layoutResult.data : null;

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
    <WelcomeHubDashboard
      accounts={accounts}
      transactions={transactions}
      categories={categories}
      statements={statements}
      initialLayout={initialLayout}
      authRequired={authRequired}
      availableMoney={availableMoney}
      creditDebt={creditDebt}
      totalCreditLimit={totalCreditLimit}
      monthlyData={monthlyData}
      categoryData={categoryData}
      allProjections={allProjections}
    />
  );
}
