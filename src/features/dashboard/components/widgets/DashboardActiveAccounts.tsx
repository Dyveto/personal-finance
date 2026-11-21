"use client";

import Link from "next/link";
import { Building2, CreditCard, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoneyCOP } from "@/lib/finance/money";
import type { AccountRow } from "@/types/database.types";

interface DashboardActiveAccountsProps {
  accounts: AccountRow[];
}

export function DashboardActiveAccounts({ accounts }: DashboardActiveAccountsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-heading font-bold text-slate-900 dark:text-[#F8FAFC]">
            Cuentas Activas
          </h3>
          <p className="text-xs text-slate-500 dark:text-[#94A3B8]">
            Saldos disponibles y obligaciones de tarjetas de crédito
          </p>
        </div>
        <Link
          href="/accounts"
          className="text-xs font-semibold text-amber-600 hover:text-amber-700 dark:text-[#D4AF37] dark:hover:text-[#F3E5AB] transition-colors"
        >
          Ver todas ({accounts.length})
        </Link>
      </div>

      {accounts.length === 0 ? (
        <div className="surface-card p-8 rounded-2xl border-dashed border-slate-300 dark:border-white/[0.15] text-center">
          <Building2 className="w-8 h-8 text-slate-400 dark:text-[#94A3B8] mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-900 dark:text-[#F8FAFC]">
            No tienes cuentas registradas
          </p>
          <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-1">
            Agrega tu primera cuenta bancaria o tarjeta para comenzar.
          </p>
          <div className="mt-4">
            <Link href="/accounts">
              <Button
                size="sm"
                variant="outline"
                className="border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#131B2E] text-slate-800 dark:text-[#F8FAFC] hover:bg-slate-100 dark:hover:bg-[#1a233a] rounded-xl"
              >
                Registrar Cuenta
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((acc) => {
            const isCredit = acc.account_type === "credit_card";
            return (
              <div
                key={acc.id}
                className="surface-card p-5 rounded-2xl flex flex-col justify-between transition-all hover:border-amber-500/30 dark:hover:border-[#D4AF37]/30"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-400 dark:text-[#94A3B8] uppercase tracking-wider block">
                      {isCredit
                        ? "Tarjeta de Crédito"
                        : acc.account_type === "bank"
                        ? "Banco"
                        : "Efectivo"}
                    </span>
                    <h4 className="text-base font-heading font-bold text-slate-900 dark:text-[#F8FAFC] mt-0.5">
                      {acc.name}
                    </h4>
                    {acc.institution && (
                      <span className="text-xs text-slate-500 dark:text-[#94A3B8]">
                        {acc.institution}
                      </span>
                    )}
                  </div>
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      isCredit
                        ? "bg-[#F43F5E]/15 text-[#F43F5E] border border-[#F43F5E]/20"
                        : "bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/20"
                    }`}
                  >
                    {isCredit ? <CreditCard className="w-4 h-4" /> : <Wallet className="w-4 h-4" />}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/[0.08] flex items-end justify-between">
                  <div>
                    <span className="text-[11px] text-slate-400 dark:text-[#94A3B8] block">
                      {isCredit ? "Deuda actual:" : "Saldo disponible:"}
                    </span>
                    <span
                      className={`text-lg font-heading font-extrabold ${
                        isCredit ? "text-[#F43F5E]" : "text-slate-900 dark:text-[#F8FAFC]"
                      }`}
                    >
                      {formatMoneyCOP(acc.current_balance)}
                    </span>
                  </div>
                  {isCredit && acc.closing_day && (
                    <div className="text-right">
                      <span className="text-[11px] text-slate-400 dark:text-[#94A3B8] block">
                        Corte día:
                      </span>
                      <span className="text-xs font-bold text-slate-800 dark:text-[#F8FAFC]">
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
  );
}
