"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Wallet,
  CreditCard,
  CreditCard as CardIcon,
  Building2,
  PlusCircle,
  Calendar,
  ShieldAlert,
  Pencil,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AccountForm } from "@/features/accounts/components/AccountForm";
import type { AccountRow } from "@/features/accounts/actions/account-actions";
import { formatMoneyCOP, addMoney, subtractMoney, roundMoney } from "@/lib/finance/money";

interface AccountsClientViewProps {
  initialAccounts: AccountRow[];
}

export function AccountsClientView({ initialAccounts }: AccountsClientViewProps) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountRow | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountRow[]>(initialAccounts);
  const [activeTab, setActiveTab] = useState<"all" | "standard" | "credit">("all");

  // Cálculos consolidados
  let totalAvailable = "0.00";
  let totalDebt = "0.00";
  let totalCreditLimit = "0.00";

  for (const acc of accounts) {
    const balStr = roundMoney(acc.current_balance);
    if (acc.account_type === "cash" || acc.account_type === "bank") {
      totalAvailable = addMoney(totalAvailable, balStr);
    } else if (acc.account_type === "credit_card") {
      totalDebt = addMoney(totalDebt, balStr);
      if (acc.credit_limit) {
        totalCreditLimit = addMoney(totalCreditLimit, roundMoney(acc.credit_limit));
      }
    }
  }

  const availableCredit = subtractMoney(totalCreditLimit, totalDebt);

  const filteredAccounts = accounts.filter((acc) => {
    if (activeTab === "standard") return acc.account_type === "cash" || acc.account_type === "bank";
    if (activeTab === "credit") return acc.account_type === "credit_card";
    return true;
  });

  const handleAccountCreated = (newAccount: AccountRow) => {
    setAccounts((prev) => [newAccount, ...prev]);
    setIsDialogOpen(false);
    setSuccessNotice(`Cuenta "${newAccount.name}" registrada exitosamente.`);
    setTimeout(() => setSuccessNotice(null), 5000);
    router.refresh();
  };

  const handleAccountUpdated = (updatedAccount: AccountRow) => {
    setAccounts((prev) =>
      prev.map((acc) => (acc.id === updatedAccount.id ? updatedAccount : acc))
    );
    setEditingAccount(null);
    setSuccessNotice(`Cuenta "${updatedAccount.name}" actualizada exitosamente.`);
    setTimeout(() => setSuccessNotice(null), 5000);
    router.refresh();
  };

  return (
    <div className="space-y-8">
      {/* Header con botón para abrir modal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Gestión de Cuentas y Tarjetas
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Administra tus cuentas bancarias, billeteras de efectivo y tarjetas de crédito.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 self-start sm:self-auto">
              <PlusCircle className="w-4 h-4" />
              <span>Nueva Cuenta</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Registrar Nueva Cuenta</DialogTitle>
              <DialogDescription>
                Crea una cuenta bancaria, efectivo o tarjeta de crédito con reglas de corte y pago.
              </DialogDescription>
            </DialogHeader>
            <AccountForm
              onSuccess={handleAccountCreated}
              onCancel={() => setIsDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>

        {/* Modal de Edición de Cuenta */}
        <Dialog
          open={!!editingAccount}
          onOpenChange={(open) => {
            if (!open) setEditingAccount(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Cuenta o Tarjeta</DialogTitle>
              <DialogDescription>
                Modifica los detalles, saldo o configuración de corte y pago de tu cuenta.
              </DialogDescription>
            </DialogHeader>
            {editingAccount && (
              <AccountForm
                account={editingAccount}
                onSuccess={handleAccountUpdated}
                onCancel={() => setEditingAccount(null)}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Banner de Notificación de Éxito */}
      {successNotice && (
        <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 text-sm flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span>{successNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessNotice(null)}
            className="text-xs text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-200 font-semibold"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-400">Total Disponible</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white mt-3">
            {formatMoneyCOP(totalAvailable)}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Bancos + Efectivo</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-400">Deuda en Tarjetas</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-3">
            {formatMoneyCOP(totalDebt)}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Saldo pendiente por pagar</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-400">Cupo Total Aprobado</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <CardIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white mt-3">
            {formatMoneyCOP(totalCreditLimit)}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Límite consolidado</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-400">Cupo Disponible</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white mt-3">
            {formatMoneyCOP(availableCredit)}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Cupo libre para usar</p>
        </div>
      </div>

      {/* Tabs Filter */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <Button
          variant={activeTab === "all" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("all")}
          className={activeTab === "all" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : ""}
        >
          Todas ({accounts.length})
        </Button>
        <Button
          variant={activeTab === "standard" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("standard")}
          className={activeTab === "standard" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : ""}
        >
          Bancos y Efectivo (
          {accounts.filter((a) => a.account_type === "cash" || a.account_type === "bank").length})
        </Button>
        <Button
          variant={activeTab === "credit" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("credit")}
          className={activeTab === "credit" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : ""}
        >
          Tarjetas de Crédito ({accounts.filter((a) => a.account_type === "credit_card").length})
        </Button>
      </div>

      {/* Grid de Cuentas */}
      {filteredAccounts.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 text-center">
          <Building2 className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            No se encontraron cuentas en esta categoría
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Utiliza el botón de &quot;Nueva Cuenta&quot; para registrar una.
          </p>
          <div className="mt-4">
            <Button
              onClick={() => setIsDialogOpen(true)}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Registrar Cuenta
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAccounts.map((acc) => {
            const isCredit = acc.account_type === "credit_card";
            const creditLimitStr = acc.credit_limit ? roundMoney(acc.credit_limit) : "0.00";
            const balanceStr = roundMoney(acc.current_balance);
            const remainingCredit = isCredit ? subtractMoney(creditLimitStr, balanceStr) : "0.00";

            return (
              <div
                key={acc.id}
                className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                        {isCredit
                          ? "Tarjeta de Crédito"
                          : acc.account_type === "bank"
                          ? "Cuenta Bancaria"
                          : "Efectivo"}
                      </span>
                      <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mt-0.5">
                        {acc.name}
                      </h3>
                      {acc.institution && (
                        <span className="text-xs text-slate-500 dark:text-slate-400 block">
                          {acc.institution}
                        </span>
                      )}
                    </div>
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        isCredit
                          ? "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400"
                          : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
                      }`}
                    >
                      {isCredit ? <CreditCard className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
                    </div>
                  </div>

                  {/* Saldo Principal */}
                  <div className="mt-5">
                    <span className="text-xs text-slate-400 block">
                      {isCredit ? "Deuda Actual Pendiente:" : "Saldo Disponible:"}
                    </span>
                    <div
                      className={`text-2xl font-extrabold tracking-tight mt-0.5 ${
                        isCredit
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-slate-900 dark:text-white"
                      }`}
                    >
                      {formatMoneyCOP(acc.current_balance)}
                    </div>
                  </div>

                  {/* Detalle para Tarjetas de Crédito */}
                  {isCredit && (
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                      <div className="flex justify-between text-slate-600 dark:text-slate-300">
                        <span className="text-slate-400">Cupo Total:</span>
                        <span className="font-semibold">{formatMoneyCOP(acc.credit_limit || 0)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-300">
                        <span className="text-slate-400">Cupo Libre:</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatMoneyCOP(remainingCredit)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 pt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Día de Corte:</span>
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {acc.closing_day} de cada mes
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Límite Pago:</span>
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          Día {acc.payment_due_day}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Activa</span>
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingAccount(acc)}
                    className="h-7 px-2.5 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border-slate-200 dark:border-slate-700 flex items-center gap-1 rounded-lg"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
