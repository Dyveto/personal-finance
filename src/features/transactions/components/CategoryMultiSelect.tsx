"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  Tag,
  Check,
  ChevronDown,
  X,
  Search,
  Wallet,
  Laptop,
  TrendingUp,
  PlusCircle,
  Utensils,
  Car,
  Home,
  Heart,
  Film,
  ShoppingBag,
  BookOpen,
  MoreHorizontal,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CategoryRow } from "@/features/categories/actions/category-actions";

export interface UniqueBaseCategory {
  name: string;
  icon: string | null;
  color: string | null;
  hasExpense: boolean;
  hasIncome: boolean;
  categoryIds: string[];
}

export interface CategoryMultiSelectProps {
  categories: CategoryRow[];
  selectedCategoryNames: string[];
  onChange: (selectedNames: string[]) => void;
  placeholder?: string;
  className?: string;
}

function renderCategoryIcon(
  iconName: string | null,
  color?: string | null,
  className = "w-3.5 h-3.5"
) {
  const iconProps = { className, style: color ? { color } : undefined };

  switch (iconName) {
    case "wallet":
      return <Wallet {...iconProps} />;
    case "laptop":
      return <Laptop {...iconProps} />;
    case "trending-up":
      return <TrendingUp {...iconProps} />;
    case "plus-circle":
      return <PlusCircle {...iconProps} />;
    case "utensils":
      return <Utensils {...iconProps} />;
    case "car":
      return <Car {...iconProps} />;
    case "home":
      return <Home {...iconProps} />;
    case "heart":
      return <Heart {...iconProps} />;
    case "film":
      return <Film {...iconProps} />;
    case "shopping-bag":
      return <ShoppingBag {...iconProps} />;
    case "book":
      return <BookOpen {...iconProps} />;
    case "more-horizontal":
      return <MoreHorizontal {...iconProps} />;
    default:
      return <Tag {...iconProps} />;
  }
}

/**
 * Unifica un listado de categorías de la base de datos por su nombre base (sin importar
 * si están registradas como ingreso o gasto por separado).
 */
export function unifyCategoriesByBaseName(categories: CategoryRow[]): UniqueBaseCategory[] {
  const map = new Map<string, UniqueBaseCategory>();

  for (const cat of categories) {
    const rawName = cat.name.trim();
    if (!rawName) continue;
    const key = rawName.toLowerCase();

    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        name: rawName,
        icon: cat.icon || null,
        color: cat.color || null,
        hasExpense: cat.category_type === "expense",
        hasIncome: cat.category_type === "income",
        categoryIds: [cat.id],
      });
    } else {
      if (cat.category_type === "expense") existing.hasExpense = true;
      if (cat.category_type === "income") existing.hasIncome = true;
      existing.categoryIds.push(cat.id);
      if (!existing.icon && cat.icon) existing.icon = cat.icon;
      if (!existing.color && cat.color) existing.color = cat.color;
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "es", { sensitivity: "base" })
  );
}

