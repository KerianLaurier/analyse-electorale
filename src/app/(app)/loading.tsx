import { Spinner } from "@appica/ui-react/spinner";

/**
 * Fallback de navigation (Suspense racine de l'App Router). S'affiche pendant
 * le chargement d'un segment serveur — sobre, centré dans la zone `main`.
 */
export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center py-24" role="status" aria-live="polite">
      <span className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
        <Spinner currentColor className="size-4" aria-hidden />
        Chargement…
      </span>
    </div>
  );
}
