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
  "#8B5CF6", // Electric Violet
  "#10B981", // Emerald
  "#3B82F6", // Blue
  "#F59E0B", // Amber
  "#F43F5E", // Crimson
  "#06B6D4", // Cyan
  "#EC4899", // Pink
  "#64748B", // Slate
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
      <div className="surface-card p-6 rounded-2xl flex flex-col justify-between">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-heading font-bold text-[#F8FAFC] flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#10B981]" />
              <span>Flujo Mensual (Ingresos vs. Gastos)</span>
            </h3>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              Comparativa de ingresos y gastos consolidados
            </p>
          </div>
        </div>

        {!hasMonthlyData ? (
          <div className="h-64 flex flex-col items-center justify-center border border-dashed border-white/[0.1] rounded-xl text-center p-6">
            <BarChart3 className="w-8 h-8 text-[#94A3B8]/40 mb-2" />
            <p className="text-xs font-semibold text-[#F8FAFC]">
              Sin datos de movimientos suficientes
            </p>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">
              Registra transacciones para visualizar la comparativa mensual.
            </p>
          </div>
        ) : (
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="month"
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
                  formatter={(val: unknown, name?: unknown) => {
                    const numericVal = typeof val === "number" ? val : typeof val === "string" ? Number(val) : 0;
                    return [
                      formatMoneyCOP(Number.isFinite(numericVal) ? numericVal : 0),
                      name === "income" ? "Ingresos" : "Gastos",
                    ];
                  }}
                  contentStyle={{
                    backgroundColor: "#131B2E",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderRadius: "1rem",
                    fontSize: "12px",
                    color: "#F8FAFC",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                  }}
                />
                <Legend
                  formatter={(value: string) => (value === "income" ? "Ingresos" : "Gastos")}
                  wrapperStyle={{ fontSize: "12px", paddingTop: "8px", color: "#94A3B8" }}
                />
                <Bar dataKey="income" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={36} />
                <Bar dataKey="expense" fill="#F43F5E" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 2. Gráfico de Pastel: Distribución de Gastos por Categoría */}
      <div className="surface-card p-6 rounded-2xl flex flex-col justify-between">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-heading font-bold text-[#F8FAFC] flex items-center gap-2">
              <PieIcon className="w-5 h-5 text-[#8B5CF6]" />
              <span>Gastos por Categoría</span>
            </h3>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              Distribución porcentual de egresos acumulados
            </p>
          </div>
        </div>

        {!hasCategoryData ? (
          <div className="h-64 flex flex-col items-center justify-center border border-dashed border-white/[0.1] rounded-xl text-center p-6">
            <PieIcon className="w-8 h-8 text-[#94A3B8]/40 mb-2" />
            <p className="text-xs font-semibold text-[#F8FAFC]">
              Sin gastos categorizados
            </p>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">
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
                    backgroundColor: "#131B2E",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderRadius: "1rem",
                    fontSize: "12px",
                    color: "#F8FAFC",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                  }}
                />
                <Legend
                  layout="horizontal"
                  align="center"
                  verticalAlign="bottom"
                  wrapperStyle={{ fontSize: "11px", paddingTop: "10px", color: "#94A3B8" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
