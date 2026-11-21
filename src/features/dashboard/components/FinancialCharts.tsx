"use client";

import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { formatMoneyCOP } from "@/lib/finance/money";
import {
  PieChart as PieIcon,
  BarChart3,
  CalendarRange,
  Calendar,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TransactionRow } from "@/features/transactions/actions/transaction-actions";
import type { CategoryRow } from "@/features/categories/actions/category-actions";

export interface MonthlyFlowItem {
  month: string;
  income: number;
  expense: number;
}

export interface CategoryExpenseItem {
  name: string;
  value: number;
  color?: string;
  percentage?: number;
}

export type TimeFilterType = "days" | "weeks" | "months" | "years" | "custom";

interface FinancialChartsProps {
  monthlyData?: MonthlyFlowItem[];
  categoryData?: CategoryExpenseItem[];
  transactions?: TransactionRow[];
  categories?: CategoryRow[];
}

const CATEGORY_PALETTE = [
  "#8B5CF6", // Electric Violet
  "#10B981", // Emerald
  "#3B82F6", // Blue
  "#F59E0B", // Amber
  "#F43F5E", // Crimson
  "#06B6D4", // Cyan
  "#EC4899", // Pink
  "#64748B", // Slate
];

const MONTH_NAMES_ES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
];

function formatCivilDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ----------------------------------------------------------------------
// Tooltip personalizado para el Gráfico de Barras (Flujo Periódico)
// ----------------------------------------------------------------------
interface BarTooltipPayloadItem {
  dataKey: string;
  name: string;
  value: number;
  color: string;
  payload: {
    period: string;
    income: number;
    expense: number;
  };
}

interface CustomBarTooltipProps {
  active?: boolean;
  payload?: BarTooltipPayloadItem[];
  label?: string;
}

