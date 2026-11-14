import { listAccounts } from "@/features/accounts/actions/account-actions";
import { listTransactions } from "@/features/transactions/actions/transaction-actions";
import { InstallmentProjectionsCard } from "@/features/dashboard/components/InstallmentProjectionsCard";
import { projectTransactionInstallments } from "@/lib/finance/projections";
import { formatMoneyCOP, addMoney, roundMoney, subtractMoney } from "@/lib/finance/money";
import { CreditCard, Calendar } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Tarjetas de Crédito | Personal Finance",
  description: "Administración detallada de tarjetas de crédito, fechas de corte, pagos y compras diferidas.",
};

export default async function CreditCardsPage() {
  const [accountsRes, txRes] = await Promise.all([
    listAccounts(),
    listTransactions({ limit: 100 }),
  ]);

  const allAccounts = accountsRes.success ? accountsRes.data : [];
  const creditCards = allAccounts.filter((acc) => acc.account_type === "credit_card");

  const transactions = txRes.success ? txRes.data : [];
  const installmentPurchases = transactions.filter((tx) => tx.is_installment && tx.installment_count && tx.installment_count > 1);

  // Proyecciones
  const projections = installmentPurchases.flatMap((tx) => {
    const card = creditCards.find((c) => c.id === tx.account_id);
    if (!card || !card.closing_day || !card.payment_due_day) return [];
    return projectTransactionInstallments(tx, {
      name: card.name,
      closing_day: card.closing_day,
      payment_due_day: card.payment_due_day,
    });
  });

  // Métricas de crédito
  let totalDebt = "0.00";
  let totalLimit = "0.00";

  for (const card of creditCards) {
    totalDebt = addMoney(totalDebt, roundMoney(card.current_balance));
    if (card.credit_limit) {
      totalLimit = addMoney(totalLimit, roundMoney(card.credit_limit));
    }
  }

  const availableCredit = subtractMoney(totalLimit, totalDebt);

  return (
    <div className="space-y-8">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Tarjetas de Crédito
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Control de cupos, fechas de corte, días de pago y compras diferidas a cuotas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/accounts">
            <Button variant="outline" className="text-xs">
              Gestionar Cuentas
            </Button>
          </Link>
          <Link href="/transactions">
            <Button className="text-xs bg-blue-600 hover:bg-blue-700 text-white">
              Nueva Compra
            </Button>
          </Link>
        </div>
      </div>

      {/* Tarjetas de Resumen KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Deuda Total Tarjetas</p>
          <p className="text-2xl md:text-3xl font-extrabold text-rose-600 dark:text-rose-400 mt-2">
            {formatMoneyCOP(totalDebt)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Saldo utilizado acumulado</p>
        </div>

        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cupo Disponible Total</p>
          <p className="text-2xl md:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">
            {formatMoneyCOP(availableCredit)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Límite restante para uso</p>
        </div>

        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cupo Global Aprobado</p>
          <p className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white mt-2">
            {formatMoneyCOP(totalLimit)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Suma de límites de todas las tarjetas</p>
        </div>
      </div>

      {/* Listado de Tarjetas Activas */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <span>Tus Tarjetas de Crédito</span>
        </h3>

        {creditCards.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 text-center bg-white dark:bg-slate-900">
            <CreditCard className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <h4 className="text-base font-semibold text-slate-700 dark:text-slate-300">
              No tienes tarjetas de crédito registradas
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Registra una tarjeta de crédito en la sección de Cuentas para monitorear cortes, pagos y compras en cuotas.
            </p>
            <Link href="/accounts" className="inline-block mt-4">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                Crear Tarjeta de Crédito
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {creditCards.map((card) => {
              const debt = roundMoney(card.current_balance);
              const limit = card.credit_limit ? roundMoney(card.credit_limit) : "0.00";
              const available = subtractMoney(limit, debt);
              const limitNum = Number(limit);
              const debtNum = Number(debt);
              const usagePercent = limitNum > 0 ? Math.min(100, Math.round((debtNum / limitNum) * 100)) : 0;

              return (
                <div
                  key={card.id}
                  className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-lg border border-slate-700 relative overflow-hidden flex flex-col justify-between min-h-[220px]"
                >
                  <div className="relative z-10">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                        {card.currency}
                      </span>
                      <CreditCard className="w-6 h-6 text-blue-400" />
                    </div>

                    <h4 className="text-lg font-bold mt-3 tracking-wide">{card.name}</h4>
                    <p className="text-2xl font-extrabold mt-1 text-white">
                      {formatMoneyCOP(debt)}
                    </p>
                    <p className="text-[11px] text-slate-400">Saldo actual adeudado</p>
                  </div>

                  <div className="relative z-10 pt-4 mt-4 border-t border-slate-700/60 text-xs text-slate-300 space-y-2">
                    <div className="flex justify-between items-center text-[11px]">
                      <span>Cupo: {formatMoneyCOP(limit)}</span>
                      <span>Disp: {formatMoneyCOP(available)}</span>
                    </div>

                    {/* Barra de progreso de cupo */}
                    <div className="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          usagePercent > 80 ? "bg-rose-500" : usagePercent > 50 ? "bg-amber-400" : "bg-emerald-400"
                        }`}
                        style={{ width: `${usagePercent}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-blue-400" /> Corte: día {card.closing_day || "-"}
                      </span>
                      <span>Pago: día {card.payment_due_day || "-"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Proyección de Obligaciones y Cuotas */}
      <InstallmentProjectionsCard projections={projections} />
    </div>
  );
}
