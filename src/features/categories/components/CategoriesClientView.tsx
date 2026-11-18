"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Tag,
  PlusCircle,
  Search,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowDownRight,
  ArrowUpRight,
  Utensils,
  Car,
  Home,
  Heart,
  Film,
  ShoppingBag,
  BookOpen,
  MoreHorizontal,
  Wallet,
  Laptop,
  TrendingUp,
  Coffee,
  Gift,
  Dumbbell,
  Plane,
  Gamepad2,
  Briefcase,
  Music,
  Check,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  type CategoryRow,
} from "@/features/categories/actions/category-actions";

interface CategoriesClientViewProps {
  initialCategories: CategoryRow[];
}

const COLOR_PALETTE = [
  "#8B5CF6", // Electric Violet
  "#10B981", // Emerald
  "#3B82F6", // Blue
  "#F59E0B", // Amber
  "#F43F5E", // Crimson
  "#06B6D4", // Cyan
  "#EC4899", // Pink
  "#14B8A6", // Teal
  "#64748B", // Slate
  "#A855F7", // Purple
];

const AVAILABLE_ICONS = [
  { id: "wallet", label: "Billetera", icon: Wallet },
  { id: "laptop", label: "Laptop", icon: Laptop },
  { id: "trending-up", label: "Inversión", icon: TrendingUp },
  { id: "plus-circle", label: "Ingreso", icon: PlusCircle },
  { id: "utensils", label: "Comida", icon: Utensils },
  { id: "car", label: "Transporte", icon: Car },
  { id: "home", label: "Vivienda", icon: Home },
  { id: "heart", label: "Salud", icon: Heart },
  { id: "film", label: "Entretenimiento", icon: Film },
  { id: "shopping-bag", label: "Compras", icon: ShoppingBag },
  { id: "book", label: "Educación", icon: BookOpen },
  { id: "coffee", label: "Café / Salidas", icon: Coffee },
  { id: "gift", label: "Regalos", icon: Gift },
  { id: "dumbbell", label: "Deporte / Gym", icon: Dumbbell },
  { id: "plane", label: "Viajes", icon: Plane },
  { id: "gamepad", label: "Videojuegos", icon: Gamepad2 },
  { id: "briefcase", label: "Negocio / Trabajo", icon: Briefcase },
  { id: "music", label: "Música / Shows", icon: Music },
  { id: "sparkles", label: "Especial", icon: Sparkles },
  { id: "more-horizontal", label: "Otros", icon: MoreHorizontal },
];

function renderCategoryIcon(iconName: string | null, type: "income" | "expense", className = "w-4 h-4") {
  const match = AVAILABLE_ICONS.find((i) => i.id === iconName);
  if (match) {
    const IconComp = match.icon;
    return <IconComp className={className} />;
  }

  return type === "income" ? (
    <ArrowDownRight className={className} />
  ) : (
    <Tag className={className} />
  );
}

