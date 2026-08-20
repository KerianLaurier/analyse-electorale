"use client";

import { ThemeProvider as AppicaThemeProvider } from "@appica/ui-react/providers/theme-provider";
import type { ComponentProps, ReactNode } from "react";

/**
 * Thème clair/sombre — fourni par Appica UI (appica.dev).
 *
 * Remplace `next-themes` : même contrat (choix persisté sous la clé `theme`,
 * classe `light`/`dark` posée sur `<html>`, résolution de `system` via
 * `prefers-color-scheme`, script anti-flash injecté avant l'hydratation), mais
 * c'est la source de vérité que consomment les composants Appica eux-mêmes —
 * garder deux providers de thème concurrents les aurait désynchronisés.
 *
 * Différence à connaître : plus de prop `attribute`, la classe est le seul
 * mécanisme (c'est ce que la variante `dark` de Tailwind attend ici, cf.
 * `@custom-variant dark` dans globals.css). `useTheme` expose en plus
 * `mounted`, à utiliser pour garder toute UI dépendante du thème neutre au
 * premier rendu.
 */
export function ThemeProvider({
  children,
  ...props
}: { children: ReactNode } & ComponentProps<typeof AppicaThemeProvider>) {
  return <AppicaThemeProvider {...props}>{children}</AppicaThemeProvider>;
}
