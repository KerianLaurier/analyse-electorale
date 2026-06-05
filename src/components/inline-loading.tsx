import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Indicateur de chargement inline (spinner + libellé), centré. Remplace les
 * blocs `Loading` jusque-là redéfinis à l'identique dans chaque fiche/vue.
 */
export function InlineLoading({
  label = "Chargement…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "mt-10 flex items-center justify-center gap-2 text-[13px] text-muted-foreground",
        className,
      )}
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {label}
    </div>
  );
}
