import { Spinner } from "@appica/ui-react/spinner";
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
      {/* `currentColor` : le spinner suit la couleur du libellé plutôt que
          l'accent primaire — un chargement discret, pas une alerte. */}
      <Spinner currentColor className="size-4" aria-label={label} />
      {label}
    </div>
  );
}
