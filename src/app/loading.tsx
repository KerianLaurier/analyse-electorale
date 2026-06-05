import { Loader2 } from "lucide-react";

/**
 * Fallback de navigation (Suspense racine de l'App Router). S'affiche pendant
 * le chargement d'un segment serveur — sobre, centré dans la zone `main`.
 */
export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center py-24" role="status" aria-live="polite">
      <span className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Chargement…
      </span>
    </div>
  );
}
