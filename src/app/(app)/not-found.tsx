import Link from "next/link";
import { Compass, ArrowLeft } from "lucide-react";

/**
 * Page 404 — déclenchée pour une URL inconnue ou via `notFound()`. Reste dans
 * le chrome applicatif (header global) ; propose un retour vers les surfaces
 * principales.
 */
export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <span aria-hidden className="grid h-12 w-12 place-items-center rounded-pill bg-surface-soft text-muted-foreground">
        <Compass className="h-6 w-6" />
      </span>
      <div>
        <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Erreur 404</p>
        <h1 className="mt-1 text-[22px] font-semibold tracking-tight">Page introuvable</h1>
        <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-muted-foreground">
          Cette adresse n&apos;existe pas ou n&apos;est plus disponible. Vérifiez le lien, ou repartez de
          l&apos;une des sections principales.
        </p>
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-pill bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Accueil
        </Link>
        <Link
          href="/explorer"
          className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-4 py-2 text-[13px] font-medium text-foreground/80 transition-colors hover:bg-surface-soft"
        >
          Explorer la carte
        </Link>
      </div>
    </div>
  );
}