export function CategoryMultiSelect({
  categories,
  selectedCategoryNames,
  onChange,
  placeholder = "Todas las categorías",
  className,
}: CategoryMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Unificación de categorías por nombre base (case-insensitive)
  const uniqueBaseCategories = useMemo<UniqueBaseCategory[]>(() => {
    return unifyCategoriesByBaseName(categories);
  }, [categories]);

  // Filtrado interno para el buscador dentro del dropdown
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return uniqueBaseCategories;
    const q = searchQuery.toLowerCase().trim();
    return uniqueBaseCategories.filter((cat) => cat.name.toLowerCase().includes(q));
  }, [uniqueBaseCategories, searchQuery]);

  // Cerrar al hacer clic fuera o presionar Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const toggleCategory = (catName: string) => {
    const norm = catName.trim().toLowerCase();
    const exists = selectedCategoryNames.some((n) => n.trim().toLowerCase() === norm);

    if (exists) {
      onChange(selectedCategoryNames.filter((n) => n.trim().toLowerCase() !== norm));
    } else {
      onChange([...selectedCategoryNames, catName.trim()]);
    }
  };

  const handleSelectAll = () => {
    const allNames = filteredOptions.map((c) => c.name);
    const combined = Array.from(new Set([...selectedCategoryNames, ...allNames]));
    onChange(combined);
  };

  const handleClearAll = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    onChange([]);
  };

  const isSelected = (catName: string) => {
    const norm = catName.trim().toLowerCase();
    return selectedCategoryNames.some((n) => n.trim().toLowerCase() === norm);
  };

  // Texto o etiqueta de disparo
  const count = selectedCategoryNames.length;
  let triggerLabel = placeholder;
  if (count === 1) {
    triggerLabel = `1 categoría: ${selectedCategoryNames[0]}`;
  } else if (count > 1) {
    triggerLabel = `${count} categorías seleccionadas`;
  }

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Botón Disparador del Selector */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "w-full h-10 px-3 rounded-xl border text-xs font-medium flex items-center justify-between gap-2 transition-all select-none focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]",
          isOpen
            ? "border-[#8B5CF6] ring-2 ring-[#8B5CF6]/30 bg-white dark:bg-[#131B2E]"
            : "border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0B0F19] hover:border-slate-300 dark:hover:border-white/[0.2]",
          count > 0 ? "text-slate-900 dark:text-[#F8FAFC]" : "text-slate-600 dark:text-[#94A3B8]"
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 truncate">
          <Tag
            className={cn(
              "w-3.5 h-3.5 flex-shrink-0 transition-colors",
              count > 0 ? "text-[#8B5CF6]" : "text-slate-400 dark:text-[#94A3B8]"
            )}
          />
          <span className="truncate">{triggerLabel}</span>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {count > 0 && (
            <span
              onClick={handleClearAll}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  handleClearAll();
                }
              }}
              title="Limpiar filtro de categorías"
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/[0.1] transition-colors"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 text-slate-400 dark:text-[#94A3B8] transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </div>
      </button>

      {/* Menú Desplegable con Casillas de Verificación */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-full min-w-[280px] sm:min-w-[320px] max-w-sm rounded-2xl border border-slate-200 dark:border-white/[0.12] bg-white dark:bg-[#131B2E] shadow-2xl p-3 z-50 animate-in fade-in-50 zoom-in-95 duration-150">
          {/* Cabecera interna del selector */}
          <div className="space-y-2 pb-2.5 border-b border-slate-100 dark:border-white/[0.06]">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#94A3B8]" />
              <Input
                type="text"
                placeholder="Buscar categoría..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-slate-50 dark:bg-[#0B0F19] border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-[#F8FAFC] rounded-lg"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-[#94A3B8] pt-1">
              <span className="font-semibold">
                {count > 0 ? `${count} seleccionada(s)` : "Ninguna seleccionada"}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-[#8B5CF6] hover:text-[#7C3AED] font-semibold hover:underline"
                >
                  Todas
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => onChange([])}
                  disabled={count === 0}
                  className={cn(
                    "font-semibold",
                    count > 0
                      ? "text-rose-500 hover:text-rose-600 hover:underline"
                      : "text-slate-400 cursor-not-allowed"
                  )}
                >
                  Limpiar
                </button>
              </div>
            </div>
          </div>

          {/* Lista de categorías unificadas por nombre base */}
          <div className="max-h-60 overflow-y-auto mt-2 space-y-1 pr-1">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 dark:text-[#94A3B8]">
                No se encontraron categorías
              </div>
            ) : (
              filteredOptions.map((cat) => {
                const checked = isSelected(cat.name);
                const hasBoth = cat.hasExpense && cat.hasIncome;

                return (
                  <div
                    key={`unified-cat-${cat.name}`}
                    onClick={() => toggleCategory(cat.name)}
                    className={cn(
                      "flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer select-none transition-all group",
                      checked
                        ? "bg-[#8B5CF6]/10 text-slate-900 dark:text-[#F8FAFC]"
                        : "text-slate-700 dark:text-[#94A3B8] hover:bg-slate-100 dark:hover:bg-white/[0.05]"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Casilla de verificación visual */}
                      <div
                        className={cn(
                          "w-4 h-4 rounded-md border flex items-center justify-center transition-all flex-shrink-0",
                          checked
                            ? "bg-[#8B5CF6] border-[#8B5CF6] text-white shadow-sm"
                            : "border-slate-300 dark:border-white/[0.2] bg-white dark:bg-[#0B0F19] group-hover:border-[#8B5CF6]/50"
                        )}
                      >
                        {checked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>

                      {/* Icono de la categoría */}
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                          backgroundColor: cat.color ? `${cat.color}20` : "rgba(139, 92, 246, 0.15)",
                          border: `1px solid ${cat.color ? `${cat.color}40` : "rgba(139, 92, 246, 0.3)"}`,
                        }}
                      >
                        {renderCategoryIcon(cat.icon, cat.color, "w-3.5 h-3.5")}
                      </div>

                      {/* Nombre base unificado */}
                      <span className="font-heading font-semibold truncate text-slate-900 dark:text-[#F8FAFC]">
                        {cat.name}
                      </span>
                    </div>

                    {/* Badge indicativo de tipo de movimiento disponible */}
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      {hasBoth ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/25">
                          Gasto e Ingreso
                        </span>
                      ) : cat.hasExpense ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/25">
                          Gasto
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                          Ingreso
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
