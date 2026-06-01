import { cn } from "@/lib/utils";

/** Bloc de chargement animé (placeholder). */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-foreground/[0.07]", className)} aria-hidden />;
}
