"use client";

import React from "react";
import {
  GripVertical,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface WidgetWrapperProps {
  id: string;
  title: string;
  position: number;
  isFirst: boolean;
  isLast: boolean;
  isVisible: boolean;
  isEditing: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleVisibility: () => void;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
  children: React.ReactNode;
}

export function WidgetWrapper({
  title,
  position,
  isFirst,
  isLast,
  isVisible,
  isEditing,
  isDragging,
  isDragOver,
  onMoveUp,
  onMoveDown,
  onToggleVisibility,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  children,
}: WidgetWrapperProps) {
  if (!isEditing) {
    if (!isVisible) {
      return null;
    }
    return <div>{children}</div>;
  }

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "rounded-2xl transition-all duration-300 relative border overflow-hidden",
        isDragOver
          ? "border-amber-500 dark:border-[#D4AF37] ring-4 ring-amber-500/40 dark:ring-[#D4AF37]/40 shadow-[0_0_35px_rgba(217,119,6,0.35)] scale-[1.01]"
          : "border-amber-500/30 dark:border-amber-500/25 ring-1 ring-amber-500/20 shadow-[0_0_20px_rgba(217,119,6,0.15)]",
        isDragging && "opacity-40 border-dashed border-amber-500 dark:border-[#D4AF37]",
        !isVisible && "opacity-60 saturate-50 hover:opacity-85"
      )}
    >
      {/* PS5 Welcome Hub Style Header Toolbar */}
      <div className="bg-slate-100/90 dark:bg-[#0E1526]/95 border-b border-amber-500/20 px-4 py-2.5 flex items-center justify-between gap-3 backdrop-blur-md">
        {/* Drag handle & widget metadata */}
        <div
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          className="flex items-center gap-2.5 cursor-grab active:cursor-grabbing group select-none py-1 px-1.5 rounded-lg hover:bg-amber-500/10 transition-colors"
          title="Arrastra para reordenar esta sección"
        >
          <GripVertical className="w-4 h-4 text-slate-400 dark:text-[#94A3B8] group-hover:text-amber-600 dark:group-hover:text-[#D4AF37] transition-colors" />
          <span className="text-sm font-heading font-bold text-slate-900 dark:text-[#F8FAFC]">
            {title}
          </span>
          <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-[#D4AF37] border border-amber-500/30">
            Posición #{position}
          </span>
        </div>

        {/* Quick controls: Move Up, Move Down, Toggle Visibility */}
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={isFirst}
            onClick={onMoveUp}
            title="Mover arriba"
            className="h-8 w-8 text-slate-500 dark:text-[#94A3B8] hover:text-amber-600 dark:hover:text-[#D4AF37] hover:bg-amber-500/10 rounded-lg disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronUp className="w-4 h-4" />
          </Button>

          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={isLast}
            onClick={onMoveDown}
            title="Mover abajo"
            className="h-8 w-8 text-slate-500 dark:text-[#94A3B8] hover:text-amber-600 dark:hover:text-[#D4AF37] hover:bg-amber-500/10 rounded-lg disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronDown className="w-4 h-4" />
          </Button>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onToggleVisibility}
            title={isVisible ? "Ocultar este widget" : "Hacer visible este widget"}
            className={cn(
              "h-8 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors",
              isVisible
                ? "text-[#10B981] hover:text-[#10B981] hover:bg-[#10B981]/10"
                : "text-slate-400 dark:text-[#94A3B8] hover:text-white hover:bg-white/[0.08]"
            )}
          >
            {isVisible ? (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Visible</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-400 hidden sm:inline">Oculto</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Widget Body Content */}
      <div className="p-1">
        {children}
      </div>

      {/* Overlay indicator if widget is hidden */}
      {!isVisible && (
        <div className="px-4 py-2 bg-amber-500/10 border-t border-amber-500/20 flex items-center justify-between text-xs">
          <span className="text-amber-800 dark:text-amber-300 font-medium">
            Sección oculta en el Dashboard principal
          </span>
          <button
            type="button"
            onClick={onToggleVisibility}
            className="text-xs font-semibold text-amber-600 dark:text-[#D4AF37] hover:underline"
          >
            Hacer visible
          </button>
        </div>
      )}
    </div>
  );
}
