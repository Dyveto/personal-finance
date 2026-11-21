"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CreditCard,
  Calendar,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { AccountForm } from "@/features/accounts/components/AccountForm";
import { InstallmentProjectionsCard } from "@/features/dashboard/components/InstallmentProjectionsCard";
import {
  deleteAccount,
  type AccountRow,
} from "@/features/accounts/actions/account-actions";
import type { CreditCardStatementRow } from "@/types/database.types";
import type { ProjectedInstallment } from "@/lib/finance/projections";
import type { MarkExtractAsPaidResult } from "@/features/credit-cards/actions/statement-actions";
import { formatMoneyCOP, addMoney, subtractMoney, roundMoney } from "@/lib/finance/money";

interface CreditCardsClientViewProps {
  initialCreditCards: AccountRow[];
  initialPaymentAccounts: AccountRow[];
  initialStatements: CreditCardStatementRow[];
  projections: ProjectedInstallment[];
}

export function CreditCardsClientView({
  initialCreditCards,
  initialPaymentAccounts,
  initialStatements,
  projections,
}: CreditCardsClientViewProps) {
  const router = useRouter();
  const [creditCards, setCreditCards] = useState<AccountRow[]>(initialCreditCards);
  const [paymentAccounts, setPaymentAccounts] = useState<AccountRow[]>(initialPaymentAccounts);
  const [statements, setStatements] = useState<CreditCardStatementRow[]>(initialStatements);
  const [editingCard, setEditingCard] = useState<AccountRow | null>(null);
  const [deletingCard, setDeletingCard] = useState<AccountRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Sincronizar estado local al revalidar datos del servidor
  useEffect(() => {
    setCreditCards(initialCreditCards);
  }, [initialCreditCards]);

  useEffect(() => {
    setPaymentAccounts(initialPaymentAccounts);
  }, [initialPaymentAccounts]);

  useEffect(() => {
    setStatements(initialStatements);
  }, [initialStatements]);

  // KPIs calculados reactivamente
  let totalDebt = "0.00";
  let totalLimit = "0.00";
  let totalAvailableMoney = "0.00";

  for (const card of creditCards) {
    totalDebt = addMoney(totalDebt, roundMoney(card.current_balance));
    if (card.credit_limit) {
      totalLimit = addMoney(totalLimit, roundMoney(card.credit_limit));
    }
  }

  for (const acc of paymentAccounts) {
    totalAvailableMoney = addMoney(totalAvailableMoney, roundMoney(acc.current_balance));
  }

  const availableCredit = subtractMoney(totalLimit, totalDebt);

  // Manejador del pago exitoso de un extracto
  const handleStatementPaid = (result: MarkExtractAsPaidResult) => {
    // 1. Actualizar optimísticamente la tarjeta de crédito (reducción de deuda)
    setCreditCards((prevCards) =>
      prevCards.map((card) => {
        if (card.id === result.statement.account_id) {
          const currentDebtStr = roundMoney(card.current_balance);
          const paidStr = roundMoney(result.amountPaid);
          const newDebt = Math.max(0, parseFloat(subtractMoney(currentDebtStr, paidStr)));
          return { ...card, current_balance: newDebt };
        }
        return card;
      })
    );

    // 2. Si se utilizó una cuenta de pago, actualizar su saldo
    if (result.paymentAccountId) {
      setPaymentAccounts((prevAccs) =>
        prevAccs.map((acc) => {
          if (acc.id === result.paymentAccountId) {
            const currentBalStr = roundMoney(acc.current_balance);
            const paidStr = roundMoney(result.amountPaid);
            const newBal = parseFloat(subtractMoney(currentBalStr, paidStr));
            return { ...acc, current_balance: newBal };
          }
          return acc;
        })
      );
    }

    // 3. Registrar el extracto en la lista local
    setStatements((prev) => [result.statement, ...prev]);

    // 4. Mostrar notificación de éxito y refrescar servidor
    setSuccessNotice(
      `¡Extracto ${result.statement.statement_month} pagado con éxito! Se redujo la deuda en ${formatMoneyCOP(
        result.amountPaid
      )} y los KPIs se actualizaron de inmediato.`
    );

    router.refresh();

    setTimeout(() => {
      setSuccessNotice(null);
    }, 6000);
  };

  const handleCardUpdated = (updatedCard: AccountRow) => {
    setCreditCards((prev) =>
      prev.map((c) => (c.id === updatedCard.id ? updatedCard : c))
    );
    setEditingCard(null);
    setSuccessNotice(`Tarjeta "${updatedCard.name}" actualizada con éxito.`);
    router.refresh();
    setTimeout(() => setSuccessNotice(null), 5000);
  };

  const handleConfirmDeleteCard = async () => {
    if (!deletingCard) return;
    try {
      setIsDeleting(true);
      setErrorNotice(null);
      const res = await deleteAccount(deletingCard.id);
      if (!res || typeof res !== "object" || !("success" in res) || !res.success) {
        const errorMsg =
          res && typeof res === "object" && "error" in res && typeof res.error === "string"
            ? res.error
            : "No se pudo eliminar la tarjeta por un error inesperado del servidor.";
        setErrorNotice(errorMsg);
        return;
      }
      setCreditCards((prev) => prev.filter((c) => c.id !== deletingCard.id));
      setDeletingCard(null);
      setSuccessNotice(`Tarjeta "${deletingCard.name}" eliminada exitosamente.`);
      router.refresh();
      setTimeout(() => setSuccessNotice(null), 5000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al eliminar la tarjeta";
      setErrorNotice(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Encabezado y Acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-heading font-bold text-slate-900 dark:text-[#F8FAFC] tracking-tight">
            Tarjetas de Crédito
          </h2>
          <p className="text-sm text-slate-600 dark:text-[#94A3B8] mt-1">
            Control de cupos, fechas de corte, días de pago, extractos y compras diferidas a cuotas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/accounts">
            <Button variant="outline" className="text-xs border-slate-300 dark:border-white/[0.08] bg-white dark:bg-[#131B2E] text-slate-700 dark:text-[#F8FAFC] hover:bg-slate-100 dark:hover:bg-white/[0.05] rounded-xl">
              Gestionar Cuentas
            </Button>
          </Link>
          <Link href="/transactions">
            <Button className="text-xs bg-[#8B5CF6] hover:bg-[#7C3AED] text-white shadow-[0_0_15px_rgba(139,92,246,0.3)] rounded-xl flex items-center gap-1.5 transition-all">
              <PlusCircle className="w-4 h-4" />
              <span>Nueva Compra</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Banner de éxito al pagar un extracto o modificar tarjeta */}
      {successNotice && (
        <div className="p-4 rounded-xl border border-[#10B981]/25 bg-[#10B981]/10 text-[#10B981] text-xs flex items-center justify-between shadow-sm animate-in fade-in-50 duration-300">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-[#10B981] flex-shrink-0" />
            <span>{successNotice}</span>
          </div>
          <button
            onClick={() => setSuccessNotice(null)}
            className="text-xs font-semibold underline text-[#10B981] ml-4 hover:opacity-80"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Banner de error */}
      {errorNotice && (
        <div className="p-4 rounded-xl border border-[#F43F5E]/30 bg-[#F43F5E]/10 text-[#F43F5E] text-xs flex items-center justify-between shadow-sm animate-in fade-in-50 duration-300">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-[#F43F5E] flex-shrink-0" />
            <span>{errorNotice}</span>
          </div>
          <button
            onClick={() => setErrorNotice(null)}
            className="text-xs font-semibold underline text-[#F43F5E] ml-4 hover:opacity-80"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* KPIs del Dashboard de Crédito */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="surface-card p-6 rounded-2xl">
          <p className="text-xs font-semibold text-slate-600 dark:text-[#94A3B8] uppercase tracking-wider">
            Deuda Total Tarjetas
          </p>
          <p className="text-2xl md:text-3xl font-heading font-extrabold text-[#F43F5E] mt-2">
            {formatMoneyCOP(totalDebt)}
          </p>
          <p className="text-xs text-slate-600 dark:text-[#94A3B8] mt-1">Saldo utilizado acumulado</p>
        </div>

        <div className="surface-card p-6 rounded-2xl">
          <p className="text-xs font-semibold text-slate-600 dark:text-[#94A3B8] uppercase tracking-wider">
            Cupo Disponible Total
          </p>
          <p className="text-2xl md:text-3xl font-heading font-extrabold text-[#10B981] mt-2">
            {formatMoneyCOP(availableCredit)}
          </p>
          <p className="text-xs text-slate-600 dark:text-[#94A3B8] mt-1">Límite restante para compras</p>
        </div>

        <div className="surface-card p-6 rounded-2xl">
          <p className="text-xs font-semibold text-slate-600 dark:text-[#94A3B8] uppercase tracking-wider">
            Cupo Global Aprobado
          </p>
          <p className="text-2xl md:text-3xl font-heading font-extrabold text-slate-900 dark:text-[#F8FAFC] mt-2">
            {formatMoneyCOP(totalLimit)}
          </p>
          <p className="text-xs text-slate-600 dark:text-[#94A3B8] mt-1">Suma de cupos autorizados</p>
        </div>

        <div className="surface-card p-6 rounded-2xl">
          <p className="text-xs font-semibold text-slate-600 dark:text-[#94A3B8] uppercase tracking-wider">
            Dinero Disponible
          </p>
          <p className="text-2xl md:text-3xl font-heading font-extrabold text-[#8B5CF6] mt-2">
            {formatMoneyCOP(totalAvailableMoney)}
          </p>
          <p className="text-xs text-slate-600 dark:text-[#94A3B8] mt-1">Saldo en cuentas y efectivo</p>
        </div>
      </div>

      {/* Listado de Tarjetas Activas */}
      <div className="space-y-4">
        <h3 className="text-lg font-heading font-bold text-slate-900 dark:text-[#F8FAFC] flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-[#8B5CF6]" />
          <span>Tus Tarjetas de Crédito</span>
        </h3>

        {creditCards.length === 0 ? (
          <div className="surface-card p-8 rounded-2xl border-dashed border-slate-300 dark:border-white/[0.1] text-center">
            <CreditCard className="w-12 h-12 text-slate-400 dark:text-[#94A3B8]/40 mx-auto mb-3" />
            <h4 className="text-base font-heading font-semibold text-slate-900 dark:text-[#F8FAFC]">
              No tienes tarjetas de crédito registradas
            </h4>
            <p className="text-xs text-slate-600 dark:text-[#94A3B8] mt-1 max-w-sm mx-auto">
              Registra una tarjeta de crédito en la sección de Cuentas para monitorear cortes, pagos y compras en cuotas.
            </p>
            <Link href="/accounts" className="inline-block mt-4">
              <Button size="sm" className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-xl">
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
              const usagePercent =
                limitNum > 0 ? Math.min(100, Math.round((debtNum / limitNum) * 100)) : 0;

              return (
                <div
                  key={card.id}
                  className="surface-card p-6 rounded-2xl text-slate-900 dark:text-[#F8FAFC] relative overflow-hidden flex flex-col justify-between min-h-[220px]"
                >
                  <div className="relative z-10">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-widest text-slate-600 dark:text-[#94A3B8]">
                        {card.currency}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingCard(card)}
                          title="Editar tarjeta"
                          className="h-7 w-7 p-0 text-slate-600 hover:text-slate-900 dark:text-[#94A3B8] dark:hover:text-[#F8FAFC] hover:bg-slate-100 dark:hover:bg-white/[0.05] rounded-lg"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span className="sr-only">Editar</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingCard(card)}
                          title="Eliminar tarjeta"
                          className="h-7 w-7 p-0 text-[#F43F5E] hover:text-rose-300 hover:bg-[#F43F5E]/10 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="sr-only">Eliminar</span>
                        </Button>
                        <CreditCard className="w-5 h-5 text-[#8B5CF6] ml-1" />
                      </div>
                    </div>

                    <h4 className="text-lg font-heading font-bold mt-3 tracking-wide text-slate-900 dark:text-[#F8FAFC]">{card.name}</h4>
                    <p className="text-2xl font-heading font-extrabold mt-1 text-slate-900 dark:text-[#F8FAFC]">
                      {formatMoneyCOP(debt)}
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-[#94A3B8]">Saldo actual adeudado</p>
                  </div>

                  <div className="relative z-10 pt-4 mt-4 border-t border-slate-200 dark:border-white/[0.08] text-xs text-slate-600 dark:text-[#94A3B8] space-y-2">
                    <div className="flex justify-between items-center text-[11px]">
                      <span>Cupo: {formatMoneyCOP(limit)}</span>
                      <span>Disp: {formatMoneyCOP(available)}</span>
                    </div>

                    {/* Barra de progreso de cupo */}
                    <div className="w-full bg-slate-200 dark:bg-white/[0.08] rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          usagePercent > 80
                            ? "bg-[#F43F5E]"
                            : usagePercent > 50
                            ? "bg-amber-400"
                            : "bg-[#10B981]"
                        }`}
                        style={{ width: `${usagePercent}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-slate-600 dark:text-slate-400 pt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" /> Corte: día{" "}
                        {card.closing_day || "-"}
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

      {/* Proyección de Obligaciones y Control de Extractos Pagados */}
      <InstallmentProjectionsCard
        projections={projections}
        paymentAccounts={paymentAccounts}
        statements={statements}
        onStatementPaid={handleStatementPaid}
      />

      {/* Modal de Edición de Tarjeta */}
      <Dialog
        open={Boolean(editingCard)}
        onOpenChange={(open) => !open && setEditingCard(null)}
      >
        <DialogContent className="sm:max-w-md bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-[#F8FAFC] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
          <DialogHeader>
            <DialogTitle className="font-heading font-bold text-slate-900 dark:text-[#F8FAFC]">Editar Tarjeta de Crédito</DialogTitle>
            <DialogDescription className="text-xs text-slate-600 dark:text-[#94A3B8]">
              Modifica el cupo, fecha de corte o fecha límite de pago de tu tarjeta.
            </DialogDescription>
          </DialogHeader>
          {editingCard && (
            <AccountForm
              account={editingCard}
              onSuccess={handleCardUpdated}
              onCancel={() => setEditingCard(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogo de Confirmación de Eliminación de Tarjeta */}
      <ConfirmDeleteDialog
        open={Boolean(deletingCard)}
        onOpenChange={(open) => !open && setDeletingCard(null)}
        title="¿Eliminar esta tarjeta de crédito?"
        description={`¿Estás seguro de eliminar "${deletingCard?.name}"? Esta acción eliminará permanentemente todas sus transacciones vinculadas y recalculará la deuda acumulada.`}
        onConfirm={handleConfirmDeleteCard}
        isDeleting={isDeleting}
      />
    </div>
  );
}