export function CategoriesClientView({ initialCategories }: CategoriesClientViewProps) {
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryRow[]>(initialCategories);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "expense" | "income" | "archived">("all");

  // Estados de diálogo
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<CategoryRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Formulario interno de categoría
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<"income" | "expense">("expense");
  const [formIcon, setFormIcon] = useState("tag");
  const [formColor, setFormColor] = useState("#8B5CF6");
  const [formActive, setFormActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Reset del formulario para nueva categoría
  const handleOpenCreateDialog = () => {
    setEditingCategory(null);
    setFormName("");
    setFormType("expense");
    setFormIcon("utensils");
    setFormColor("#8B5CF6");
    setFormActive(true);
    setFormError(null);
    setIsDialogOpen(true);
  };

  // Apertura para edición
  const handleOpenEditDialog = (cat: CategoryRow) => {
    setEditingCategory(cat);
    setFormName(cat.name);
    setFormType(cat.category_type);
    setFormIcon(cat.icon || (cat.category_type === "income" ? "wallet" : "tag"));
    setFormColor(cat.color || (cat.category_type === "income" ? "#10B981" : "#F43F5E"));
    setFormActive(cat.is_active !== false);
    setFormError(null);
    setIsDialogOpen(true);
  };

  // Guardado de categoría (creación o edición)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError("El nombre de la categoría es requerido.");
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);

      if (editingCategory) {
        // Actualizar
        const res = await updateCategory(editingCategory.id, {
          name: formName.trim(),
          category_type: formType,
          icon: formIcon,
          color: formColor,
          is_active: formActive,
        });

        if (!res.success) {
          setFormError(res.error);
          return;
        }

        setCategories((prev) =>
          prev.map((c) => (c.id === editingCategory.id ? res.data : c))
        );
        setFeedback({
          type: "success",
          message: `Categoría '${res.data.name}' actualizada exitosamente.`,
        });
      } else {
        // Crear
        const res = await createCategory({
          name: formName.trim(),
          category_type: formType,
          icon: formIcon,
          color: formColor,
          is_active: formActive,
        });

        if (!res.success) {
          setFormError(res.error);
          return;
        }

        setCategories((prev) => [...prev, res.data]);
        setFeedback({
          type: "success",
          message: `Categoría '${res.data.name}' creada exitosamente.`,
        });
      }

      setIsDialogOpen(false);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al procesar la categoría";
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirmar eliminación
  const handleConfirmDelete = async () => {
    if (!deletingCategory) return;
    try {
      setIsDeleting(true);
      const res = await deleteCategory(deletingCategory.id);

      if (!res.success) {
        setFeedback({ type: "error", message: res.error });
        setDeletingCategory(null);
        return;
      }

      setCategories((prev) => prev.filter((c) => c.id !== deletingCategory.id));
      setFeedback({
        type: "success",
        message: `Categoría '${deletingCategory.name}' eliminada definitivamente.`,
      });

      setDeletingCategory(null);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al eliminar la categoría";
      setFeedback({ type: "error", message: msg });
    } finally {
      setIsDeleting(false);
    }
  };

  // Categorías filtradas
  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => {
      // Filtro por tipo o estado
      if (typeFilter === "archived") {
        if (cat.is_active !== false) return false;
      } else {
        if (cat.is_active === false && typeFilter !== "all") return false;
        if (typeFilter === "expense" && cat.category_type !== "expense") return false;
        if (typeFilter === "income" && cat.category_type !== "income") return false;
      }

      // Filtro por búsqueda
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        return cat.name.toLowerCase().includes(term);
      }

      return true;
    });
  }, [categories, typeFilter, searchTerm]);

  // Contadores
  const totalActive = categories.filter((c) => c.is_active !== false).length;
  const totalExpense = categories.filter((c) => c.category_type === "expense" && c.is_active !== false).length;
  const totalIncome = categories.filter((c) => c.category_type === "income" && c.is_active !== false).length;
  const totalArchived = categories.filter((c) => c.is_active === false).length;

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

      {/* Header y Acción Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-heading font-bold text-slate-900 dark:text-[#F8FAFC] tracking-tight">
            Administración de Categorías
          </h2>
          <p className="text-sm text-slate-500 dark:text-[#94A3B8] mt-1">
            Personaliza iconos, colores y nombres para organizar tus ingresos y gastos.
          </p>
        </div>

        <Button
          onClick={handleOpenCreateDialog}
          className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white shadow-[0_0_15px_rgba(139,92,246,0.3)] rounded-xl flex items-center gap-1.5 self-start sm:self-auto transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Nueva Categoría</span>
        </Button>
      </div>

      {/* KPI Cards de Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="surface-card p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500 dark:text-[#94A3B8]">
              Categorías de Gasto
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#F43F5E]/15 border border-[#F43F5E]/25 flex items-center justify-center text-[#F43F5E]">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-heading font-extrabold text-[#F43F5E] mt-3">
            {totalExpense}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] mt-0.5">
            Clasificación de compras y salidas
          </p>
        </div>

        <div className="surface-card p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500 dark:text-[#94A3B8]">
              Categorías de Ingreso
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#10B981]/15 border border-[#10B981]/25 flex items-center justify-center text-[#10B981]">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-heading font-extrabold text-[#10B981] mt-3">
            {totalIncome}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] mt-0.5">
            Sueldos, honorarios y rentas
          </p>
        </div>

        <div className="surface-card p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500 dark:text-[#94A3B8]">
              Total Activas
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#8B5CF6]/15 border border-[#8B5CF6]/25 flex items-center justify-center text-[#8B5CF6]">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-heading font-extrabold text-slate-900 dark:text-[#F8FAFC] mt-3">
            {totalActive}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] mt-0.5">
            {totalArchived > 0 ? `${totalArchived} archivada(s)` : "Todas disponibles"}
          </p>
        </div>
      </div>

      {/* Barra de Búsqueda y Pestañas */}
      <div className="surface-card p-4 rounded-2xl space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#94A3B8]" />
            <Input
              placeholder="Buscar categoría por nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-full bg-slate-50 dark:bg-[#0B0F19] border-slate-200 dark:border-white/[0.1] text-xs h-10 text-slate-900 dark:text-[#F8FAFC] rounded-xl"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <Button
              variant={typeFilter === "all" ? "default" : "ghost"}
              size="sm"
              onClick={() => setTypeFilter("all")}
              className={`rounded-xl text-xs ${
                typeFilter === "all"
                  ? "bg-[#8B5CF6] text-white hover:bg-[#7C3AED]"
                  : "text-slate-600 dark:text-[#94A3B8]"
              }`}
            >
              Todas ({categories.length})
            </Button>
            <Button
              variant={typeFilter === "expense" ? "default" : "ghost"}
              size="sm"
              onClick={() => setTypeFilter("expense")}
              className={`rounded-xl text-xs ${
                typeFilter === "expense"
                  ? "bg-[#F43F5E] text-white hover:bg-rose-600"
                  : "text-slate-600 dark:text-[#94A3B8]"
              }`}
            >
              Gastos ({totalExpense})
            </Button>
            <Button
              variant={typeFilter === "income" ? "default" : "ghost"}
              size="sm"
              onClick={() => setTypeFilter("income")}
              className={`rounded-xl text-xs ${
                typeFilter === "income"
                  ? "bg-[#10B981] text-white hover:bg-emerald-600"
                  : "text-slate-600 dark:text-[#94A3B8]"
              }`}
            >
              Ingresos ({totalIncome})
            </Button>
            {totalArchived > 0 && (
              <Button
                variant={typeFilter === "archived" ? "default" : "ghost"}
                size="sm"
                onClick={() => setTypeFilter("archived")}
                className={`rounded-xl text-xs ${
                  typeFilter === "archived"
                    ? "bg-slate-700 text-white"
                    : "text-slate-500 dark:text-[#94A3B8]"
                }`}
              >
                Archivadas ({totalArchived})
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Grid de Categorías */}
      {filteredCategories.length === 0 ? (
        <div className="surface-card p-12 rounded-2xl border-dashed border-slate-300 dark:border-white/[0.1] text-center">
          <Tag className="w-10 h-10 text-slate-400 dark:text-[#94A3B8]/40 mx-auto mb-3" />
          <h3 className="text-base font-heading font-bold text-slate-900 dark:text-[#F8FAFC]">
            No se encontraron categorías
          </h3>
          <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-1">
            Modifica la búsqueda o crea tu primera categoría personalizada.
          </p>
          <div className="mt-4">
            <Button
              onClick={handleOpenCreateDialog}
              size="sm"
              className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-xl text-xs"
            >
              Crear Categoría
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCategories.map((cat) => {
            const isExpense = cat.category_type === "expense";
            const isInactive = cat.is_active === false;
            const categoryColor = cat.color || (isExpense ? "#F43F5E" : "#10B981");

            return (
              <div
                key={cat.id}
                className={`surface-card p-4 rounded-2xl border transition-all flex flex-col justify-between group ${
                  isInactive
                    ? "opacity-60 bg-slate-100/50 dark:bg-white/[0.02]"
                    : "hover:border-[#8B5CF6]/30"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
                        style={{
                          backgroundColor: `${categoryColor}20`,
                          borderColor: `${categoryColor}40`,
                          color: categoryColor,
                          borderWidth: "1px",
                        }}
                      >
                        {renderCategoryIcon(cat.icon, cat.category_type, "w-5 h-5")}
                      </div>

                      <div className="min-w-0">
                        <h4 className="text-sm font-heading font-bold text-slate-900 dark:text-[#F8FAFC] truncate">
                          {cat.name}
                        </h4>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              isExpense
                                ? "bg-[#F43F5E]/15 text-[#F43F5E]"
                                : "bg-[#10B981]/15 text-[#10B981]"
                            }`}
                          >
                            {isExpense ? "Gasto" : "Ingreso"}
                          </span>
                          {cat.is_default ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200/60 dark:bg-white/[0.06] text-slate-600 dark:text-[#94A3B8]">
                              Predeterminada
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#8B5CF6]/15 text-[#8B5CF6] border border-[#8B5CF6]/25">
                              Personalizada
                            </span>
                          )}
                          {isInactive && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-500 border border-amber-500/25">
                              Archivada
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEditDialog(cat)}
                        title="Editar categoría"
                        className="h-8 w-8 p-0 text-slate-400 hover:text-slate-900 dark:text-[#94A3B8] dark:hover:text-[#F8FAFC] hover:bg-slate-100 dark:hover:bg-white/[0.05] rounded-lg"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span className="sr-only">Editar</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingCategory(cat)}
                        title="Eliminar o archivar categoría"
                        className="h-8 w-8 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="sr-only">Eliminar</span>
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-[11px] text-slate-500 dark:text-[#94A3B8]">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: categoryColor }}
                    />
                    <span>Color temático</span>
                  </span>
                  <span>{cat.is_active !== false ? "Activa" : "Oculta"}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Crear / Editar Categoría */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-[#F8FAFC] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
          <DialogHeader>
            <DialogTitle className="font-heading font-bold text-slate-900 dark:text-[#F8FAFC]">
              {editingCategory ? "Editar Categoría" : "Nueva Categoría Personalizada"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-[#94A3B8]">
              {editingCategory
                ? "Modifica el nombre, icono o color. Los cambios se actualizarán inmediatamente."
                : "Crea una nueva categoría para organizar tus transacciones e informes."}
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="p-3 rounded-xl border border-rose-300 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmitForm} className="space-y-4">
            {/* Nombre */}
            <div className="space-y-1.5">
              <Label htmlFor="cat_name" className="text-xs font-semibold">
                Nombre de la Categoría
              </Label>
              <Input
                id="cat_name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ej. Cine, Mascotas, Suscripciones..."
                className="bg-slate-50 dark:bg-[#0B0F19] border-slate-200 dark:border-white/[0.1] text-xs h-10"
                autoFocus
              />
            </div>

            {/* Tipo de Movimiento */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Tipo de Movimiento</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={formType === "expense" ? "default" : "outline"}
                  onClick={() => setFormType("expense")}
                  className={`text-xs font-bold rounded-xl ${
                    formType === "expense"
                      ? "bg-[#F43F5E] hover:bg-rose-600 text-white shadow-[0_0_12px_rgba(244,63,94,0.3)]"
                      : "border-slate-200 dark:border-white/[0.1] text-slate-600 dark:text-[#94A3B8]"
                  }`}
                >
                  Gasto
                </Button>
                <Button
                  type="button"
                  variant={formType === "income" ? "default" : "outline"}
                  onClick={() => setFormType("income")}
                  className={`text-xs font-bold rounded-xl ${
                    formType === "income"
                      ? "bg-[#10B981] hover:bg-emerald-600 text-white shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                      : "border-slate-200 dark:border-white/[0.1] text-slate-600 dark:text-[#94A3B8]"
                  }`}
                >
                  Ingreso
                </Button>
              </div>
            </div>

            {/* Paleta de Colores */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Color Temático</Label>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormColor(color)}
                    className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 relative"
                    style={{ backgroundColor: color }}
                  >
                    {formColor === color && (
                      <Check className="w-3.5 h-3.5 text-white drop-shadow" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Selector de Icono */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Icono Representativo</Label>
              <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 max-h-36 overflow-y-auto p-2 rounded-xl bg-slate-50 dark:bg-[#0B0F19] border border-slate-200 dark:border-white/[0.08]">
                {AVAILABLE_ICONS.map((item) => {
                  const IconC = item.icon;
                  const isSelected = formIcon === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFormIcon(item.id)}
                      className={`p-2 rounded-lg flex flex-col items-center justify-center gap-1 transition-all ${
                        isSelected
                          ? "bg-[#8B5CF6] text-white shadow-sm scale-105"
                          : "text-slate-600 dark:text-[#94A3B8] hover:bg-slate-200/60 dark:hover:bg-white/[0.08]"
                      }`}
                      title={item.label}
                    >
                      <IconC className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Estado Activo / Inactivo */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-[#0B0F19] border border-slate-200 dark:border-white/[0.08]">
              <div>
                <Label htmlFor="cat_active" className="text-xs font-semibold cursor-pointer block">
                  Categoría Activa
                </Label>
                <span className="text-[11px] text-slate-500 dark:text-[#94A3B8]">
                  Visible en selectores y formularios de transacciones
                </span>
              </div>
              <input
                id="cat_active"
                type="checkbox"
                checked={formActive}
                onChange={(e) => setFormActive(e.target.checked)}
                className="w-4 h-4 rounded text-[#8B5CF6] focus:ring-[#8B5CF6] accent-[#8B5CF6]"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-white/[0.08]">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="text-xs border-slate-200 dark:border-white/[0.1] rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="text-xs bg-[#8B5CF6] hover:bg-[#7C3AED] text-white shadow-[0_0_15px_rgba(139,92,246,0.3)] rounded-xl"
              >
                {isSubmitting ? "Guardando..." : editingCategory ? "Guardar Cambios" : "Crear Categoría"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Confirmación de Eliminación */}
      <ConfirmDeleteDialog
        open={Boolean(deletingCategory)}
        onOpenChange={(open) => !open && setDeletingCategory(null)}
        title="¿Eliminar categoría definitivamente?"
        description={`¿Estás seguro de que deseas eliminar permanentemente la categoría "${deletingCategory?.name}"? Esta acción solo es posible si no tiene transacciones asociadas.`}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}
