"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { ErrorState } from "@/components/error-state";

/**
 * Boundary d'erreur de segment (App Router). Capture les exceptions de rendu
 * d'une page ; `reset()` retente le rendu du segment. Réutilise `ErrorState`.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Remontée Sentry (no-op sans DSN) + trace console pour le diagnostic local.
    Sentry.captureException(error);
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24">
      <ErrorState
        message="Cette page n'a pas pu s'afficher."
        onRetry={reset}
        className="max-w-md"
      />
      <Link href="/" className="text-[12.5px] text-muted-foreground underline-offset-2 hover:underline">
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
