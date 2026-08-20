import { Skeleton as AppicaSkeleton } from "@appica/ui-react/skeleton";
import { cn } from "@/lib/utils";

/**
 * Bloc de chargement animé (placeholder) — `Skeleton` d'Appica UI, dont le
 * shimmer respecte `prefers-reduced-motion` sans règle maison.
 */
export function Skeleton({ className }: { className?: string }) {
  return <AppicaSkeleton className={cn("rounded-md", className)} aria-hidden />;
}

/** Squelette générique d'onglet : barre de contrôles + liste de lignes. */
export function TabSkeleton({ rows = 5, controls = true }: { rows?: number; controls?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      {controls && (
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-24 rounded-pill" />
          <Skeleton className="h-8 w-20 rounded-pill" />
          <Skeleton className="h-8 w-20 rounded-pill" />
          <Skeleton className="ml-auto h-8 w-36 rounded-pill" />
        </div>
      )}
      <div className="flex flex-col gap-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/** Squelette pour les pages multi-sections (porte-à-porte, phoning, campagne). */
export function PanelsSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-44 rounded-lg" />
      <Skeleton className="h-32 rounded-lg" />
      <Skeleton className="h-40 rounded-lg" />
    </div>
  );
}
