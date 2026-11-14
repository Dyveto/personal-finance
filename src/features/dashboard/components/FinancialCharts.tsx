"use client";

import { useMemo } from "react";
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
import { PieChart as PieIcon, BarChart3 } from "lucide-react";

export interface MonthlyFlowItem {
  month: string;
  income: number;
  expense: number;
}

export interface CategoryExpenseItem {
  name: string;
  value: number;
  color?: string;
}

interface FinancialChartsProps {
  monthlyData: MonthlyFlowItem[];
  categoryData: CategoryExpenseItem[];
}

const CATEGORY_PALETTE = [
  "#10b981", // emerald
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#ec4899", // pink
  "#8b5cf6", // purple
  "#14b8a6", // teal
  "#f97316", // orange
  "#64748b", // slate
];

export function FinancialCharts({ monthlyData, categoryData }: FinancialChartsProps) {
  const hasMonthlyData = useMemo(() => {
    return monthlyData.some((d) => d.income > 0 || d.expense > 0);
  }, [monthlyData]);

  const hasCategoryData = useMemo(() => {
    return categoryData.some((c) => c.value > 0);
  }, [categoryData]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. Gráfico de Comparación Mensual: Ingresos vs. Gastos */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>Flujo Mensual (Ingresos vs. Gastos)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Comparativa de ingresos y gastos consolidados
            </p>
          </div>
        </div>

        {!hasMonthlyData ? (
          <div className="h-64 flex flex-col items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center p-6">
            <BarChart3 className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-2" />
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Sin datos de movimientos suficientes
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Registra transacciones para visualizar la comparativa mensual.
            </p>
          </div>
        ) : (
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={{ stroke: "#e2e8f0" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickFormatter={(val: number) => `$${(val / 1000).toFixed(0)}k`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(val: unknown, name?: unknown) => {
                    const numericVal = typeof val === "number" ? val : typeof val === "string" ? Number(val) : 0;
                    return [
                      formatMoneyCOP(Number.isFinite(numericVal) ? numericVal : 0),
                      name === "income" ? "Ingresos" : "Gastos",
                    ];
                  }}
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "0.75rem",
                    fontSize: "12px",
                    color: "#f8fafc",
                  }}
                />
                <Legend
                  formatter={(value: string) => (value === "income" ? "Ingresos" : "Gastos")}
                  wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                />
                <Bar dataKey="income" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={36} />
                <Bar dataKey="expense" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 2. Gráfico de Pastel: Distribución de Gastos por Categoría */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <PieIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <span>Gastos por Categoría</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Distribución porcentual de egresos acumulados
            </p>
          </div>
        </div>

        {!hasCategoryData ? (
          <div className="h-64 flex flex-col items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center p-6">
            <PieIcon className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-2" />
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Sin gastos categorizados
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Registra gastos para generar el desglose por categorías.
            </p>
          </div>
        ) : (
          <div className="h-72 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell
                      key={`cell-${entry.name}-${index}`}
                      fill={entry.color || CATEGORY_PALETTE[index % CATEGORY_PALETTE.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: unknown) => {
                    const numericVal = typeof val === "number" ? val : typeof val === "string" ? Number(val) : 0;
                    return [
                      formatMoneyCOP(Number.isFinite(numericVal) ? numericVal : 0),
                      "Gasto",
                    ];
                  }}
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "0.75rem",
                    fontSize: "12px",
                    color: "#f8fafc",
                  }}
                />
                <Legend
                  layout="horizontal"
                  align="center"
                  verticalAlign="bottom"
                  wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