function CustomBarTooltip({ active, payload, label }: CustomBarTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const item = payload[0]?.payload;
  const periodLabel = label || item?.period || "";
  const income = item?.income ?? 0;
  const expense = item?.expense ?? 0;
  const net = income - expense;
  const isNetPositive = net >= 0;

  return (
    <div className="surface-card p-3.5 rounded-2xl border border-slate-200 dark:border-white/[0.12] bg-white/95 dark:bg-[#131B2E]/95 backdrop-blur-md shadow-[0_12px_32px_rgba(0,0,0,0.5)] text-xs space-y-2.5 min-w-[210px] animate-in fade-in-50 zoom-in-95 duration-100">
      <div className="border-b border-slate-100 dark:border-white/[0.08] pb-1.5 flex items-center justify-between">
        <span className="font-heading font-bold text-slate-900 dark:text-[#F8FAFC]">
          {periodLabel}
        </span>
        <span className="text-[10px] text-slate-400 dark:text-[#94A3B8] font-medium uppercase tracking-wider">
          Flujo de Caja
        </span>
      </div>

      <div className="space-y-1.5">
        {/* Fila de Ingresos */}
        <div className="flex items-center justify-between gap-3 p-1.5 rounded-lg bg-[#10B981]/10 border border-[#10B981]/20">
          <div className="flex items-center gap-1.5 text-[#10B981]">
            <span className="w-2 h-2 rounded-full bg-[#10B981] shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="font-semibold text-xs">Ingresos</span>
          </div>
          <span className="font-heading font-bold text-[#10B981] text-xs">
            +{formatMoneyCOP(income)}
          </span>
        </div>

        {/* Fila de Gastos */}
        <div className="flex items-center justify-between gap-3 p-1.5 rounded-lg bg-[#F43F5E]/10 border border-[#F43F5E]/20">
          <div className="flex items-center gap-1.5 text-[#F43F5E]">
            <span className="w-2 h-2 rounded-full bg-[#F43F5E] shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
            <span className="font-semibold text-xs">Gastos</span>
          </div>
          <span className="font-heading font-bold text-[#F43F5E] text-xs">
            -{formatMoneyCOP(expense)}
          </span>
        </div>
      </div>

      {/* Balance Neto del período */}
      <div className="pt-2 border-t border-slate-100 dark:border-white/[0.08] flex items-center justify-between text-[11px]">
        <span className="text-slate-500 dark:text-[#94A3B8] font-medium">Balance Neto:</span>
        <span
          className={`font-heading font-bold ${
            isNetPositive ? "text-[#10B981]" : "text-[#F43F5E]"
          }`}
        >
          {isNetPositive ? "+" : ""}
          {formatMoneyCOP(net)}
        </span>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Tooltip personalizado para el Gráfico de Categorías (Porcentajes)
// ----------------------------------------------------------------------
interface PieTooltipPayloadItem {
  name: string;
  value: number;
  payload: {
    name: string;
    value: number;
    percentage: number;
    color?: string;
  };
}

interface CustomPieTooltipProps {
  active?: boolean;
  payload?: PieTooltipPayloadItem[];
}

function CustomPieTooltip({ active, payload }: CustomPieTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="surface-card p-3 rounded-xl border border-slate-200 dark:border-white/[0.12] bg-white/95 dark:bg-[#131B2E]/95 backdrop-blur-md shadow-[0_12px_32px_rgba(0,0,0,0.5)] text-xs space-y-1.5 min-w-[190px] animate-in fade-in-50 zoom-in-95 duration-100">
      <div className="flex items-center gap-2 border-b border-slate-100 dark:border-white/[0.08] pb-1">
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: data.color || "#8B5CF6" }}
        />
        <span className="font-heading font-bold text-slate-900 dark:text-[#F8FAFC] truncate">
          {data.name}
        </span>
      </div>

      <div className="flex items-baseline justify-between pt-0.5 gap-2">
        <span className="text-[11px] text-slate-500 dark:text-[#94A3B8]">Monto gastado:</span>
        <span className="font-heading font-bold text-slate-900 dark:text-[#F8FAFC]">
          {formatMoneyCOP(data.value)}
        </span>
      </div>

      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100 dark:border-white/[0.08]">
        <span className="text-slate-500 dark:text-[#94A3B8]">Participación:</span>
        <span className="font-heading font-bold text-amber-700 dark:text-[#D4AF37] bg-amber-500/15 px-2 py-0.5 rounded-md border border-amber-500/25">
          {data.percentage.toFixed(1)}% del total
        </span>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Etiqueta personalizada en sectores del PieChart
// ----------------------------------------------------------------------
interface CustomizedPieLabelProps {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
  index?: number;
}

function renderPieSliceLabel(props: CustomizedPieLabelProps) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
  if (
    cx === undefined ||
    cy === undefined ||
    midAngle === undefined ||
    innerRadius === undefined ||
    outerRadius === undefined ||
    percent === undefined
  ) {
    return null;
  }

  // Solo mostrar porcentaje dentro del sector si representa al menos un 5% para evitar solapamientos
  if (percent < 0.05) return null;

  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#FFFFFF"
      textAnchor="middle"
      dominantBaseline="central"
      className="text-[10px] font-heading font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] pointer-events-none"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export function FinancialCharts({
  monthlyData = [],
  categoryData = [],
  transactions,
  categories = [],
}: FinancialChartsProps) {
  // Estado del selector temporal
  const [timeFilter, setTimeFilter] = useState<TimeFilterType>("months");

  // Rango personalizado (por defecto últimos 30 días)
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return formatCivilDateISO(d);
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return formatCivilDateISO(new Date());
  });

  // Mapa de nombres de categorías
  const categoriesMap = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c.name]));
  }, [categories]);

  // --------------------------------------------------------------------
  // Procesamiento Reactivo de Datos según Filtro Temporal
  // --------------------------------------------------------------------
  const { filteredFlowData, filteredCategoryData, periodSummary } = useMemo(() => {
    // Si no se proporcionaron transacciones crudas, usar datos fallback (compatibilidad)
    if (!transactions || transactions.length === 0) {
      const totalCat = categoryData.reduce((acc, c) => acc + c.value, 0);
      const computedCategories: CategoryExpenseItem[] = categoryData.map((c, i) => ({
        ...c,
        color: c.color || CATEGORY_PALETTE[i % CATEGORY_PALETTE.length],
        percentage: totalCat > 0 ? (c.value / totalCat) * 100 : 0,
      }));

      return {
        filteredFlowData: monthlyData.map((d) => ({
          period: d.month,
          income: d.income,
          expense: d.expense,
        })),
        filteredCategoryData: computedCategories,
        periodSummary: {
          totalIncome: monthlyData.reduce((acc, d) => acc + d.income, 0),
          totalExpense: totalCat,
          label: "Últimos 6 meses",
        },
      };
    }

    const now = new Date();
    let startDateLimit: string;
    let endDateLimit: string = formatCivilDateISO(now);
    let summaryLabel = "Período Seleccionado";

    if (timeFilter === "days") {
      const start = new Date();
      start.setDate(start.getDate() - 13); // Últimos 14 días
      startDateLimit = formatCivilDateISO(start);
      summaryLabel = "Últimos 14 días";
    } else if (timeFilter === "weeks") {
      const start = new Date();
      start.setDate(start.getDate() - 55); // Últimas 8 semanas
      startDateLimit = formatCivilDateISO(start);
      summaryLabel = "Últimas 8 semanas";
    } else if (timeFilter === "months") {
      const start = new Date();
      start.setMonth(start.getMonth() - 5); // Últimos 6 meses
      start.setDate(1);
      startDateLimit = formatCivilDateISO(start);
      summaryLabel = "Últimos 6 meses";
    } else if (timeFilter === "years") {
      const start = new Date();
      start.setFullYear(start.getFullYear() - 2); // Últimos 3 años
      start.setMonth(0);
      start.setDate(1);
      startDateLimit = formatCivilDateISO(start);
      summaryLabel = "Histórico Anual";
    } else {
      // Personalizado
      startDateLimit = customStartDate || "2000-01-01";
      endDateLimit = customEndDate || formatCivilDateISO(now);
      summaryLabel = `Rango: ${startDateLimit} al ${endDateLimit}`;
    }

    // 1. Filtrar transacciones dentro de la ventana de tiempo
    const inRangeTransactions = transactions.filter((tx) => {
      return (
        tx.transaction_date >= startDateLimit &&
        tx.transaction_date <= endDateLimit
      );
    });

    // 2. Agrupación para Gráfico de Flujo (Ingresos vs. Gastos)
    const flowMap = new Map<string, { income: number; expense: number; label: string }>();

    if (timeFilter === "days") {
      // Generar 14 días contiguos
      for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const iso = formatCivilDateISO(d);
        const dayLabel = `${d.getDate()} ${MONTH_NAMES_ES[d.getMonth()]}`;
        flowMap.set(iso, { income: 0, expense: 0, label: dayLabel });
      }

      for (const tx of inRangeTransactions) {
        const entry = flowMap.get(tx.transaction_date);
        if (entry) {
          if (tx.transaction_type === "income") entry.income += tx.amount;
          else entry.expense += tx.amount;
        }
      }
    } else if (timeFilter === "weeks") {
      // Generar 8 cubetas de 7 días
      for (let w = 7; w >= 0; w--) {
        const dEnd = new Date();
        dEnd.setDate(dEnd.getDate() - w * 7);
        const dStart = new Date(dEnd);
        dStart.setDate(dStart.getDate() - 6);
        const weekKey = `w-${w}`;
        const weekLabel = `${dStart.getDate()} ${MONTH_NAMES_ES[dStart.getMonth()]} - ${dEnd.getDate()} ${MONTH_NAMES_ES[dEnd.getMonth()]}`;
        flowMap.set(weekKey, { income: 0, expense: 0, label: weekLabel });
      }

      // Asignar transacciones a semanas
      for (const tx of inRangeTransactions) {
        const txDate = new Date(`${tx.transaction_date}T00:00:00`);
        const diffDays = Math.floor((now.getTime() - txDate.getTime()) / (1000 * 3600 * 24));
        const weekIndex = Math.floor(diffDays / 7);
        if (weekIndex >= 0 && weekIndex <= 7) {
          const entry = flowMap.get(`w-${weekIndex}`);
          if (entry) {
            if (tx.transaction_type === "income") entry.income += tx.amount;
            else entry.expense += tx.amount;
          }
        }
      }
    } else if (timeFilter === "months") {
      // Generar 6 meses
      for (let m = 5; m >= 0; m--) {
        const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
        const monthIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const monthLabel = `${MONTH_NAMES_ES[d.getMonth()]} ${d.getFullYear()}`;
        flowMap.set(monthIso, { income: 0, expense: 0, label: monthLabel });
      }

      for (const tx of inRangeTransactions) {
        const mKey = tx.transaction_date.slice(0, 7);
        const entry = flowMap.get(mKey);
        if (entry) {
          if (tx.transaction_type === "income") entry.income += tx.amount;
          else entry.expense += tx.amount;
        }
      }
    } else if (timeFilter === "years") {
      // Generar últimos 3 años
      const currentYear = now.getFullYear();
      for (let y = currentYear - 2; y <= currentYear; y++) {
        const yKey = String(y);
        flowMap.set(yKey, { income: 0, expense: 0, label: yKey });
      }

      for (const tx of inRangeTransactions) {
        const yKey = tx.transaction_date.slice(0, 4);
        const entry = flowMap.get(yKey);
        if (entry) {
          if (tx.transaction_type === "income") entry.income += tx.amount;
          else entry.expense += tx.amount;
        }
      }
    } else {
      // Personalizado: agrupamiento adaptativo
      for (const tx of inRangeTransactions) {
        const key = tx.transaction_date;
        const current = flowMap.get(key) || { income: 0, expense: 0, label: key };
        if (tx.transaction_type === "income") current.income += tx.amount;
        else current.expense += tx.amount;
        flowMap.set(key, current);
      }
    }

    const flowList = Array.from(flowMap.entries()).map(([, val]) => ({
      period: val.label,
      income: parseFloat(val.income.toFixed(2)),
      expense: parseFloat(val.expense.toFixed(2)),
    }));

    // 3. Agrupación para Gastos por Categoría con Porcentajes Exactos
    const categoryAggMap = new Map<string, number>();
    let totalExpenseSum = 0;

    for (const tx of inRangeTransactions) {
      if (tx.transaction_type === "expense") {
        const catName = categoriesMap.get(tx.category_id) || "Otros Gastos";
        const prev = categoryAggMap.get(catName) || 0;
        categoryAggMap.set(catName, prev + tx.amount);
        totalExpenseSum += tx.amount;
      }
    }

    const sortedCats = Array.from(categoryAggMap.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 7);

    const categoriesList: CategoryExpenseItem[] = sortedCats.map(([name, val], idx) => ({
      name,
      value: parseFloat(val.toFixed(2)),
      percentage: totalExpenseSum > 0 ? (val / totalExpenseSum) * 100 : 0,
      color: CATEGORY_PALETTE[idx % CATEGORY_PALETTE.length],
    }));

    const totalIncomeSum = inRangeTransactions
      .filter((t) => t.transaction_type === "income")
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      filteredFlowData: flowList,
      filteredCategoryData: categoriesList,
      periodSummary: {
        totalIncome: totalIncomeSum,
        totalExpense: totalExpenseSum,
        label: summaryLabel,
      },
    };
  }, [
    transactions,
    categories,
    categoryData,
    monthlyData,
    timeFilter,
    customStartDate,
    customEndDate,
    categoriesMap,
  ]);

  const hasFlowData = useMemo(() => {
    return filteredFlowData.some((d) => d.income > 0 || d.expense > 0);
  }, [filteredFlowData]);

  const hasCategoryData = useMemo(() => {
    return filteredCategoryData.some((c) => c.value > 0);
  }, [filteredCategoryData]);

  return (
    <div className="space-y-4">
      {/* ---------------------------------------------------------------- */}
      {/* BARRA DE FILTROS TEMPORALES REUTILIZABLE                         */}
      {/* ---------------------------------------------------------------- */}
      <div className="surface-card p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-600 dark:text-[#D4AF37]">
            <CalendarRange className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-heading font-bold text-slate-900 dark:text-[#F8FAFC] block">
              Filtro Temporal de Gráficos
            </span>
            <span className="text-[11px] text-slate-500 dark:text-[#94A3B8]">
              {periodSummary.label}
            </span>
          </div>
        </div>

        {/* Pestañas de Selección Temporal */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-[#0B0F19]/80 border border-slate-200 dark:border-white/[0.08]">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setTimeFilter("days")}
            className={`h-7 px-3 text-xs rounded-lg transition-all ${
              timeFilter === "days"
                ? "bg-amber-600 text-white shadow-[0_0_12px_rgba(217,119,6,0.3)] dark:bg-[#D4AF37] dark:text-slate-950 font-bold"
                : "text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC]"
            }`}
          >
            Días
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setTimeFilter("weeks")}
            className={`h-7 px-3 text-xs rounded-lg transition-all ${
              timeFilter === "weeks"
                ? "bg-amber-600 text-white shadow-[0_0_12px_rgba(217,119,6,0.3)] dark:bg-[#D4AF37] dark:text-slate-950 font-bold"
                : "text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC]"
            }`}
          >
            Semanas
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setTimeFilter("months")}
            className={`h-7 px-3 text-xs rounded-lg transition-all ${
              timeFilter === "months"
                ? "bg-amber-600 text-white shadow-[0_0_12px_rgba(217,119,6,0.3)] dark:bg-[#D4AF37] dark:text-slate-950 font-bold"
                : "text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC]"
            }`}
          >
            Meses
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setTimeFilter("years")}
            className={`h-7 px-3 text-xs rounded-lg transition-all ${
              timeFilter === "years"
                ? "bg-amber-600 text-white shadow-[0_0_12px_rgba(217,119,6,0.3)] dark:bg-[#D4AF37] dark:text-slate-950 font-bold"
                : "text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC]"
            }`}
          >
            Años
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setTimeFilter("custom")}
            className={`h-7 px-3 text-xs rounded-lg flex items-center gap-1 transition-all ${
              timeFilter === "custom"
                ? "bg-amber-600 text-white shadow-[0_0_12px_rgba(217,119,6,0.3)] dark:bg-[#D4AF37] dark:text-slate-950 font-bold"
                : "text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC]"
            }`}
          >
            <Calendar className="w-3 h-3" />
            <span>Personalizado</span>
          </Button>
        </div>
      </div>

      {/* Rango de Fechas Personalizado (Se despliega solo cuando timeFilter === "custom") */}
      {timeFilter === "custom" && (
        <div className="surface-card p-4 rounded-2xl flex flex-col sm:flex-row items-center gap-3 animate-in fade-in-50 duration-150">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-[#94A3B8] flex-shrink-0">
            <Layers className="w-4 h-4 text-amber-600 dark:text-[#D4AF37]" />
            <span>Rango Custom:</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
              <span className="text-[11px] text-slate-400">Desde:</span>
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="h-8 text-xs bg-white dark:bg-[#0B0F19] border-slate-200 dark:border-white/[0.1] text-slate-800 dark:text-[#F8FAFC] rounded-xl"
              />
            </div>

            <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
              <span className="text-[11px] text-slate-400">Hasta:</span>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="h-8 text-xs bg-white dark:bg-[#0B0F19] border-slate-200 dark:border-white/[0.1] text-slate-800 dark:text-[#F8FAFC] rounded-xl"
              />
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* CUADRÍCULA DE LOS DOS GRÁFICOS INTERACTIVOS                      */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Gráfico de Barras: Flujo de Ingresos vs. Gastos */}
        <div className="surface-card p-6 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-heading font-bold text-slate-900 dark:text-[#F8FAFC] flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#10B981]" />
                <span>Flujo Periódico (Ingresos vs. Gastos)</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-0.5">
                Comparativa de ingresos y gastos en {periodSummary.label.toLowerCase()}
              </p>
            </div>
          </div>

          {!hasFlowData ? (
            <div className="h-64 flex flex-col items-center justify-center border border-dashed border-slate-200 dark:border-white/[0.1] rounded-xl text-center p-6">
              <BarChart3 className="w-8 h-8 text-slate-300 dark:text-[#94A3B8]/40 mb-2" />
              <p className="text-xs font-semibold text-slate-700 dark:text-[#F8FAFC]">
                Sin movimientos en este período
              </p>
              <p className="text-[11px] text-slate-400 dark:text-[#94A3B8] mt-0.5">
                No hay ingresos ni gastos registrados en el rango de tiempo seleccionado.
              </p>
            </div>
          ) : (
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={filteredFlowData}
                  margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="rgba(255,255,255,0.06)"
                  />
                  <XAxis
                    dataKey="period"
                    tick={{ fontSize: 11, fill: "#94A3B8" }}
                    axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94A3B8" }}
                    tickFormatter={(val: number) => `$${(val / 1000).toFixed(0)}k`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={<CustomBarTooltip />}
                    cursor={{ fill: "rgba(255, 255, 255, 0.04)" }}
                  />
                  <Legend
                    formatter={(value: string) => (value === "income" ? "Ingresos" : "Gastos")}
                    wrapperStyle={{ fontSize: "12px", paddingTop: "8px", color: "#94A3B8" }}
                  />
                  <Bar
                    dataKey="income"
                    name="income"
                    fill="#10B981"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={32}
                  />
                  <Bar
                    dataKey="expense"
                    name="expense"
                    fill="#F43F5E"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={32}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* 2. Gráfico de Pastel / Dona: Gastos por Categoría con Porcentajes */}
        <div className="surface-card p-6 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-heading font-bold text-slate-900 dark:text-[#F8FAFC] flex items-center gap-2">
                <PieIcon className="w-5 h-5 text-amber-600 dark:text-[#D4AF37]" />
                <span>Gastos por Categoría</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-0.5">
                Participación porcentual y desglose en {periodSummary.label.toLowerCase()}
              </p>
            </div>
          </div>

          {!hasCategoryData ? (
            <div className="h-64 flex flex-col items-center justify-center border border-dashed border-slate-200 dark:border-white/[0.1] rounded-xl text-center p-6">
              <PieIcon className="w-8 h-8 text-slate-300 dark:text-[#94A3B8]/40 mb-2" />
              <p className="text-xs font-semibold text-slate-700 dark:text-[#F8FAFC]">
                Sin gastos categorizados en este período
              </p>
              <p className="text-[11px] text-slate-400 dark:text-[#94A3B8] mt-0.5">
                Registra transacciones de egreso para visualizar la distribución porcentual.
              </p>
            </div>
          ) : (
            <div className="h-72 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={filteredCategoryData}
                    cx="50%"
                    cy="48%"
                    innerRadius={52}
                    outerRadius={84}
                    paddingAngle={3}
                    dataKey="value"
                    label={renderPieSliceLabel}
                    labelLine={false}
                  >
                    {filteredCategoryData.map((entry, index) => (
                      <Cell
                        key={`cell-${entry.name}-${index}`}
                        fill={entry.color || CATEGORY_PALETTE[index % CATEGORY_PALETTE.length]}
                        stroke="rgba(255, 255, 255, 0.08)"
                        strokeWidth={1}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Legend
                    formatter={(value: string) => {
                      const item = filteredCategoryData.find((c) => c.name === value);
                      const pct = item?.percentage ? `${item.percentage.toFixed(1)}%` : "";
                      return (
                        <span className="text-[11px] text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC] transition-colors">
                          <strong className="text-slate-800 dark:text-[#F8FAFC] font-semibold">{value}</strong>
                          {pct && (
                            <span className="ml-1 text-amber-600 dark:text-[#D4AF37] font-bold">
                              ({pct})
                            </span>
                          )}
                        </span>
                      );
                    }}
                    layout="horizontal"
                    align="center"
                    verticalAlign="bottom"
                    wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
