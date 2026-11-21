"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Clock } from "lucide-react";
import { formatMoneyCOP } from "@/lib/finance/money";
import type { TransactionRow } from "@/types/database.types";

interface DashboardRecentTransactionsProps {
  transactions: TransactionRow[];
}

export function DashboardRecentTransactions({
  transactions,
}: DashboardRecentTransactionsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-heading font-bold text-slate-900 dark:text-[#F8FAFC]">
            Transacciones Recientes
          </h3>
          <p className="text-xs text-slate-500 dark:text-[#94A3B8]">
            Últimos movimientos de ingresos y gastos registrados
          </p>
        </div>
        <Link
          href="/transactions"
          className="text-xs font-semibold text-amber-600 hover:text-amber-700 dark:text-[#D4AF37] dark:hover:text-[#F3E5AB] transition-colors"
        >
          Ver historial
        </Link>
      </div>

      <div className="surface-card p-5 rounded-2xl">
        {transactions.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-7 h-7 text-slate-400 dark:text-[#94A3B8] mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-500 dark:text-[#94A3B8]">
              Sin transacciones recientes
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
            {transactions.slice(0, 6).map((tx) => {
              const isIncome = tx.transaction_type === "income";
              return (
                <div
                  key={tx.id}
                  className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isIncome
                          ? "bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/25"
                          : "bg-[#F43F5E]/15 text-[#F43F5E] border border-[#F43F5E]/25"
                      }`}
                    >
                      {isIncome ? (
                        <ArrowDownRight className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-[#F8FAFC] truncate">
                        {tx.description}
                      </p>
                      <span className="text-[11px] text-slate-400 dark:text-[#94A3B8] block">
                        {tx.transaction_date}
                        {tx.is_installment && ` · ${tx.installment_count} cuotas`}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-sm font-heading font-bold flex-shrink-0 ${
                      isIncome ? "text-[#10B981]" : "text-[#F43F5E]"
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
  );
}
