import { cn } from "@/lib/utils";

// « M » plein géométrique (contour fermé) — monogramme de marque MOUVANCIA.
export const LOGO_M = "M3 17 L3 3 L7 3 L12 10 L17 3 L21 3 L21 17 L17 17 L17 8.25 L12 14.38 L7 8.25 L7 17 Z";

/**
 * Marque MOUVANCIA : tuile au « M » plein surmontant un socle chaud. La tuile
 * s'inverse proprement entre thèmes (le socle reste chaud). Source unique,
 * réutilisée par la landing et le header applicatif.
 */
export function BrandMark({
  tileClassName,
  svgClassName,
}: {
  tileClassName?: string;
  svgClassName?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center bg-primary", tileClassName ?? "h-8 w-8 rounded-[7px]")}
    >
      <svg viewBox="0 0 24 24" className={svgClassName ?? "h-5 w-5"} aria-hidden>
        <path d={LOGO_M} style={{ fill: "var(--primary-foreground)" }} />
        <rect x="3" y="19.2" width="18" height="2.2" rx="1.1" style={{ fill: "var(--warm)" }} />
      </svg>
    </span>
  );
}
