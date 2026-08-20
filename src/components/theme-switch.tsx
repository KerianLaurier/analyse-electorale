"use client";

import { useTheme } from "@appica/ui-react/hooks/use-theme";
import { ToggleGroup } from "@appica/ui-react/toggle-group";
import { Toggle } from "@appica/ui-react/toggle";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Clair", Icon: Sun },
  { value: "dark", label: "Sombre", Icon: Moon },
  { value: "system", label: "Auto", Icon: Monitor },
] as const;

/**
 * Sélecteur de thème segmenté (clair / sombre / système), bâti sur le
 * `ToggleGroup` d'Appica UI : navigation clavier, `aria-pressed` et gestion du
 * groupe fournis par le composant — on ne peint que l'état actif.
 */
export function ThemeSwitch() {
  // `mounted` reste faux jusqu'au montage client : avant, `theme` vaut
  // `undefined` (le choix vit dans le storage). On rend donc « Auto » actif au
  // premier passage plutôt que de risquer un écart d'hydratation.
  const { theme, setTheme, mounted } = useTheme();
  const current = mounted ? (theme ?? "system") : "system";

  return (
    <ToggleGroup
      value={[current]}
      onValueChange={(groupValue) => {
        const next = groupValue[0];
        // Le groupe autorise la désélection : on ignore le clic sur l'option
        // déjà active plutôt que de retomber sur un thème vide.
        if (next) setTheme(next);
      }}
      aria-label="Thème de l'interface"
      className="flex items-center gap-0.5 rounded-md bg-foreground/[0.05] p-0.5"
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <Toggle
          key={value}
          value={value}
          className={cn(
            "inline-flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1 text-[11.5px] font-medium transition-colors",
            "text-muted-foreground hover:text-foreground",
            "data-[pressed]:bg-surface data-[pressed]:text-foreground data-[pressed]:shadow-card",
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
