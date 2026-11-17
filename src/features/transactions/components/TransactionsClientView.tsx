"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownRight,
  ArrowUpRight,
  PlusCircle,
  Search,
  CreditCard,
  Clock,
  Wallet,
  Pencil,
  Trash2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { TransactionForm } from "@/features/transactions/components/TransactionForm";
import {
  deleteTransaction,
  type TransactionRow,
} from "@/features/transactions/actions/transaction-actions";
import type { AccountRow } from "@/features/accounts/actions/account-actions";
import type { CategoryRow } from "@/features/categories/actions/category-actions";
import { formatMoneyCOP, addMoney, subtractMoney, roundMoney } from "@/lib/finance/money";

interface TransactionsClientViewProps {
  initialTransactions: TransactionRow[];
  accounts: AccountRow[];
  categories: CategoryRow[];
}

export function TransactionsClientView({
  initialTransactions,
  accounts,
  categories,
}: TransactionsClientViewProps) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [transactions, setTransactions] = useState<TransactionRow[]>(initialTransactions);
  const [editingTransaction, setEditingTransaction] = useState<TransactionRow | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<TransactionRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>("all");

  // Mapas auxiliares para búsqueda rápida de nombres de cuentas y categorías
  const accountsMap = useMemo(() => {
    return new Map(accounts.map((a) => [a.id, a]));
  }, [accounts]);

  const categoriesMap = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c]));
  }, [categories]);

  // Cálculos de métricas consolidadas
  let totalIncome = "0.00";
  let totalExpense = "0.00";

  for (const tx of transactions) {
    const amtStr = roundMoney(tx.amount);
    if (tx.transaction_type === "income") {
      totalIncome = addMoney(totalIncome, amtStr);
    } else {
      totalExpense = addMoney(totalExpense, amtStr);
    }
  }

  const netBalance = subtractMoney(totalIncome, totalExpense);

  // Filtrado reactivo de transacciones
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Filtro por tipo
      if (typeFilter !== "all" && tx.transaction_type !== typeFilter) {
        return false;
      }

      // Filtro por cuenta
      if (selectedAccountFilter !== "all" && tx.account_id !== selectedAccountFilter) {
        return false;
      }

      // Filtro por término de búsqueda (descripción o notas)
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const descMatch = tx.description.toLowerCase().includes(term);
        const notesMatch = tx.notes ? tx.notes.toLowerCase().includes(term) : false;
        const catName = categoriesMap.get(tx.category_id)?.name.toLowerCase() || "";
        const catMatch = catName.includes(term);
        return descMatch || notesMatch || catMatch;
      }

      return true;
    });
  }, [transactions, typeFilter, selectedAccountFilter, searchTerm, categoriesMap]);

  const handleTransactionCreated = () => {
    setIsDialogOpen(false);
    setFeedback({
      type: "success",
      message: "Transacción registrada exitosamente. Los saldos han sido actualizados.",
    });
    router.refresh();
  };

  const handleTransactionUpdated = () => {
    setEditingTransaction(null);
    setFeedback({
      type: "success",
      message: "Transacción actualizada correctamente. Los saldos asociados han sido recalculados.",
    });
    router.refresh();
  };

  const handleConfirmDelete = async () => {
    if (!deletingTransaction) return;
    try {
      setIsDeleting(true);
      const res = await deleteTransaction(deletingTransaction.id);
      if (!res.success) {
        setFeedback({ type: "error", message: res.error });
        return;
      }
      setTransactions((prev) => prev.filter((t) => t.id !== deletingTransaction.id));
      setDeletingTransaction(null);
      setFeedback({
        type: "success",
        message: "Transacción eliminada con éxito. El saldo de la cuenta ha sido recalculado.",
      });
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al eliminar la transacción";
      setFeedback({ type: "error", message: msg });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Alerta de Notificación / Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center justify-between gap-3 shadow-sm ${
            feedback.type === "success"
              ? "bg-[#10B981]/10 border border-[#10B981]/25 text-[#10B981]"
              : "bg-[#F43F5E]/10 border border-[#F43F5E]/30 text-[#F43F5E]"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-[#10B981] flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-[#F43F5E] flex-shrink-0" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-[#94A3B8] hover:text-[#F8FAFC] text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header y Modal Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-heading font-bold text-[#F8FAFC] tracking-tight">
            Transacciones y Movimientos
          </h2>
          <p className="text-sm text-[#94A3B8] mt-1">
            Registro de ingresos, gastos y compras diferidas a cuotas.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white shadow-[0_0_15px_rgba(139,92,246,0.3)] rounded-xl flex items-center gap-1.5 self-start sm:self-auto transition-all">
              <PlusCircle className="w-4 h-4" />
              <span>Nueva Transacción</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto bg-[#131B2E] border border-white/[0.08] text-[#F8FAFC] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
            <DialogHeader>
              <DialogTitle className="font-heading font-bold text-[#F8FAFC]">Registrar Transacción</DialogTitle>
              <DialogDescription className="text-xs text-[#94A3B8]">
                Ingresa los detalles del movimiento. En tarjetas de crédito puedes diferir a cuotas.
              </DialogDescription>
            </DialogHeader>
            <TransactionForm
              accounts={accounts}
              categories={categories}
              onSuccess={handleTransactionCreated}
              onCancel={() => setIsDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards de Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="surface-card p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-[#94A3B8]">Total Ingresos</span>
            <div className="w-8 h-8 rounded-lg bg-[#10B981]/15 border border-[#10B981]/25 flex items-center justify-center text-[#10B981]">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-heading font-extrabold text-[#10B981] mt-3">
            +{formatMoneyCOP(totalIncome)}
          </div>
          <p className="text-[11px] text-[#94A3B8] mt-0.5">Ingresos acumulados registrados</p>
        </div>

        <div className="surface-card p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-[#94A3B8]">Total Gastos</span>
            <div className="w-8 h-8 rounded-lg bg-[#F43F5E]/15 border border-[#F43F5E]/25 flex items-center justify-center text-[#F43F5E]">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-heading font-extrabold text-[#F43F5E] mt-3">
            -{formatMoneyCOP(totalExpense)}
          </div>
          <p className="text-[11px] text-[#94A3B8] mt-0.5">Gastos y compras en tarjetas</p>
        </div>

        <div className="surface-card p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-[#94A3B8]">Balance Neto</span>
            <div className="w-8 h-8 rounded-lg bg-[#8B5CF6]/15 border border-[#8B5CF6]/25 flex items-center justify-center text-[#8B5CF6]">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div
            className={`text-xl md:text-2xl font-heading font-extrabold mt-3 ${
              parseFloat(netBalance) >= 0
                ? "text-[#F8FAFC]"
                : "text-[#F43F5E]"
            }`}
          >
            {formatMoneyCOP(netBalance)}
          </div>
          <p className="text-[11px] text-[#94A3B8] mt-0.5">Ingresos menos gastos</p>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="surface-card p-4 rounded-2xl space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Búsqueda por texto */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <Input
              placeholder="Buscar por descripción o categoría..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-full bg-[#0B0F19] border-white/[0.1] text-[#F8FAFC] rounded-xl text-xs"
            />
          </div>

          {/* Filtro por Cuenta */}
          <div className="w-full sm:w-60">
            <select
              value={selectedAccountFilter}
              onChange={(e) => setSelectedAccountFilter(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-white/[0.1] bg-[#0B0F19] text-xs font-medium text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
            >
              <option value="all">Todas las cuentas</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.account_type === "credit_card" ? "Tarjeta" : "Cuenta"})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Pestañas de Tipo */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            variant={typeFilter === "all" ? "default" : "ghost"}
            size="sm"
            onClick={() => setTypeFilter("all")}
            className={typeFilter === "all" ? "bg-[#8B5CF6] text-white hover:bg-[#7C3AED] rounded-xl text-xs shadow-[0_0_12px_rgba(139,92,246,0.25)]" : "text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/[0.05] rounded-xl text-xs"}
          >
            Todos ({transactions.length})
          </Button>
          <Button
            variant={typeFilter === "income" ? "default" : "ghost"}
            size="sm"
            onClick={() => setTypeFilter("income")}
            className={typeFilter === "income" ? "bg-[#8B5CF6] text-white hover:bg-[#7C3AED] rounded-xl text-xs shadow-[0_0_12px_rgba(139,92,246,0.25)]" : "text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/[0.05] rounded-xl text-xs"}
          >
            Ingresos ({transactions.filter((t) => t.transaction_type === "income").length})
          </Button>
          <Button
            variant={typeFilter === "expense" ? "default" : "ghost"}
            size="sm"
            onClick={() => setTypeFilter("expense")}
            className={typeFilter === "expense" ? "bg-[#8B5CF6] text-white hover:bg-[#7C3AED] rounded-xl text-xs shadow-[0_0_12px_rgba(139,92,246,0.25)]" : "text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/[0.05] rounded-xl text-xs"}
          >
            Gastos ({transactions.filter((t) => t.transaction_type === "expense").length})
          </Button>
        </div>
      </div>

      {/* Lista de Transacciones */}
      {filteredTransactions.length === 0 ? (
        <div className="surface-card p-12 rounded-2xl border-dashed border-white/[0.1] text-center">
          <Clock className="w-10 h-10 text-[#94A3B8]/40 mx-auto mb-3" />
          <h3 className="text-base font-heading font-bold text-[#F8FAFC]">
            No hay transacciones que coincidan con los filtros
          </h3>
          <p className="text-xs text-[#94A3B8] mt-1">
            Registra tu primer movimiento financiero o ajusta la búsqueda.
          </p>
          <div className="mt-4">
            <Button
              onClick={() => setIsDialogOpen(true)}
              size="sm"
              className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-xl"
            >
              Registrar Movimiento
            </Button>
          </div>
        </div>
      ) : (
        <div className="surface-card rounded-2xl overflow-hidden">
          <div className="divide-y divide-white/[0.06]">
            {filteredTransactions.map((tx) => {
              const isIncome = tx.transaction_type === "income";
              const account = accountsMap.get(tx.account_id);
              const category = categoriesMap.get(tx.category_id);
              const isCredit = account?.account_type === "credit_card";

              return (
                <div
                  key={tx.id}
                  className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isIncome
                          ? "bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/20"
                          : "bg-white/[0.05] text-[#94A3B8] border border-white/[0.08]"
                      }`}
                    >
                      {isIncome ? (
                        <ArrowDownRight className="w-5 h-5" />
                      ) : (
                        <ArrowUpRight className="w-5 h-5" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm sm:text-base font-heading font-bold text-[#F8FAFC] truncate">
                          {tx.description}
                        </h4>
                        {tx.is_installment && tx.installment_count > 1 && (
                          <span className="px-2 py-0.5 rounded-full bg-[#8B5CF6]/15 border border-[#8B5CF6]/25 text-[#8B5CF6] text-[10px] font-bold tracking-wide uppercase flex-shrink-0">
                            {tx.installment_count} cuotas
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#94A3B8] mt-0.5">
                        <span>{tx.transaction_date}</span>
                        <span>•</span>
                        <span className="text-[#F8FAFC] font-medium">
                          {category?.name || "Sin categoría"}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-[#94A3B8]">
                          {isCredit ? <CreditCard className="w-3 h-3" /> : <Wallet className="w-3 h-3" />}
                          <span>{account?.name || "Cuenta desconocida"}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <div
                        className={`text-base sm:text-lg font-heading font-extrabold tracking-tight ${
                          isIncome
                            ? "text-[#10B981]"
                            : "text-[#F8FAFC]"
                        }`}
                      >
                        {isIncome ? "+" : "-"}
                        {formatMoneyCOP(tx.amount)}
                      </div>
                      {tx.is_installment && tx.installment_count > 1 && (
                        <span className="text-[11px] text-[#94A3B8] block">
                          Diferido mensual
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 border-l border-white/[0.08] pl-2 sm:pl-3">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingTransaction(tx)}
                        title="Editar transacción"
                        className="h-8 w-8 p-0 text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/[0.05] rounded-lg"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span className="sr-only">Editar</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingTransaction(tx)}
                        title="Eliminar transacción"
                        className="h-8 w-8 p-0 text-[#F43F5E] hover:text-rose-300 hover:bg-[#F43F5E]/10 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="sr-only">Eliminar</span>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal de Edición de Transacción */}
      <Dialog
        open={Boolean(editingTransaction)}
        onOpenChange={(open) => !open && setEditingTransaction(null)}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto bg-[#131B2E] border border-white/[0.08] text-[#F8FAFC] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
          <DialogHeader>
            <DialogTitle className="font-heading font-bold text-[#F8FAFC]">Editar Transacción</DialogTitle>
            <DialogDescription className="text-xs text-[#94A3B8]">
              Modifica los detalles del movimiento. Los saldos de las cuentas se recalcularán automáticamente.
            </DialogDescription>
          </DialogHeader>
          {editingTransaction && (
            <TransactionForm
              accounts={accounts}
              categories={categories}
              initialData={editingTransaction}
              onSuccess={handleTransactionUpdated}
              onCancel={() => setEditingTransaction(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogo de Confirmación de Eliminación */}
      <ConfirmDeleteDialog
        open={Boolean(deletingTransaction)}
        onOpenChange={(open) => !open && setDeletingTransaction(null)}
        title="¿Eliminar esta transacción?"
        description={`¿Estás seguro de eliminar "${deletingTransaction?.description}" por ${formatMoneyCOP(
          deletingTransaction?.amount || 0
        )}? El saldo de la cuenta se ajustará automáticamente.`}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}
