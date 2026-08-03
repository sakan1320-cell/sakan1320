import { useState, useCallback } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog = ({
  open,
  title = "تأكيد العملية",
  description = "هل أنت متأكد من تنفيذ هذه العملية؟",
  confirmLabel = "تأكيد",
  cancelLabel = "إلغاء",
  variant = "destructive",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={variant === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

/**
 * Hook to easily use the ConfirmDialog imperatively.
 * Usage:
 *   const { confirm, ConfirmDialogNode } = useConfirm();
 *   // In JSX: {ConfirmDialogNode}
 *   // In handler: if (await confirm("هل تريد الحذف؟")) { ... }
 */
export const useConfirm = (options?: Partial<Omit<ConfirmDialogProps, "open" | "onConfirm" | "onCancel">>) => {
  const [open, setOpen] = useState(false);
  const [resolver, setResolver] = useState<((v: boolean) => void) | null>(null);
  const [dynamicDesc, setDynamicDesc] = useState<string | undefined>(undefined);

  const confirm = useCallback((description?: string): Promise<boolean> => {
    setDynamicDesc(description);
    setOpen(true);
    return new Promise((resolve) => {
      setResolver(() => resolve);
    });
  }, []);

  const handleConfirm = () => {
    setOpen(false);
    resolver?.(true);
  };

  const handleCancel = () => {
    setOpen(false);
    resolver?.(false);
  };

  const ConfirmDialogNode = (
    <ConfirmDialog
      open={open}
      {...options}
      description={dynamicDesc ?? options?.description}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );

  return { confirm, ConfirmDialogNode };
};
