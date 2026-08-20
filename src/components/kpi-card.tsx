import { Card } from "@appica/ui-react/card";
import { cn } from "@/lib/utils";

/**
 * Carte d'indicateur clé (libellé + valeur + précision facultative), bâtie sur
 * la `Card` d'Appica UI. Style partagé par les vues Analyser. `accent` colore
 * la valeur : `positive` (vert), `negative`/`over` (rouge), `under` (bleu).
 */
export function KpiCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "positive" | "negative" | "over" | "under";
}) {
  return (
    <Card frame className="p-4 shadow-card">
      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p
        title={value}
        className={cn(
          "mt-1 truncate text-[24px] font-semibold leading-none tracking-tight tabular-nums",
          accent === "positive" && "text-success",
          (accent === "negative" || accent === "over") && "text-destructive",
          accent === "under" && "text-[color:#2563eb]",
        )}
      >
        {value}
      </p>
      {hint && <p title={hint} className="mt-1.5 truncate text-[11px] text-muted-foreground/80">{hint}</p>}
    </Card>
  );
}
