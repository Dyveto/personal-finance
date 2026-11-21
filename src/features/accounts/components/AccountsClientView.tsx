"use client";

import { useState, useEffect } from "react";
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
  Trash2,
  CheckCircle2,
  AlertCircle,
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
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { AccountForm } from "@/features/accounts/components/AccountForm";
import {
  deleteAccount,
  type AccountRow,
} from "@/features/accounts/actions/account-actions";
import { formatMoneyCOP, addMoney, subtractMoney, roundMoney } from "@/lib/finance/money";

interface AccountsClientViewProps {
  initialAccounts: AccountRow[];
}

export function AccountsClientView({ initialAccounts }: AccountsClientViewProps) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountRow | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<AccountRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountRow[]>(initialAccounts);
  const [activeTab, setActiveTab] = useState<"all" | "standard" | "credit">("all");

  // Sincronizar estado local al recibir nuevos datos desde revalidación del servidor
  useEffect(() => {
    setAccounts(initialAccounts);
  }, [initialAccounts]);

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

  const handleConfirmDelete = async () => {
    if (!deletingAccount) return;
    try {
      setIsDeleting(true);
      setErrorNotice(null);
      const res = await deleteAccount(deletingAccount.id);
      if (!res || typeof res !== "object" || !("success" in res) || !res.success) {
        const errorMsg =
          res && typeof res === "object" && "error" in res && typeof res.error === "string"
            ? res.error
            : "No se pudo eliminar la cuenta por un error inesperado del servidor.";
        setErrorNotice(errorMsg);
        return;
      }
      setAccounts((prev) => prev.filter((a) => a.id !== deletingAccount.id));
      setDeletingAccount(null);
      setSuccessNotice(`Cuenta "${deletingAccount.name}" eliminada exitosamente.`);
      setTimeout(() => setSuccessNotice(null), 5000);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al eliminar la cuenta";
      setErrorNotice(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header con botón para abrir modal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-heading font-bold text-slate-900 dark:text-[#F8FAFC] tracking-tight">
            Gestión de Cuentas y Tarjetas
          </h2>
          <p className="text-sm text-slate-600 dark:text-[#94A3B8] mt-1">
            Administra tus cuentas bancarias, billeteras de efectivo y tarjetas de crédito.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white shadow-[0_0_15px_rgba(139,92,246,0.3)] rounded-xl flex items-center gap-1.5 self-start sm:self-auto transition-all">
              <PlusCircle className="w-4 h-4" />
              <span>Nueva Cuenta</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-[#F8FAFC] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
            <DialogHeader>
              <DialogTitle className="font-heading font-bold text-slate-900 dark:text-[#F8FAFC]">Registrar Nueva Cuenta</DialogTitle>
              <DialogDescription className="text-xs text-slate-600 dark:text-[#94A3B8]">
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
          <DialogContent className="sm:max-w-md bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-[#F8FAFC] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
            <DialogHeader>
              <DialogTitle className="font-heading font-bold text-slate-900 dark:text-[#F8FAFC]">Editar Cuenta o Tarjeta</DialogTitle>
              <DialogDescription className="text-xs text-slate-600 dark:text-[#94A3B8]">
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
        <div className="p-4 rounded-xl border border-[#10B981]/25 bg-[#10B981]/10 text-[#10B981] text-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-[#10B981] flex-shrink-0" />
            <span>{successNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessNotice(null)}
            className="text-xs text-[#10B981] hover:underline font-semibold"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Banner de Notificación de Error */}
      {errorNotice && (
        <div className="p-4 rounded-xl border border-[#F43F5E]/30 bg-[#F43F5E]/10 text-[#F43F5E] text-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-[#F43F5E] flex-shrink-0" />
            <span>{errorNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorNotice(null)}
            className="text-xs text-[#F43F5E] hover:underline font-semibold"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="surface-card p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-600 dark:text-[#94A3B8]">Total Disponible</span>
            <div className="w-8 h-8 rounded-lg bg-[#10B981]/15 border border-[#10B981]/25 flex items-center justify-center text-[#10B981]">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-heading font-extrabold text-[#10B981] mt-3">
            {formatMoneyCOP(totalAvailable)}
          </div>
          <p className="text-[11px] text-slate-600 dark:text-[#94A3B8] mt-0.5">Bancos + Efectivo</p>
        </div>

        <div className="surface-card p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-600 dark:text-[#94A3B8]">Deuda en Tarjetas</span>
            <div className="w-8 h-8 rounded-lg bg-[#F43F5E]/15 border border-[#F43F5E]/25 flex items-center justify-center text-[#F43F5E]">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-heading font-extrabold text-[#F43F5E] mt-3">
            {formatMoneyCOP(totalDebt)}
          </div>
          <p className="text-[11px] text-slate-600 dark:text-[#94A3B8] mt-0.5">Saldo pendiente por pagar</p>
        </div>

        <div className="surface-card p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-600 dark:text-[#94A3B8]">Cupo Total Aprobado</span>
            <div className="w-8 h-8 rounded-lg bg-[#8B5CF6]/15 border border-[#8B5CF6]/25 flex items-center justify-center text-[#8B5CF6]">
              <CardIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-heading font-extrabold text-slate-900 dark:text-[#F8FAFC] mt-3">
            {formatMoneyCOP(totalCreditLimit)}
          </div>
          <p className="text-[11px] text-slate-600 dark:text-[#94A3B8] mt-0.5">Límite consolidado</p>
        </div>

        <div className="surface-card p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-600 dark:text-[#94A3B8]">Cupo Disponible</span>
            <div className="w-8 h-8 rounded-lg bg-[#8B5CF6]/15 border border-[#8B5CF6]/25 flex items-center justify-center text-[#8B5CF6]">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-heading font-extrabold text-[#8B5CF6] mt-3">
            {formatMoneyCOP(availableCredit)}
          </div>
          <p className="text-[11px] text-slate-600 dark:text-[#94A3B8] mt-0.5">Cupo libre para usar</p>
        </div>
      </div>

      {/* Tabs Filter */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/[0.08] pb-3">
        <Button
          variant={activeTab === "all" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("all")}
          className={activeTab === "all" ? "bg-[#8B5CF6] text-white hover:bg-[#7C3AED] rounded-xl shadow-[0_0_12px_rgba(139,92,246,0.25)]" : "text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC] hover:bg-slate-100 dark:hover:bg-white/[0.05] rounded-xl"}
        >
          Todas ({accounts.length})
        </Button>
        <Button
          variant={activeTab === "standard" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("standard")}
          className={activeTab === "standard" ? "bg-[#8B5CF6] text-white hover:bg-[#7C3AED] rounded-xl shadow-[0_0_12px_rgba(139,92,246,0.25)]" : "text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC] hover:bg-slate-100 dark:hover:bg-white/[0.05] rounded-xl"}
        >
          Bancos y Efectivo (
          {accounts.filter((a) => a.account_type === "cash" || a.account_type === "bank").length})
        </Button>
        <Button
          variant={activeTab === "credit" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("credit")}
          className={activeTab === "credit" ? "bg-[#8B5CF6] text-white hover:bg-[#7C3AED] rounded-xl shadow-[0_0_12px_rgba(139,92,246,0.25)]" : "text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC] hover:bg-slate-100 dark:hover:bg-white/[0.05] rounded-xl"}
        >
          Tarjetas de Crédito ({accounts.filter((a) => a.account_type === "credit_card").length})
        </Button>
      </div>

      {/* Grid de Cuentas */}
      {filteredAccounts.length === 0 ? (
        <div className="surface-card p-12 rounded-2xl border-dashed border-slate-300 dark:border-white/[0.1] text-center">
          <Building2 className="w-10 h-10 text-slate-400 dark:text-[#94A3B8]/40 mx-auto mb-3" />
          <h3 className="text-base font-heading font-bold text-slate-900 dark:text-[#F8FAFC]">
            No se encontraron cuentas en esta categoría
          </h3>
          <p className="text-xs text-slate-600 dark:text-[#94A3B8] mt-1">
            Utiliza el botón de &quot;Nueva Cuenta&quot; para registrar una.
          </p>
          <div className="mt-4">
            <Button
              onClick={() => setIsDialogOpen(true)}
              size="sm"
              className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-xl"
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
                className="surface-card p-6 rounded-2xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#94A3B8] block">
                        {isCredit
                          ? "Tarjeta de Crédito"
                          : acc.account_type === "bank"
                          ? "Cuenta Bancaria"
                          : "Efectivo"}
                      </span>
                      <h3 className="text-lg font-heading font-extrabold text-slate-900 dark:text-[#F8FAFC] mt-0.5">
                        {acc.name}
                      </h3>
                      {acc.institution && (
                        <span className="text-xs text-slate-600 dark:text-[#94A3B8] block">
                          {acc.institution}
                        </span>
                      )}
                    </div>
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        isCredit
                          ? "bg-[#F43F5E]/15 text-[#F43F5E] border border-[#F43F5E]/20"
                          : "bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/20"
                      }`}
                    >
                      {isCredit ? <CreditCard className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
                    </div>
                  </div>

                  {/* Saldo Principal */}
                  <div className="mt-5">
                    <span className="text-xs text-slate-600 dark:text-[#94A3B8] block">
                      {isCredit ? "Deuda Actual Pendiente:" : "Saldo Disponible:"}
                    </span>
                    <div
                      className={`text-2xl font-heading font-extrabold tracking-tight mt-0.5 ${
                        isCredit
                          ? "text-[#F43F5E]"
                          : "text-slate-900 dark:text-[#F8FAFC]"
                      }`}
                    >
                      {formatMoneyCOP(acc.current_balance)}
                    </div>
                  </div>

                  {/* Detalle para Tarjetas de Crédito */}
                  {isCredit && (
                    <div className="mt-4 pt-3 border-t border-slate-200 dark:border-white/[0.08] space-y-2 text-xs">
                      <div className="flex justify-between text-slate-600 dark:text-[#94A3B8]">
                        <span className="text-slate-600 dark:text-[#94A3B8]">Cupo Total:</span>
                        <span className="font-semibold text-slate-900 dark:text-[#F8FAFC]">{formatMoneyCOP(acc.credit_limit || 0)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-[#94A3B8]">
                        <span className="text-slate-600 dark:text-[#94A3B8]">Cupo Libre:</span>
                        <span className="font-semibold text-[#10B981]">
                          {formatMoneyCOP(remainingCredit)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600 dark:text-[#94A3B8] pt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Día de Corte:</span>
                        </span>
                        <span className="font-bold text-slate-900 dark:text-[#F8FAFC]">
                          {acc.closing_day} de cada mes
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600 dark:text-[#94A3B8]">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Límite Pago:</span>
                        </span>
                        <span className="font-bold text-slate-900 dark:text-[#F8FAFC]">
                          Día {acc.payment_due_day}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-5 pt-3 border-t border-slate-200 dark:border-white/[0.08] flex items-center justify-between text-[11px] text-slate-600 dark:text-[#94A3B8]">
                  <span className="flex items-center gap-1 text-[#10B981] font-medium">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Activa</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingAccount(acc)}
                      className="h-7 px-2.5 text-xs text-slate-700 dark:text-[#F8FAFC] border-slate-300 dark:border-white/[0.08] bg-slate-50 dark:bg-[#0B0F19] hover:bg-slate-100 dark:hover:bg-white/[0.05] flex items-center gap-1 rounded-xl"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDeletingAccount(acc)}
                      className="h-7 px-2.5 text-xs text-[#F43F5E] hover:bg-[#F43F5E]/10 border-slate-300 dark:border-white/[0.08] bg-slate-50 dark:bg-[#0B0F19] flex items-center gap-1 rounded-xl"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar</span>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Diálogo de Confirmación de Eliminación de Cuenta */}
      <ConfirmDeleteDialog
        open={Boolean(deletingAccount)}
        onOpenChange={(open) => !open && setDeletingAccount(null)}
        title="¿Eliminar esta cuenta?"
        description={`¿Estás seguro de eliminar "${deletingAccount?.name}"? Esta acción eliminará permanentemente todas sus transacciones asociadas y actualizará los balances.`}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}
