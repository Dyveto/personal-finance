"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  Wallet,
  CreditCard,
  Building2,
  Check,
  ChevronDown,
  X,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AccountRow } from "@/features/accounts/actions/account-actions";

export interface AccountMultiSelectProps {
  accounts: AccountRow[];
  selectedAccountIds: string[];
  onChange: (selectedIds: string[]) => void;
  placeholder?: string;
  className?: string;
}

function renderAccountIcon(
  accountType: string,
  color?: string | null,
  className = "w-3.5 h-3.5"
) {
  const iconProps = { className, style: color ? { color } : undefined };

  switch (accountType) {
    case "credit_card":
      return <CreditCard {...iconProps} />;
    case "bank":
      return <Building2 {...iconProps} />;
    case "cash":
    default:
      return <Wallet {...iconProps} />;
  }
}

export function AccountMultiSelect({
  accounts,
  selectedAccountIds,
  onChange,
  placeholder = "Todas las cuentas",
  className,
}: AccountMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Filtrado interno para el buscador dentro del desplegable
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return accounts;
    const q = searchQuery.toLowerCase().trim();
    return accounts.filter((acc) => acc.name.toLowerCase().includes(q));
  }, [accounts, searchQuery]);

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

  const toggleAccount = (accountId: string) => {
    const exists = selectedAccountIds.includes(accountId);

    if (exists) {
      onChange(selectedAccountIds.filter((id) => id !== accountId));
    } else {
      onChange([...selectedAccountIds, accountId]);
    }
  };

  const handleSelectAll = () => {
    const allIds = filteredOptions.map((a) => a.id);
    const combined = Array.from(new Set([...selectedAccountIds, ...allIds]));
    onChange(combined);
  };

  const handleClearAll = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    onChange([]);
  };

  const isSelected = (accountId: string) => {
    return selectedAccountIds.includes(accountId);
  };

  // Texto de disparo
  const count = selectedAccountIds.length;
  let triggerLabel = placeholder;
  if (count === 1) {
    const selectedAcc = accounts.find((a) => a.id === selectedAccountIds[0]);
    triggerLabel = `1 cuenta: ${selectedAcc ? selectedAcc.name : selectedAccountIds[0]}`;
  } else if (count > 1) {
    triggerLabel = `${count} cuentas seleccionadas`;
  }

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Botón Disparador del Selector */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "w-full h-10 px-3 rounded-xl border text-xs font-medium flex items-center justify-between gap-2 transition-all select-none focus:outline-none focus:ring-2 focus:ring-[#3B82F6]",
          isOpen
            ? "border-[#3B82F6] ring-2 ring-[#3B82F6]/30 bg-white dark:bg-[#131B2E]"
            : "border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0B0F19] hover:border-slate-300 dark:hover:border-white/[0.2]",
          count > 0 ? "text-slate-900 dark:text-[#F8FAFC]" : "text-slate-600 dark:text-[#94A3B8]"
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 truncate">
          <Wallet
            className={cn(
              "w-3.5 h-3.5 flex-shrink-0 transition-colors",
              count > 0 ? "text-[#3B82F6]" : "text-slate-400 dark:text-[#94A3B8]"
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
              title="Limpiar filtro de cuentas"
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
                placeholder="Buscar cuenta..."
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
                  className="text-[#3B82F6] hover:text-[#2563EB] font-semibold hover:underline"
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

          {/* Lista de cuentas con casillas de verificación */}
          <div className="max-h-60 overflow-y-auto mt-2 space-y-1 pr-1">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 dark:text-[#94A3B8]">
                No se encontraron cuentas
              </div>
            ) : (
              filteredOptions.map((acc) => {
                const checked = isSelected(acc.id);

                return (
                  <div
                    key={`account-option-${acc.id}`}
                    onClick={() => toggleAccount(acc.id)}
                    className={cn(
                      "flex items-center gap-2.5 p-2 rounded-xl text-xs cursor-pointer select-none transition-all group",
                      checked
                        ? "bg-[#3B82F6]/10 text-slate-900 dark:text-[#F8FAFC]"
                        : "text-slate-700 dark:text-[#94A3B8] hover:bg-slate-100 dark:hover:bg-white/[0.05]"
                    )}
                  >
                    {/* Casilla de verificación visual */}
                    <div
                      className={cn(
                        "w-4 h-4 rounded-md border flex items-center justify-center transition-all flex-shrink-0",
                        checked
                          ? "bg-[#3B82F6] border-[#3B82F6] text-white shadow-sm"
                          : "border-slate-300 dark:border-white/[0.2] bg-white dark:bg-[#0B0F19] group-hover:border-[#3B82F6]/50"
                      )}
                    >
                      {checked && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>

                    {/* Icono de la cuenta */}
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: acc.color ? `${acc.color}20` : "rgba(59, 130, 246, 0.15)",
                        border: `1px solid ${acc.color ? `${acc.color}40` : "rgba(59, 130, 246, 0.3)"}`,
                      }}
                    >
                      {renderAccountIcon(acc.account_type, acc.color, "w-3.5 h-3.5")}
                    </div>

                    {/* Nombre limpio de la cuenta */}
                    <span className="font-heading font-semibold truncate text-slate-900 dark:text-[#F8FAFC]">
                      {acc.name}
                    </span>
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
