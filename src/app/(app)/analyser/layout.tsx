import type { Metadata } from "next";
import { Suspense } from "react";
import { AnalyserShell } from "@/app/(app)/analyser/analyser-shell";

export const metadata: Metadata = { title: "Analyser" };

/**
 * Coquille commune aux cinq lentilles : sélecteur de périmètre + onglets.
 * Un layout n'est pas re-rendu quand on navigue entre ses segments enfants —
 * le périmètre choisi survit donc au changement de lentille.
 */
export default function AnalyserLayout({ children }: { children: React.ReactNode }) {
  // Suspense requis : la coquille lit le périmètre dans l'URL (useSearchParams).
  return (
    <Suspense fallback={<div className="flex-1 bg-canvas" />}>
      <AnalyserShell>{children}</AnalyserShell>
    </Suspense>
  );
}
