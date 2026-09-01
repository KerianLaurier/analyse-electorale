import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "../globals.css";
import { ThemeProvider } from "@/providers/theme-provider";
import { AnalyticsConsent } from "@/components/analytics-consent";

/**
 * Layout racine de la VITRINE (landing publique + pages légales).
 *
 * L'application a le sien — `src/app/(app)/layout.tsx` — et il n'y a
 * volontairement **pas** de `src/app/layout.tsx` : deux layouts racines, un par
 * groupe de routes (cf. « multiple root layouts » dans la doc App Router). Les
 * groupes n'apparaissent pas dans les URL, `/` et `/cgu` restent inchangés.
 *
 * Pourquoi cette séparation : le chrome applicatif (en-tête, palette ⌘K,
 * TanStack Query, supabase-js, bandeau d'abonnement, PWA) est composé de
 * composants clients. Tant qu'il vivait dans un layout commun, la vitrine
 * téléchargeait et hydratait ce JavaScript pour n'en afficher aucun pixel —
 * `AppHeader` renvoie `null` sur `/`. Mesuré sur un build de production :
 * 502 kB gz de JS sur la landing, 328 kB une fois les deux arbres séparés.
 *
 * Conséquence assumée : passer de la vitrine à l'app provoque un chargement
 * complet de page. Sans effet ici — c'est déjà une frontière de sous-domaine en
 * production (`mouvancia.fr` → `app.mouvancia.fr`, cf. `src/proxy.ts`).
 */

// URL de la vitrine (domaine racine) pour les URL absolues des images sociales.
// En prod, NEXT_PUBLIC_APP_URL pointe l'app (app.mouvancia.fr) ; la vitrine vit
// sur le domaine racine → on retire le sous-domaine `app.`.
const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/:\/\/app\./, "://").replace(/\/$/, "") ??
  "https://mouvancia.fr";

const OG_TITLE = "MOUVANCIA — L'intelligence électorale, du national au bureau de vote";
// Pré-lancement : plus de promesse d'essai gratuit (les tarifs sont retirés de
// la landing). La description reste factuelle sur le périmètre du produit.
const OG_DESC =
  "Analyse électorale et pilotage de campagne, réunis : cartographie, sociologie, prédictif et QG de terrain. Données publiques officielles. Ouverture prochaine.";

// Fonte applicative : les tokens de `globals.css` s'appuient sur
// `--font-geist-sans`. La landing superpose ses propres fontes éditoriales
// (Archivo / Public Sans), déclarées au niveau de la page.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  // Base absolue pour les URL d'images sociales (og:image / twitter:image),
  // générées par app/opengraph-image.tsx et app/twitter-image.tsx.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "MOUVANCIA — Analyse électorale et pilotage de campagne",
    template: "%s · MOUVANCIA",
  },
  description:
    "Plateforme d'analyse électorale et de pilotage de campagne : résultats du national au bureau de vote, sociologie INSEE, historique multi-scrutins et QG de terrain. Présidentielle et législatives 2027.",
  // Canonique sur le domaine racine : la vitrine et l'app cohabitent sur deux
  // sous-domaines (cf. src/proxy.ts), il ne faut pas les faire concourir.
  alternates: { canonical: "/" },
  applicationName: "MOUVANCIA",
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    siteName: "MOUVANCIA",
    locale: "fr_FR",
    title: OG_TITLE,
    description: OG_DESC,
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: OG_DESC,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f3ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0c" },
  ],
  viewportFit: "cover",
};

export default function VitrineLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Seul composant client de la vitrine : le thème. Il porte le script
            anti-flash et respecte `prefers-color-scheme`, comme sur l'app —
            un visiteur en préférence sombre doit voir la landing en sombre. */}
        <ThemeProvider defaultTheme="light" enableSystem disableTransitionOnChange>
          <main className="flex-1 flex flex-col">{children}</main>
          {/* GA4 derrière consentement explicite — no-op sans NEXT_PUBLIC_GA_ID. */}
          <AnalyticsConsent />
        </ThemeProvider>
      </body>
    </html>
  );
}
