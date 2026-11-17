"use client";

import { Wallet, CreditCard, PiggyBank } from "lucide-react";
import { formatMoneyCOP } from "@/lib/finance/money";

interface DashboardKpiWidgetProps {
  availableMoney: string;
  creditDebt: string;
  totalCreditLimit: string;
}

export function DashboardKpiWidget({
  availableMoney,
  creditDebt,
  totalCreditLimit,
}: DashboardKpiWidgetProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {/* 1. Dinero Disponible (Efectivo + Bancos) */}
      <div className="surface-card p-6 rounded-2xl animate-stagger-1 relative overflow-hidden transition-all hover:border-[#10B981]/30">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider text-slate-500 dark:text-[#94A3B8] uppercase">
            Dinero Disponible
          </span>
          <div className="w-10 h-10 rounded-xl bg-[#10B981]/15 border border-[#10B981]/25 flex items-center justify-center text-[#10B981]">
            <Wallet className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4">
          <div className="text-2xl md:text-3xl font-heading font-bold text-[#10B981] tracking-tight">
            {formatMoneyCOP(availableMoney)}
          </div>
          <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-1">
            Total en cuentas de ahorro, corriente y efectivo
          </p>
        </div>
      </div>

      {/* 2. Deuda Total en Tarjetas de Crédito */}
      <div className="surface-card p-6 rounded-2xl animate-stagger-2 relative overflow-hidden transition-all hover:border-[#F43F5E]/30">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider text-slate-500 dark:text-[#94A3B8] uppercase">
            Deuda en Tarjetas
          </span>
          <div className="w-10 h-10 rounded-xl bg-[#F43F5E]/15 border border-[#F43F5E]/25 flex items-center justify-center text-[#F43F5E]">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4">
          <div className="text-2xl md:text-3xl font-heading font-bold text-[#F43F5E] tracking-tight">
            {formatMoneyCOP(creditDebt)}
          </div>
          <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-1">
            Monto pendiente por pagar en extractos
          </p>
        </div>
      </div>

      {/* 3. Cupo Total de Crédito */}
      <div className="surface-card p-6 rounded-2xl animate-stagger-3 relative overflow-hidden sm:col-span-2 lg:col-span-1 transition-all hover:border-[#8B5CF6]/30">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider text-slate-500 dark:text-[#94A3B8] uppercase">
            Cupo de Crédito Total
          </span>
          <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/15 border border-[#8B5CF6]/25 flex items-center justify-center text-[#8B5CF6]">
            <PiggyBank className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4">
          <div className="text-2xl md:text-3xl font-heading font-bold text-slate-900 dark:text-[#F8FAFC] tracking-tight">
            {formatMoneyCOP(totalCreditLimit)}
          </div>
          <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-1">
            Límite de crédito consolidado disponible
          </p>
        </div>
      </div>
    </div>
  );
}
