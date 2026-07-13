"use client";

import { RefreshCcw, WifiOff } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

// Page de secours hors-ligne, précachée par le service worker (public/sw.js)
// et servie quand une navigation échoue. Autonome : aucun appel de données,
// pas de chrome applicatif (cf. NO_CHROME dans app-header).
export default function OfflinePage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-canvas px-6 text-center">
      <div className="flex items-center gap-2.5">
        <BrandMark tileClassName="h-9 w-9 rounded-md" svgClassName="h-5.5 w-5.5" />
        <span className="text-[14px] font-semibold tracking-tight">MOUVANCIA</span>
      </div>

      <span className="mt-10 grid h-14 w-14 place-items-center rounded-full bg-warm/15 text-warm">
        <WifiOff className="h-7 w-7" />
      </span>
      <h1 className="mt-5 text-[24px] font-semibold tracking-tight">Vous êtes hors ligne</h1>
      <p className="mt-2 max-w-[44ch] text-[13.5px] leading-relaxed text-muted-foreground">
        Impossible de joindre le serveur. Les analyses déjà consultées restent disponibles
        dans le cache de l&apos;application — reconnectez-vous pour retrouver les données à jour.
      </p>

      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-7 inline-flex items-center gap-2 rounded-pill bg-primary px-5 py-2.5 text-[13.5px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        <RefreshCcw className="h-4 w-4" /> Réessayer
      </button>
    </div>
  );
}
