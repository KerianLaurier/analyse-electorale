"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * Filet racine : capture les erreurs survenant dans le layout lui-même. Remplace
 * tout le document, doit donc rendre ses propres `<html>`/`<body>`. Volontairement
 * autonome (pas de provider/theme) et minimal.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="fr">
      <body className="min-h-screen antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="text-[22px] font-semibold tracking-tight">Une erreur est survenue</h1>
          <p className="max-w-md text-[13.5px] leading-relaxed text-muted-foreground">
            L&apos;application a rencontré un problème inattendu. Vous pouvez recharger la page ; si le
            problème persiste, réessayez un peu plus tard.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-1 inline-flex items-center rounded-pill bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Recharger
          </button>
        </div>
      </body>
    </html>
  );
}
