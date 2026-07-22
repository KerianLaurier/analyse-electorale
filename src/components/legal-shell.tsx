import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

/**
 * Gabarit partagé des pages légales (mentions légales, confidentialité, CGU).
 * Public, sans chrome applicatif (cf. NO_CHROME dans app-header + PUBLIC_PATHS
 * dans proxy). Typographie volontairement sobre et à fort contraste (texte en
 * `foreground`, pas d'accent ambre sur fond clair).
 */
export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-canvas">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
            <BrandMark tileClassName="h-7 w-7 rounded-md" svgClassName="h-4 w-4" />
            <span className="text-[13px] font-semibold tracking-tight">MOUVANCIA</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-[12.5px] font-medium text-foreground/70 hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Accueil
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight sm:text-[32px]">{title}</h1>
        <p className="mt-2 text-[12.5px] text-muted-foreground">Dernière mise à jour : {updated}</p>
        <div className="legal-prose mt-8">{children}</div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-5 text-[12px] text-muted-foreground sm:px-8">
          <Link href="/mentions-legales" className="hover:text-foreground hover:underline">Mentions légales</Link>
          <span aria-hidden className="text-border">·</span>
          <Link href="/confidentialite" className="hover:text-foreground hover:underline">Confidentialité</Link>
          <span aria-hidden className="text-border">·</span>
          <Link href="/cgu" className="hover:text-foreground hover:underline">CGU</Link>
          <span className="ml-auto">© 2026 MOUVANCIA</span>
        </div>
      </footer>
    </div>
  );
}

/**
 * Emplacement à compléter avant mise en ligne (données propres à l'éditeur ou
 * points à faire valider juridiquement). Style à fort contraste (texte sombre
 * sur fond clair) pour être repéré sans ambiguïté.
 */
export function Todo({ children }: { children: React.ReactNode }) {
  return (
    <mark className="rounded bg-amber-100 px-1 py-0.5 font-medium text-amber-900">
      [à compléter&nbsp;: {children}]
    </mark>
  );
}
