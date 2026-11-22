"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  SlidersHorizontal,
  PlusCircle,
  AlertCircle,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  AccountRow,
  TransactionRow,
  CategoryRow,
  CreditCardStatementRow,
} from "@/types/database.types";
import {
  DEFAULT_DASHBOARD_WIDGET_ORDER,
  type DashboardLayoutConfig,
} from "@/lib/validations/finance";
import { saveDashboardLayout } from "@/features/dashboard/actions/dashboard-actions";
import {
  FinancialCharts,
  type MonthlyFlowItem,
  type CategoryExpenseItem,
} from "@/features/dashboard/components/FinancialCharts";
import { InstallmentProjectionsCard } from "@/features/dashboard/components/InstallmentProjectionsCard";
import type { ProjectedInstallment } from "@/lib/finance/projections";
import { DashboardKpiWidget } from "@/features/dashboard/components/widgets/DashboardKpiWidget";
import { DashboardActiveAccounts } from "@/features/dashboard/components/widgets/DashboardActiveAccounts";
import { DashboardRecentTransactions } from "@/features/dashboard/components/widgets/DashboardRecentTransactions";
import { WidgetWrapper } from "@/features/dashboard/components/widgets/WidgetWrapper";
import { WelcomeHubBanner } from "@/features/dashboard/components/WelcomeHubBanner";
import {
  WelcomeHubManagerModal,
  WIDGET_METADATA,
} from "@/features/dashboard/components/WelcomeHubManagerModal";

interface WelcomeHubDashboardProps {
  accounts: AccountRow[];
  transactions: TransactionRow[];
  categories: CategoryRow[];
  statements: CreditCardStatementRow[];
  initialLayout?: DashboardLayoutConfig | null;
  authRequired?: boolean;
  availableMoney: string;
  creditDebt: string;
  totalCreditLimit: string;
  monthlyData: MonthlyFlowItem[];
  categoryData: CategoryExpenseItem[];
  allProjections: ProjectedInstallment[];
}

