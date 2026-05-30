"use client";

import { Download } from "lucide-react";
import { cn } from "@/lib/utils";

/** Bouton d'export réutilisable (workspace). */
export function ExportButton({
  onClick,
  label = "Exporter CSV",
  className,
  disabled,
}: {
  onClick: () => void;
  label?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-3 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-black/[0.08] disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
    >
      <Download className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
