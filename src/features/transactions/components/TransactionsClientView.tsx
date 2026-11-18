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
  Filter,
  Layers,
  PieChart,
  Tag,
  RotateCcw,
  Calendar,
  ChevronDown,
  ChevronUp,
  Utensils,
  Car,
  Home,
  Heart,
  Film,
  ShoppingBag,
  BookOpen,
  MoreHorizontal,
  Laptop,
  TrendingUp,
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
import { CategoryMultiSelect } from "@/features/transactions/components/CategoryMultiSelect";
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

type DatePreset = "all" | "this_month" | "last_30_days" | "this_year" | "custom";

function formatCivilDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Mapeo de icono de categoría con base en el nombre de icono registrado o tipo
 */
function renderCategoryIcon(iconName: string | null, type: "income" | "expense") {
  switch (iconName) {
    case "wallet":
      return <Wallet className="w-4 h-4" />;
    case "laptop":
      return <Laptop className="w-4 h-4" />;
    case "trending-up":
      return <TrendingUp className="w-4 h-4" />;
    case "plus-circle":
      return <PlusCircle className="w-4 h-4" />;
    case "utensils":
      return <Utensils className="w-4 h-4" />;
    case "car":
      return <Car className="w-4 h-4" />;
    case "home":
      return <Home className="w-4 h-4" />;
    case "heart":
      return <Heart className="w-4 h-4" />;
    case "film":
      return <Film className="w-4 h-4" />;
    case "shopping-bag":
      return <ShoppingBag className="w-4 h-4" />;
    case "book":
      return <BookOpen className="w-4 h-4" />;
    case "more-horizontal":
      return <MoreHorizontal className="w-4 h-4" />;
    default:
      return type === "income" ? (
        <ArrowDownRight className="w-4 h-4" />
      ) : (
        <Tag className="w-4 h-4" />
      );
  }
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

  // Estados de filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>("all");
  const [selectedCategoryNames, setSelectedCategoryNames] = useState<string[]>([]);
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Estados visuales de la sección de categorías
  const [isCategorySummaryOpen, setIsCategorySummaryOpen] = useState(true);
  const [categoryViewTab, setCategoryViewTab] = useState<"all" | "expense" | "income">("all");

  // Mapas auxiliares para búsqueda rápida de nombres de cuentas y categorías
  const accountsMap = useMemo(() => {
    return new Map(accounts.map((a) => [a.id, a]));
  }, [accounts]);

  const categoriesMap = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c]));
  }, [categories]);

  // Aplicación rápida de presets de fecha
  const handleDatePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();

    if (preset === "all") {
      setStartDate("");
      setEndDate("");
    } else if (preset === "this_month") {
      const y = now.getFullYear();
      const m = now.getMonth();
      const s = `${y}-${String(m + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(y, m + 1, 0).getDate();
      const e = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      setStartDate(s);
      setEndDate(e);
    } else if (preset === "last_30_days") {
      const prior = new Date();
      prior.setDate(now.getDate() - 30);
      setStartDate(formatCivilDateISO(prior));
      setEndDate(formatCivilDateISO(now));
    } else if (preset === "this_year") {
      const y = now.getFullYear();
      setStartDate(`${y}-01-01`);
      setEndDate(`${y}-12-31`);
    }
  };

  // Restablecer todos los filtros
  const handleClearFilters = () => {
    setSearchTerm("");
    setTypeFilter("all");
    setSelectedAccountFilter("all");
    setSelectedCategoryNames([]);
    setDatePreset("all");
    setStartDate("");
    setEndDate("");
  };

  const isFilterActive =
    searchTerm.trim() !== "" ||
    typeFilter !== "all" ||
    selectedAccountFilter !== "all" ||
    selectedCategoryNames.length > 0 ||
    startDate !== "" ||
    endDate !== "";

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

      // Filtro por categoría (unificado por nombre base y multi-select)
      if (selectedCategoryNames.length > 0) {
        const cat = categoriesMap.get(tx.category_id);
        const catName = cat?.name.trim().toLowerCase() || "";
        const matches = selectedCategoryNames.some(
          (name) => name.trim().toLowerCase() === catName
        );
        if (!matches) {
          return false;
        }
      }

      // Filtro por rango de fechas
      if (startDate && tx.transaction_date < startDate) {
        return false;
      }
      if (endDate && tx.transaction_date > endDate) {
        return false;
      }

      // Filtro por término de búsqueda (descripción, notas, categoría o cuenta)
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const descMatch = tx.description.toLowerCase().includes(term);
        const notesMatch = tx.notes ? tx.notes.toLowerCase().includes(term) : false;
        const catName = categoriesMap.get(tx.category_id)?.name.toLowerCase() || "";
        const catMatch = catName.includes(term);
        const accName = accountsMap.get(tx.account_id)?.name.toLowerCase() || "";
        const accMatch = accName.includes(term);
        return descMatch || notesMatch || catMatch || accMatch;
      }

      return true;
    });
  }, [
    transactions,
    typeFilter,
    selectedAccountFilter,
    selectedCategoryNames,
    startDate,
    endDate,
    searchTerm,
    categoriesMap,
    accountsMap,
  ]);

  // Cálculos de métricas globales (históricas sin filtros)
  let overallIncome = "0.00";
  let overallExpense = "0.00";
  for (const tx of transactions) {
    const amtStr = roundMoney(tx.amount);
    if (tx.transaction_type === "income") {
      overallIncome = addMoney(overallIncome, amtStr);
    } else {
      overallExpense = addMoney(overallExpense, amtStr);
    }
  }

  // Cálculos dinámicos en tiempo real por categoría y métricas de transacciones filtradas
  const {
    filteredIncome,
    filteredExpense,
    filteredNet,
    categorySummariesExpense,
    categorySummariesIncome,
  } = useMemo(() => {
    let fIncome = "0.00";
    let fExpense = "0.00";

    interface CategoryAccumulator {
      id: string;
      name: string;
      type: "income" | "expense";
      icon: string | null;
      totalAmount: string;
      count: number;
    }

    const expenseMap = new Map<string, CategoryAccumulator>();
    const incomeMap = new Map<string, CategoryAccumulator>();

    for (const tx of filteredTransactions) {
      const amtStr = roundMoney(tx.amount);
      const cat = categoriesMap.get(tx.category_id);
      const catId = tx.category_id || "uncategorized";
      const catName = cat?.name || (tx.category_id ? "Categoría no encontrada" : "Sin categoría");
      const catIcon = cat?.icon || null;
      const mapKey = catName.trim().toLowerCase();

      if (tx.transaction_type === "income") {
        fIncome = addMoney(fIncome, amtStr);
        const prev = incomeMap.get(mapKey) || {
          id: catId,
          name: catName,
          type: "income",
          icon: catIcon,
          totalAmount: "0.00",
          count: 0,
        };
        prev.totalAmount = addMoney(prev.totalAmount, amtStr);
        prev.count += 1;
        incomeMap.set(mapKey, prev);
      } else {
        fExpense = addMoney(fExpense, amtStr);
        const prev = expenseMap.get(mapKey) || {
          id: catId,
          name: catName,
          type: "expense",
          icon: catIcon,
          totalAmount: "0.00",
          count: 0,
        };
        prev.totalAmount = addMoney(prev.totalAmount, amtStr);
        prev.count += 1;
        expenseMap.set(mapKey, prev);
      }
    }

    const fNet = subtractMoney(fIncome, fExpense);
    const fExpenseNum = parseFloat(fExpense);
    const fIncomeNum = parseFloat(fIncome);

    const expenseList = Array.from(expenseMap.values())
      .map((item) => ({
        ...item,
        percentage: fExpenseNum > 0 ? (parseFloat(item.totalAmount) / fExpenseNum) * 100 : 0,
      }))
      .sort((a, b) => parseFloat(b.totalAmount) - parseFloat(a.totalAmount));

    const incomeList = Array.from(incomeMap.values())
      .map((item) => ({
        ...item,
        percentage: fIncomeNum > 0 ? (parseFloat(item.totalAmount) / fIncomeNum) * 100 : 0,
      }))
      .sort((a, b) => parseFloat(b.totalAmount) - parseFloat(a.totalAmount));

    return {
      filteredIncome: fIncome,
      filteredExpense: fExpense,
      filteredNet: fNet,
      categorySummariesExpense: expenseList,
      categorySummariesIncome: incomeList,
    };
  }, [filteredTransactions, categoriesMap]);

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
            className="text-slate-500 hover:text-slate-900 dark:text-[#94A3B8] dark:hover:text-[#F8FAFC] text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header y Modal Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-heading font-bold text-slate-900 dark:text-[#F8FAFC] tracking-tight">
            Transacciones y Movimientos
          </h2>
          <p className="text-sm text-slate-500 dark:text-[#94A3B8] mt-1">
            Registro de ingresos, gastos, compras diferidas a cuotas y desglose por categorías.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white shadow-[0_0_15px_rgba(139,92,246,0.3)] rounded-xl flex items-center gap-1.5 self-start sm:self-auto transition-all">
              <PlusCircle className="w-4 h-4" />
              <span>Nueva Transacción</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-[#F8FAFC] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
            <DialogHeader>
              <DialogTitle className="font-heading font-bold text-slate-900 dark:text-[#F8FAFC]">Registrar Transacción</DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-[#94A3B8]">
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

      {/* KPI Cards de Resumen Dinámico */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="surface-card p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase text-slate-500 dark:text-[#94A3B8]">
                {isFilterActive ? "Ingresos (Filtrado)" : "Total Ingresos"}
              </span>
              {isFilterActive && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/20">
                  Filtro
                </span>
              )}
            </div>
            <div className="w-8 h-8 rounded-lg bg-[#10B981]/15 border border-[#10B981]/25 flex items-center justify-center text-[#10B981]">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-heading font-extrabold text-[#10B981] mt-3">
            +{formatMoneyCOP(isFilterActive ? filteredIncome : overallIncome)}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] mt-0.5">
            {isFilterActive
              ? `${filteredTransactions.filter((t) => t.transaction_type === "income").length} movimientos filtrados`
              : "Ingresos acumulados registrados"}
          </p>
        </div>

        <div className="surface-card p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase text-slate-500 dark:text-[#94A3B8]">
                {isFilterActive ? "Gastos (Filtrado)" : "Total Gastos"}
              </span>
              {isFilterActive && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#F43F5E]/15 text-[#F43F5E] border border-[#F43F5E]/20">
                  Filtro
                </span>
              )}
            </div>
            <div className="w-8 h-8 rounded-lg bg-[#F43F5E]/15 border border-[#F43F5E]/25 flex items-center justify-center text-[#F43F5E]">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-heading font-extrabold text-[#F43F5E] mt-3">
            -{formatMoneyCOP(isFilterActive ? filteredExpense : overallExpense)}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] mt-0.5">
            {isFilterActive
              ? `${filteredTransactions.filter((t) => t.transaction_type === "expense").length} movimientos filtrados`
              : "Gastos y compras en tarjetas"}
          </p>
        </div>

        <div className="surface-card p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase text-slate-500 dark:text-[#94A3B8]">
                {isFilterActive ? "Balance (Filtrado)" : "Balance Neto"}
              </span>
              {isFilterActive && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#8B5CF6]/15 text-[#8B5CF6] border border-[#8B5CF6]/20">
                  Filtro
                </span>
              )}
            </div>
            <div className="w-8 h-8 rounded-lg bg-[#8B5CF6]/15 border border-[#8B5CF6]/25 flex items-center justify-center text-[#8B5CF6]">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div
            className={`text-xl md:text-2xl font-heading font-extrabold mt-3 ${
              parseFloat(isFilterActive ? filteredNet : subtractMoney(overallIncome, overallExpense)) >= 0
                ? "text-slate-900 dark:text-[#F8FAFC]"
                : "text-[#F43F5E]"
            }`}
          >
            {formatMoneyCOP(isFilterActive ? filteredNet : subtractMoney(overallIncome, overallExpense))}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] mt-0.5">
            {isFilterActive ? "Ingresos menos gastos del filtro" : "Ingresos menos gastos totales"}
          </p>
        </div>
      </div>

      {/* Barra de Filtros Multicriterio */}
      <div className="surface-card p-5 rounded-2xl space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/[0.06]">
          <div className="flex items-center gap-2 text-xs font-heading font-bold text-slate-900 dark:text-[#F8FAFC]">
            <Filter className="w-4 h-4 text-[#8B5CF6]" />
            <span>Filtros y Búsqueda Avanzada</span>
            {isFilterActive && (
              <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] bg-[#8B5CF6]/15 text-[#8B5CF6] border border-[#8B5CF6]/25 font-bold">
                Activos: {filteredTransactions.length} de {transactions.length}
              </span>
            )}
          </div>

          {isFilterActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="h-7 px-2.5 text-xs text-rose-500 hover:text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 rounded-lg flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpiar filtros</span>
            </Button>
          )}
        </div>

        {/* Fila 1: Búsqueda, Cuenta, Categoría y Selector de Fecha */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Búsqueda por texto */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#94A3B8]" />
            <Input
              placeholder="Buscar descripción o notas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-full bg-slate-50 dark:bg-[#0B0F19] border-slate-200 dark:border-white/[0.1] text-slate-900 dark:text-[#F8FAFC] rounded-xl text-xs h-10"
            />
          </div>

          {/* Filtro por Cuenta */}
          <div>
            <select
              value={selectedAccountFilter}
              onChange={(e) => setSelectedAccountFilter(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0B0F19] text-xs font-medium text-slate-900 dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
            >
              <option value="all">Todas las cuentas</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.account_type === "credit_card" ? "Tarjeta" : "Cuenta"})
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Categoría (Multi-Select unificado por nombre base) */}
          <div>
            <CategoryMultiSelect
              categories={categories}
              selectedCategoryNames={selectedCategoryNames}
              onChange={setSelectedCategoryNames}
              placeholder="Todas las categorías"
            />
          </div>

          {/* Preset Temporal */}
          <div>
            <select
              value={datePreset}
              onChange={(e) => handleDatePresetChange(e.target.value as DatePreset)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0B0F19] text-xs font-medium text-slate-900 dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
            >
              <option value="all">Cualquier fecha</option>
              <option value="this_month">Este mes</option>
              <option value="last_30_days">Últimos 30 días</option>
              <option value="this_year">Este año</option>
              <option value="custom">Rango personalizado</option>
            </select>
          </div>
        </div>

        {/* Fila 2: Rango de Fechas Custom si se selecciona rango o preset */}
        {(datePreset === "custom" || startDate || endDate) && (
          <div className="p-3 rounded-xl bg-slate-100/60 dark:bg-[#0B0F19]/60 border border-slate-200 dark:border-white/[0.06] flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-[#94A3B8]">
              <Calendar className="w-3.5 h-3.5 text-[#8B5CF6]" />
              <span className="font-semibold">Rango:</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 dark:text-[#94A3B8]">Desde:</span>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset("custom");
                }}
                className="h-8 w-36 bg-white dark:bg-[#131B2E] border-slate-200 dark:border-white/[0.1] text-xs text-slate-900 dark:text-[#F8FAFC] rounded-lg"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 dark:text-[#94A3B8]">Hasta:</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset("custom");
                }}
                className="h-8 w-36 bg-white dark:bg-[#131B2E] border-slate-200 dark:border-white/[0.1] text-xs text-slate-900 dark:text-[#F8FAFC] rounded-lg"
              />
            </div>
            {(startDate || endDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setDatePreset("all");
                }}
                className="h-7 px-2 text-[11px] text-slate-500 hover:text-slate-900 dark:text-[#94A3B8] dark:hover:text-[#F8FAFC]"
              >
                Restablecer fechas
              </Button>
            )}
          </div>
        )}

        {/* Fila 3: Pestañas de Tipo */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <Button
              variant={typeFilter === "all" ? "default" : "ghost"}
              size="sm"
              onClick={() => setTypeFilter("all")}
              className={
                typeFilter === "all"
                  ? "bg-[#8B5CF6] text-white hover:bg-[#7C3AED] rounded-xl text-xs shadow-[0_0_12px_rgba(139,92,246,0.25)]"
                  : "text-slate-600 hover:text-slate-900 dark:text-[#94A3B8] dark:hover:text-[#F8FAFC] hover:bg-slate-100 dark:hover:bg-white/[0.05] rounded-xl text-xs"
              }
            >
              Todos ({transactions.length})
            </Button>
            <Button
              variant={typeFilter === "income" ? "default" : "ghost"}
              size="sm"
              onClick={() => setTypeFilter("income")}
              className={
                typeFilter === "income"
                  ? "bg-[#10B981] text-white hover:bg-emerald-600 rounded-xl text-xs shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                  : "text-slate-600 hover:text-slate-900 dark:text-[#94A3B8] dark:hover:text-[#F8FAFC] hover:bg-slate-100 dark:hover:bg-white/[0.05] rounded-xl text-xs"
              }
            >
              Ingresos ({transactions.filter((t) => t.transaction_type === "income").length})
            </Button>
            <Button
              variant={typeFilter === "expense" ? "default" : "ghost"}
              size="sm"
              onClick={() => setTypeFilter("expense")}
              className={
                typeFilter === "expense"
                  ? "bg-[#F43F5E] text-white hover:bg-rose-600 rounded-xl text-xs shadow-[0_0_12px_rgba(244,63,94,0.25)]"
                  : "text-slate-600 hover:text-slate-900 dark:text-[#94A3B8] dark:hover:text-[#F8FAFC] hover:bg-slate-100 dark:hover:bg-white/[0.05] rounded-xl text-xs"
              }
            >
              Gastos ({transactions.filter((t) => t.transaction_type === "expense").length})
            </Button>
          </div>

          {/* Badges de Categorías seleccionadas (Multi-Select unificado) */}
          {selectedCategoryNames.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-[#94A3B8] flex items-center gap-1">
                <Tag className="w-3 h-3 text-[#8B5CF6]" />
                <span>Categorías ({selectedCategoryNames.length}):</span>
              </span>
              {selectedCategoryNames.map((catName) => (
                <span
                  key={`chip-${catName}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 text-xs font-semibold text-[#8B5CF6] transition-all hover:bg-[#8B5CF6]/20"
                >
                  <span>{catName}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedCategoryNames((prev) =>
                        prev.filter(
                          (n) => n.trim().toLowerCase() !== catName.trim().toLowerCase()
                        )
                      )
                    }
                    className="hover:text-rose-500 font-bold ml-0.5 text-xs leading-none"
                    title={`Quitar ${catName}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
              {selectedCategoryNames.length > 1 && (
                <button
                  type="button"
                  onClick={() => setSelectedCategoryNames([])}
                  className="text-xs text-rose-500 hover:text-rose-600 font-semibold hover:underline px-1 py-0.5"
                >
                  Limpiar todas
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* SECCIÓN DINÁMICA: TOTALES AGRUPADOS POR CATEGORÍA EN TIEMPO REAL   */}
      {/* ------------------------------------------------------------------ */}
      <div className="surface-card p-5 rounded-2xl border border-slate-200 dark:border-white/[0.08] space-y-4">
        {/* Cabecera de la sección de categorías */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#8B5CF6]/15 border border-[#8B5CF6]/25 flex items-center justify-center text-[#8B5CF6] flex-shrink-0">
              <PieChart className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-heading font-bold text-slate-900 dark:text-[#F8FAFC]">
                  Totales por Categoría
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#8B5CF6]/15 text-[#8B5CF6] border border-[#8B5CF6]/25">
                  Filtros Activos
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-0.5">
                Desglose en tiempo real sobre {filteredTransactions.length} movimiento(s) filtrado(s)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Selector de vista interna de categorías */}
            <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-[#0B0F19] border border-slate-200 dark:border-white/[0.08] text-xs">
              <button
                onClick={() => setCategoryViewTab("all")}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  categoryViewTab === "all"
                    ? "bg-white dark:bg-[#131B2E] text-slate-900 dark:text-[#F8FAFC] shadow-sm"
                    : "text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC]"
                }`}
              >
                Ambos ({categorySummariesExpense.length + categorySummariesIncome.length})
              </button>
              <button
                onClick={() => setCategoryViewTab("expense")}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  categoryViewTab === "expense"
                    ? "bg-[#F43F5E]/15 text-[#F43F5E] shadow-sm"
                    : "text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC]"
                }`}
              >
                Gastos ({categorySummariesExpense.length})
              </button>
              <button
                onClick={() => setCategoryViewTab("income")}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  categoryViewTab === "income"
                    ? "bg-[#10B981]/15 text-[#10B981] shadow-sm"
                    : "text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC]"
                }`}
              >
                Ingresos ({categorySummariesIncome.length})
              </button>
            </div>

            {/* Botón de Colapsar / Expandir */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCategorySummaryOpen((prev) => !prev)}
              className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900 dark:text-[#94A3B8] dark:hover:text-[#F8FAFC] rounded-lg"
              title={isCategorySummaryOpen ? "Ocultar desglose" : "Mostrar desglose"}
            >
              {isCategorySummaryOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Contenido colapsable */}
        {isCategorySummaryOpen && (
          <div>
            {categorySummariesExpense.length === 0 && categorySummariesIncome.length === 0 ? (
              <div className="py-8 text-center">
                <Layers className="w-8 h-8 text-slate-400 dark:text-[#94A3B8]/40 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700 dark:text-[#F8FAFC]">
                  No se encontraron transacciones en las categorías para los filtros seleccionados
                </p>
                <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] mt-0.5">
                  Modifica los criterios de búsqueda o registra nuevos movimientos.
                </p>
              </div>
            ) : (
              <div
                className={`grid gap-6 ${
                  categoryViewTab === "all"
                    ? "grid-cols-1 lg:grid-cols-2"
                    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                }`}
              >
                {/* Panel de Gastos por Categoría */}
                {(categoryViewTab === "all" || categoryViewTab === "expense") && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#F43F5E]" />
                        <h4 className="text-xs font-heading font-bold uppercase tracking-wider text-slate-900 dark:text-[#F8FAFC]">
                          Gastos por Categoría
                        </h4>
                      </div>
                      <span className="text-xs font-heading font-bold text-[#F43F5E]">
                        Total: -{formatMoneyCOP(filteredExpense)}
                      </span>
                    </div>

                    {categorySummariesExpense.length === 0 ? (
                      <p className="text-xs text-slate-500 dark:text-[#94A3B8] italic py-3 text-center bg-slate-50 dark:bg-white/[0.02] rounded-xl border border-slate-200 dark:border-white/[0.04]">
                        Sin gastos registrados en el filtro
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        {categorySummariesExpense.map((item) => {
                          const isSelected = selectedCategoryNames.some(
                            (n) => n.trim().toLowerCase() === item.name.trim().toLowerCase()
                          );
                          return (
                            <div
                              key={`expense-${item.id}`}
                              onClick={() =>
                                setSelectedCategoryNames((prev) =>
                                  isSelected
                                    ? prev.filter(
                                        (n) =>
                                          n.trim().toLowerCase() !==
                                          item.name.trim().toLowerCase()
                                      )
                                    : [...prev, item.name]
                                )
                              }
                              className={`p-3 rounded-xl border transition-all cursor-pointer group ${
                                isSelected
                                  ? "bg-[#F43F5E]/10 border-[#F43F5E]/50 shadow-[0_0_15px_rgba(244,63,94,0.18)]"
                                  : "bg-slate-50/70 dark:bg-[#0B0F19]/60 border-slate-200/80 dark:border-white/[0.05] hover:border-[#F43F5E]/30 hover:bg-[#F43F5E]/5"
                              }`}
                              title={
                                isSelected
                                  ? "Haz clic para remover del filtro de categorías"
                                  : "Haz clic para agregar o filtrar por esta categoría"
                              }
                            >
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-7 h-7 rounded-lg bg-[#F43F5E]/15 border border-[#F43F5E]/25 text-[#F43F5E] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                                    {renderCategoryIcon(item.icon, "expense")}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-heading font-bold text-slate-900 dark:text-[#F8FAFC] truncate block group-hover:text-[#F43F5E] transition-colors">
                                        {item.name}
                                      </span>
                                      {isSelected && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#F43F5E] text-white">
                                          ✓ Filtrada
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[10px] text-slate-500 dark:text-[#94A3B8]">
                                      {item.count} {item.count === 1 ? "movimiento" : "movimientos"}
                                    </span>
                                  </div>
                                </div>

                                <div className="text-right flex-shrink-0">
                                  <span className="text-xs font-heading font-extrabold text-[#F43F5E] block">
                                    -{formatMoneyCOP(item.totalAmount)}
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] bg-slate-200/60 dark:bg-white/[0.06] px-1.5 py-0.5 rounded">
                                    {item.percentage.toFixed(1)}%
                                  </span>
                                </div>
                              </div>

                              {/* Barra de progreso de gastos */}
                              <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-white/[0.06] overflow-hidden mt-1">
                                <div
                                  className="h-full rounded-full bg-[#F43F5E] transition-all duration-500"
                                  style={{ width: `${Math.min(item.percentage, 100)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Panel de Ingresos por Categoría */}
                {(categoryViewTab === "all" || categoryViewTab === "income") && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
                        <h4 className="text-xs font-heading font-bold uppercase tracking-wider text-slate-900 dark:text-[#F8FAFC]">
                          Ingresos por Categoría
                        </h4>
                      </div>
                      <span className="text-xs font-heading font-bold text-[#10B981]">
                        Total: +{formatMoneyCOP(filteredIncome)}
                      </span>
                    </div>

                    {categorySummariesIncome.length === 0 ? (
                      <p className="text-xs text-slate-500 dark:text-[#94A3B8] italic py-3 text-center bg-slate-50 dark:bg-white/[0.02] rounded-xl border border-slate-200 dark:border-white/[0.04]">
                        Sin ingresos registrados en el filtro
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        {categorySummariesIncome.map((item) => {
                          const isSelected = selectedCategoryNames.some(
                            (n) => n.trim().toLowerCase() === item.name.trim().toLowerCase()
                          );
                          return (
                            <div
                              key={`income-${item.id}`}
                              onClick={() =>
                                setSelectedCategoryNames((prev) =>
                                  isSelected
                                    ? prev.filter(
                                        (n) =>
                                          n.trim().toLowerCase() !==
                                          item.name.trim().toLowerCase()
                                      )
                                    : [...prev, item.name]
                                )
                              }
                              className={`p-3 rounded-xl border transition-all cursor-pointer group ${
                                isSelected
                                  ? "bg-[#10B981]/10 border-[#10B981]/50 shadow-[0_0_15px_rgba(16,185,129,0.18)]"
                                  : "bg-slate-50/70 dark:bg-[#0B0F19]/60 border-slate-200/80 dark:border-white/[0.05] hover:border-[#10B981]/30 hover:bg-[#10B981]/5"
                              }`}
                              title={
                                isSelected
                                  ? "Haz clic para remover del filtro de categorías"
                                  : "Haz clic para agregar o filtrar por esta categoría"
                              }
                            >
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-7 h-7 rounded-lg bg-[#10B981]/15 border border-[#10B981]/25 text-[#10B981] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                                    {renderCategoryIcon(item.icon, "income")}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-heading font-bold text-slate-900 dark:text-[#F8FAFC] truncate block group-hover:text-[#10B981] transition-colors">
                                        {item.name}
                                      </span>
                                      {isSelected && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#10B981] text-white">
                                          ✓ Filtrada
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[10px] text-slate-500 dark:text-[#94A3B8]">
                                      {item.count} {item.count === 1 ? "movimiento" : "movimientos"}
                                    </span>
                                  </div>
                                </div>

                                <div className="text-right flex-shrink-0">
                                  <span className="text-xs font-heading font-extrabold text-[#10B981] block">
                                    +{formatMoneyCOP(item.totalAmount)}
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] bg-slate-200/60 dark:bg-white/[0.06] px-1.5 py-0.5 rounded">
                                    {item.percentage.toFixed(1)}%
                                  </span>
                                </div>
                              </div>

                              {/* Barra de progreso de ingresos */}
                              <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-white/[0.06] overflow-hidden mt-1">
                                <div
                                  className="h-full rounded-full bg-[#10B981] transition-all duration-500"
                                  style={{ width: `${Math.min(item.percentage, 100)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lista de Transacciones Filtradas */}
      {filteredTransactions.length === 0 ? (
        <div className="surface-card p-12 rounded-2xl border-dashed border-slate-300 dark:border-white/[0.1] text-center">
          <Clock className="w-10 h-10 text-slate-400 dark:text-[#94A3B8]/40 mx-auto mb-3" />
          <h3 className="text-base font-heading font-bold text-slate-900 dark:text-[#F8FAFC]">
            No hay transacciones que coincidan con los filtros
          </h3>
          <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-1">
            Registra tu primer movimiento financiero o ajusta los criterios de búsqueda.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            {isFilterActive && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
                className="rounded-xl border-slate-200 dark:border-white/[0.1] text-xs"
              >
                Limpiar filtros
              </Button>
            )}
            <Button
              onClick={() => setIsDialogOpen(true)}
              size="sm"
              className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-xl text-xs"
            >
              Registrar Movimiento
            </Button>
          </div>
        </div>
      ) : (
        <div className="surface-card rounded-2xl overflow-hidden border border-slate-200 dark:border-white/[0.08]">
          <div className="p-4 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-xs text-slate-500 dark:text-[#94A3B8]">
            <span className="font-semibold">
              Mostrando {filteredTransactions.length} de {transactions.length} transacciones
            </span>
            {selectedCategoryNames.length > 0 && (
              <span className="text-[#8B5CF6] font-bold">
                Filtrado por: {selectedCategoryNames.join(", ")}
              </span>
            )}
          </div>

          <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
            {filteredTransactions.map((tx) => {
              const isIncome = tx.transaction_type === "income";
              const account = accountsMap.get(tx.account_id);
              const category = categoriesMap.get(tx.category_id);
              const isCredit = account?.account_type === "credit_card";

              return (
                <div
                  key={tx.id}
                  className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-slate-50/60 dark:hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isIncome
                          ? "bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/20"
                          : "bg-slate-100 dark:bg-white/[0.05] text-slate-500 dark:text-[#94A3B8] border border-slate-200 dark:border-white/[0.08]"
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
                        <h4 className="text-sm sm:text-base font-heading font-bold text-slate-900 dark:text-[#F8FAFC] truncate">
                          {tx.description}
                        </h4>
                        {tx.is_installment && tx.installment_count > 1 && (
                          <span className="px-2 py-0.5 rounded-full bg-[#8B5CF6]/15 border border-[#8B5CF6]/25 text-[#8B5CF6] text-[10px] font-bold tracking-wide uppercase flex-shrink-0">
                            {tx.installment_count} cuotas
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-[#94A3B8] mt-0.5">
                        <span>{tx.transaction_date}</span>
                        <span>•</span>
                        <span className="text-slate-700 dark:text-[#F8FAFC] font-medium">
                          {category?.name || "Sin categoría"}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-slate-500 dark:text-[#94A3B8]">
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
                            : "text-slate-900 dark:text-[#F8FAFC]"
                        }`}
                      >
                        {isIncome ? "+" : "-"}
                        {formatMoneyCOP(tx.amount)}
                      </div>
                      {tx.is_installment && tx.installment_count > 1 && (
                        <span className="text-[11px] text-slate-500 dark:text-[#94A3B8] block">
                          Diferido mensual
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 border-l border-slate-200 dark:border-white/[0.08] pl-2 sm:pl-3">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingTransaction(tx)}
                        title="Editar transacción"
                        className="h-8 w-8 p-0 text-slate-400 hover:text-slate-900 dark:text-[#94A3B8] dark:hover:text-[#F8FAFC] hover:bg-slate-100 dark:hover:bg-white/[0.05] rounded-lg"
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
                        className="h-8 w-8 p-0 text-[#F43F5E] hover:text-rose-600 dark:hover:text-rose-300 hover:bg-[#F43F5E]/10 rounded-lg"
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
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-[#F8FAFC] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
          <DialogHeader>
            <DialogTitle className="font-heading font-bold text-slate-900 dark:text-[#F8FAFC]">Editar Transacción</DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-[#94A3B8]">
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