export function WelcomeHubDashboard({
  accounts,
  transactions,
  categories,
  statements,
  initialLayout,
  authRequired,
  availableMoney,
  creditDebt,
  totalCreditLimit,
  monthlyData,
  categoryData,
  allProjections,
}: WelcomeHubDashboardProps) {
  // Configuración predeterminada segura
  const fallbackOrder = [...DEFAULT_DASHBOARD_WIDGET_ORDER];
  const initialOrder =
    initialLayout?.widget_order && initialLayout.widget_order.length > 0
      ? initialLayout.widget_order
      : fallbackOrder;
  const initialVisible =
    initialLayout?.visible_widgets && initialLayout.visible_widgets.length > 0
      ? initialLayout.visible_widgets
      : fallbackOrder;
  const initialCollapsed = initialLayout?.collapsed_widgets || [];

  // Estado del layout
  const [widgetOrder, setWidgetOrder] = useState<string[]>(initialOrder);
  const [visibleWidgets, setVisibleWidgets] = useState<string[]>(initialVisible);
  const [collapsedWidgets, setCollapsedWidgets] = useState<string[]>(initialCollapsed);

  // Snapshot de estado guardado para rollback ante cancelación
  const [savedSnapshot, setSavedSnapshot] = useState<DashboardLayoutConfig>({
    widget_order: initialOrder,
    visible_widgets: initialVisible,
    collapsed_widgets: initialCollapsed,
  });

  // Estados de interfaz y feedback
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isManagerModalOpen, setIsManagerModalOpen] = useState<boolean>(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Drag and drop states
  const [draggedWidgetId, setDraggedWidgetId] = useState<string | null>(null);
  const [dragOverWidgetId, setDragOverWidgetId] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();

  const paymentAccounts = accounts.filter(
    (a) => a.account_type === "cash" || a.account_type === "bank"
  );
  const creditCards = accounts.filter(
    (a) => a.account_type === "credit_card"
  );

  // Reordenar mediante flechas
  const handleMoveWidget = (id: string, direction: "up" | "down") => {
    setWidgetOrder((prev) => {
      const index = prev.indexOf(id);
      if (index === -1) return prev;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;

      const newOrder = [...prev];
      const temp = newOrder[index];
      newOrder[index] = newOrder[targetIndex];
      newOrder[targetIndex] = temp;
      return newOrder;
    });
  };

  // Reordenar mediante Drag and Drop HTML5 nativo
  const handleDragStart = (id: string) => {
    setDraggedWidgetId(id);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    e.preventDefault();
    if (draggedWidgetId && draggedWidgetId !== id) {
      setDragOverWidgetId(id);
    }
  };

  const handleDragLeave = (id: string) => {
    if (dragOverWidgetId === id) {
      setDragOverWidgetId(null);
    }
  };

  const handleDrop = (targetId: string) => {
    if (!draggedWidgetId || draggedWidgetId === targetId) {
      setDraggedWidgetId(null);
      setDragOverWidgetId(null);
      return;
    }

    setWidgetOrder((prev) => {
      const fromIndex = prev.indexOf(draggedWidgetId);
      const toIndex = prev.indexOf(targetId);
      if (fromIndex === -1 || toIndex === -1) return prev;

      const updated = [...prev];
      const [movedItem] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, movedItem);
      return updated;
    });

    setDraggedWidgetId(null);
    setDragOverWidgetId(null);
  };

  const handleDragEnd = () => {
    setDraggedWidgetId(null);
    setDragOverWidgetId(null);
  };

  // Alternar visibilidad de un widget
  const handleToggleVisibility = (id: string) => {
    setVisibleWidgets((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  // Mostrar todos los widgets
  const handleShowAll = () => {
    setVisibleWidgets([...widgetOrder]);
  };

  // Restablecer valores predeterminados
  const handleResetToDefaults = () => {
    setWidgetOrder([...DEFAULT_DASHBOARD_WIDGET_ORDER]);
    setVisibleWidgets([...DEFAULT_DASHBOARD_WIDGET_ORDER]);
    setCollapsedWidgets([]);
  };

  // Cancelar cambios y revertir a snapshot
  const handleCancel = () => {
    setWidgetOrder(savedSnapshot.widget_order);
    setVisibleWidgets(savedSnapshot.visible_widgets);
    setCollapsedWidgets(savedSnapshot.collapsed_widgets);
    setIsEditing(false);
    setErrorMessage(null);
  };

  // Guardar configuración en Supabase
  const handleSave = () => {
    setErrorMessage(null);
    startTransition(async () => {
      try {
        const payload: DashboardLayoutConfig = {
          widget_order: widgetOrder,
          visible_widgets: visibleWidgets,
          collapsed_widgets: collapsedWidgets,
        };

        const result = await saveDashboardLayout(payload);
        if (result && typeof result === "object" && "success" in result && result.success) {
          setSavedSnapshot(payload);
          setSaveFeedback("¡Diseño del Dashboard guardado exitosamente!");
          setIsEditing(false);
          setTimeout(() => {
            setSaveFeedback(null);
          }, 4000);
        } else {
          setErrorMessage(
            result && typeof result === "object" && "error" in result && typeof result.error === "string"
              ? result.error
              : "No se pudo guardar la personalización del dashboard."
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error desconocido al guardar";
        setErrorMessage(msg);
      }
    });
  };

  // Renderizar componente específico según ID
  const renderWidgetContent = (id: string) => {
    switch (id) {
      case "kpi_summary":
        return (
          <DashboardKpiWidget
            availableMoney={availableMoney}
            creditDebt={creditDebt}
            totalCreditLimit={totalCreditLimit}
          />
        );
      case "financial_charts":
        return (
          <FinancialCharts
            monthlyData={monthlyData}
            categoryData={categoryData}
            transactions={transactions}
            categories={categories}
          />
        );
      case "installment_projections":
        return (
          <InstallmentProjectionsCard
            projections={allProjections}
            paymentAccounts={paymentAccounts}
            statements={statements}
            creditCards={creditCards}
          />
        );
      case "active_accounts":
        return <DashboardActiveAccounts accounts={accounts} />;
      case "recent_transactions":
        return <DashboardRecentTransactions transactions={transactions} />;
      default:
        return null;
    }
  };

  const visibleCount = visibleWidgets.length;
  const totalCount = widgetOrder.length;

  return (
    <div className="space-y-8 relative pb-16">
      {/* Cabecera del Dashboard con disparador de Modo Edición */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-heading font-bold text-slate-900 dark:text-[#F8FAFC] tracking-tight">
            Resumen Financiero
          </h2>
          <p className="text-sm text-slate-500 dark:text-[#94A3B8] mt-1">
            Control de cuentas, tarjetas de crédito, proyecciones y Welcome Hub modular.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          {/* Botón Personalizar Dashboard */}
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (isEditing) {
                handleCancel();
              } else {
                setIsEditing(true);
              }
            }}
            className={cn(
              "border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#131B2E] text-slate-800 dark:text-[#F8FAFC] hover:bg-slate-100 dark:hover:bg-[#1a233a] rounded-xl transition-all flex items-center gap-1.5",
              isEditing && "border-amber-500 dark:border-[#D4AF37] text-amber-700 dark:text-[#D4AF37] bg-amber-500/10 shadow-[0_0_15px_rgba(217,119,6,0.2)]"
            )}
          >
            <SlidersHorizontal className="w-4 h-4 text-amber-600 dark:text-[#D4AF37]" />
            <span>{isEditing ? "Salir de Edición" : "Personalizar Dashboard"}</span>
          </Button>

          <Link href="/transactions">
            <Button className="bg-amber-600 hover:bg-amber-700 text-white dark:bg-[#D4AF37] dark:hover:bg-[#C5A059] dark:text-slate-950 dark:font-bold shadow-[0_0_15px_rgba(217,119,6,0.3)] dark:shadow-[0_0_15px_rgba(212,175,55,0.3)] rounded-xl flex items-center gap-1.5 transition-all">
              <PlusCircle className="w-4 h-4" />
              <span>Nueva Transacción</span>
            </Button>
          </Link>

          <Link href="/accounts">
            <Button
              variant="outline"
              className="border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#131B2E] text-slate-800 dark:text-[#F8FAFC] hover:bg-slate-100 dark:hover:bg-[#1a233a] rounded-xl transition-all"
            >
              Gestionar Cuentas
            </Button>
          </Link>
        </div>
      </div>

      {/* Alerta de sesión no iniciada (si corresponde) */}
      {authRequired && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              Modo Invitado / Sesión requerida
            </p>
            <p className="text-amber-800 dark:text-amber-300/90 mt-0.5">
              Inicia sesión con Supabase Auth para guardar tu diseño del Dashboard en la nube y acceder a tus cuentas reales.
            </p>
          </div>
        </div>
      )}

      {/* Banner de feedback de error si ocurre */}
      {errorMessage && (
        <div className="p-4 rounded-xl border border-[#F43F5E]/40 bg-[#F43F5E]/10 flex items-center justify-between gap-3 text-sm text-[#F43F5E]">
          <span>{errorMessage}</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setErrorMessage(null)}
            className="text-xs text-[#F43F5E] hover:bg-[#F43F5E]/10"
          >
            Cerrar
          </Button>
        </div>
      )}

      {/* Banner de Modo Edición PS5 Welcome Hub */}
      {isEditing && (
        <WelcomeHubBanner
          visibleCount={visibleCount}
          totalCount={totalCount}
          isSaving={isPending}
          saveFeedback={saveFeedback}
          onOpenManager={() => setIsManagerModalOpen(true)}
          onReset={handleResetToDefaults}
          onCancel={handleCancel}
          onSave={handleSave}
        />
      )}

      {/* Secciones Reordenables del Dashboard */}
      <div className="space-y-6">
        {widgetOrder.map((id, index) => {
          const meta = WIDGET_METADATA[id] || {
            id,
            name: id,
            description: "",
            icon: "wallet",
          };
          const isVisible = visibleWidgets.includes(id);
          const isFirst = index === 0;
          const isLast = index === widgetOrder.length - 1;
          const isDragging = draggedWidgetId === id;
          const isDragOver = dragOverWidgetId === id;

          return (
            <WidgetWrapper
              key={id}
              id={id}
              title={meta.name}
              position={index + 1}
              isFirst={isFirst}
              isLast={isLast}
              isVisible={isVisible}
              isEditing={isEditing}
              isDragging={isDragging}
              isDragOver={isDragOver}
              onMoveUp={() => handleMoveWidget(id, "up")}
              onMoveDown={() => handleMoveWidget(id, "down")}
              onToggleVisibility={() => handleToggleVisibility(id)}
              onDragStart={() => handleDragStart(id)}
              onDragOver={(e) => handleDragOver(e, id)}
              onDragLeave={() => handleDragLeave(id)}
              onDrop={() => handleDrop(id)}
              onDragEnd={handleDragEnd}
            >
              {renderWidgetContent(id)}
            </WidgetWrapper>
          );
        })}
      </div>

      {/* Botón Flotante Dinámico en la esquina inferior derecha */}
      <div className="fixed bottom-6 right-6 z-40">
        {isEditing ? (
          <Button
            type="button"
            disabled={isPending}
            onClick={handleSave}
            className="rounded-full px-5 py-3 bg-amber-600 hover:bg-amber-700 text-white dark:bg-[#D4AF37] dark:hover:bg-[#C5A059] dark:text-slate-950 font-bold text-xs shadow-[0_0_25px_rgba(217,119,6,0.5)] flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
          >
            {isPending ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Guardando...
              </span>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Guardar Diseño</span>
              </>
            )}
          </Button>
        ) : (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="bg-white/90 dark:bg-[#131B2E]/90 hover:bg-slate-50 dark:hover:bg-[#1A233D] text-slate-800 dark:text-[#F8FAFC] border border-slate-200 dark:border-amber-500/50 shadow-[0_0_20px_rgba(217,119,6,0.25)] rounded-full px-4 py-2.5 flex items-center gap-2 backdrop-blur-md transition-all group hover:scale-105"
            title="Personalizar orden y visibilidad del Dashboard"
          >
            <SlidersHorizontal className="w-4 h-4 text-amber-600 dark:text-[#D4AF37] group-hover:rotate-45 transition-transform" />
            <span className="text-xs font-heading font-semibold">Personalizar</span>
          </button>
        )}
      </div>

      {/* Modal de Administración de Widgets */}
      <WelcomeHubManagerModal
        open={isManagerModalOpen}
        onOpenChange={setIsManagerModalOpen}
        widgetOrder={widgetOrder}
        visibleWidgets={visibleWidgets}
        onMoveWidget={handleMoveWidget}
        onToggleVisibility={handleToggleVisibility}
        onShowAll={handleShowAll}
        onResetDefaults={handleResetToDefaults}
      />
    </div>
  );
}
