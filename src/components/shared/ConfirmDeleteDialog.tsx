"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2 } from "lucide-react";

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  onConfirm: () => Promise<void> | void;
  isDeleting?: boolean;
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title = "¿Estás seguro de eliminar este elemento?",
  description = "Esta acción es irreversible y actualizará automáticamente los saldos asociados.",
  onConfirm,
  isDeleting = false,
}: ConfirmDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !isDeleting && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md bg-[#131B2E] border border-white/[0.08] text-[#F8FAFC] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
        <DialogHeader className="gap-2">
          <div className="w-10 h-10 rounded-xl bg-[#F43F5E]/15 border border-[#F43F5E]/25 text-[#F43F5E] flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <DialogTitle className="text-lg font-heading font-bold text-[#F8FAFC]">
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs text-[#94A3B8]">
            {description}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-4 flex flex-row justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            className="text-xs border-white/[0.08] bg-[#0B0F19] text-[#F8FAFC] hover:bg-white/[0.05] rounded-xl"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-[#F43F5E] hover:bg-[#E11D48] text-white text-xs flex items-center gap-1.5 rounded-xl shadow-[0_0_15px_rgba(244,63,94,0.3)] transition-all"
          >
            {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{isDeleting ? "Eliminando..." : "Sí, eliminar"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
