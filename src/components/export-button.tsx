"use client";

import { Download } from "lucide-react";
import { Button } from "@appica/ui-react/button";
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
    <Button
      type="button"
      variant="soft"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className={cn("gap-1.5 rounded-pill text-[12px]", className)}
    >
      <Download className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
