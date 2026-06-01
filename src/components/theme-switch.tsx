"use client";

import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Clair", Icon: Sun },
  { value: "dark", label: "Sombre", Icon: Moon },
  { value: "system", label: "Auto", Icon: Monitor },
] as const;

/** Sélecteur de thème segmenté (clair / sombre / système). */
export function ThemeSwitch() {
  // next-themes renvoie `undefined` au SSR comme à la 1ʳᵉ hydratation (il lit
  // le storage dans son propre effet), puis met à jour → pas de mismatch ici.
  const { theme, setTheme } = useTheme();
  const current = theme ?? "system";

  return (
    <div
      role="radiogroup"
      aria-label="Thème de l'interface"
      className="flex items-center gap-0.5 rounded-md bg-foreground/[0.05] p-0.5"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = current === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1 text-[11.5px] font-medium transition-colors",
              active
                ? "bg-surface text-foreground shadow-card"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
