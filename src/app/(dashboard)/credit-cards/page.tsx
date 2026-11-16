import { listAccounts } from "@/features/accounts/actions/account-actions";
import { listTransactions } from "@/features/transactions/actions/transaction-actions";
import { listAllStatements } from "@/features/credit-cards/actions/statement-actions";
import { projectTransactionInstallments } from "@/lib/finance/projections";
import { CreditCardsClientView } from "@/features/credit-cards/components/CreditCardsClientView";

export const metadata = {
  title: "Tarjetas de Crédito | Personal Finance",
  description: "Administración detallada de tarjetas de crédito, fechas de corte, pagos, extractos y compras diferidas.",
};

export default async function CreditCardsPage() {
  const [accountsRes, txRes, statementsRes] = await Promise.all([
    listAccounts(),
    listTransactions({ limit: 100 }),
    listAllStatements(),
  ]);

  const allAccounts = accountsRes.success ? accountsRes.data : [];
  const creditCards = allAccounts.filter((acc) => acc.account_type === "credit_card");
  const paymentAccounts = allAccounts.filter(
    (acc) => acc.account_type === "bank" || acc.account_type === "cash"
  );

  const transactions = txRes.success ? txRes.data : [];
  const statements = statementsRes.success ? statementsRes.data : [];

  const installmentPurchases = transactions.filter(
    (tx) => tx.is_installment && tx.installment_count && tx.installment_count > 1
  );

  // Proyecciones mensuales calculadas a partir de compras a cuotas activas
  const projections = installmentPurchases.flatMap((tx) => {
    const card = creditCards.find((c) => c.id === tx.account_id);
    if (!card || !card.closing_day || !card.payment_due_day) return [];
    return projectTransactionInstallments(tx, {
      id: card.id,
      name: card.name,
      closing_day: card.closing_day,
      payment_due_day: card.payment_due_day,
    });
  });

  return (
    <CreditCardsClientView
      initialCreditCards={creditCards}
      initialPaymentAccounts={paymentAccounts}
      initialStatements={statements}
      projections={projections}
    />
  );
}
