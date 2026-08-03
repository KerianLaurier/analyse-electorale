import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/providers/theme-provider";
import { QueryProvider } from "@/providers/query-provider";
import { AppHeader } from "@/components/app-header";
import { SubscriptionBanner } from "@/components/subscription-banner";
import { CommandPalette } from "@/components/command-palette";
import { RouteProgress } from "@/components/route-progress";
import { Toaster } from "@/components/toaster";
import { Pwa } from "@/components/pwa";

// URL de la vitrine (domaine racine) pour les URL absolues des images sociales.
// En prod, NEXT_PUBLIC_APP_URL pointe l'app (app.mouvancia.fr) ; la vitrine vit
// sur le domaine racine → on retire le sous-domaine `app.`.
const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/:\/\/app\./, "://").replace(/\/$/, "") ??
  "https://mouvancia.fr";

// Origine de l'object store / de Supabase, pour la préconnexion (cf. <head>).
// Les deux variables pointent le même hôte en production ; on garde un repli sur
// l'URL Supabase si l'object store n'est pas configuré (dev, aperçus).
//
// Déclaration de fonction (hissée) plutôt qu'IIFE en portée module : Turbopack
// élimine le binding d'une IIFE dont l'unique entrée est une variable
// NEXT_PUBLIC_* inlinée, et le rendu échoue alors sur un ReferenceError.
function dataOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_DATA_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

const OG_TITLE = "MOUVANCIA — L'intelligence électorale, du national au bureau de vote";
// Pré-lancement : plus de promesse d'essai gratuit (les tarifs sont retirés de
// la landing). La description reste factuelle sur le périmètre du produit.
const OG_DESC =
  "Analyse électorale et pilotage de campagne, réunis : cartographie, sociologie, prédictif et QG de terrain. Données publiques officielles. Ouverture prochaine.";

// On charge explicitement les poids utilisés dans les maquettes v3 modern
// (300 light, 400 regular, 500 medium dominant, 600 semibold).
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  // 300 retiré (inutilisé) → un fichier de police de moins à charger.
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Geist Mono n'est plus chargé ici : il ne sert que dans /admin et vit donc
// dans src/app/admin/layout.tsx (deux fichiers de police en moins sur toutes
// les autres pages). Le token --font-mono retombe sur la pile système ailleurs.

export const metadata: Metadata = {
  // Base absolue pour les URL d'images sociales (og:image / twitter:image),
  // générées par app/opengraph-image.tsx et app/twitter-image.tsx.
  metadataBase: new URL(SITE_URL),
  // `default` sert de titre à la vitrine ; `template` suffixe la marque aux
  // pages qui définissent leur propre titre (légal, app) — sans le dupliquer.
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
  appleWebApp: { capable: true, statusBarStyle: "default", title: "MOUVANCIA" },
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
  // Barre système accordée au thème (approximation media : le choix manuel
  // clair/sombre de next-themes ne peut pas être reflété ici côté serveur).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f3ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0c" },
  ],
  // Confort mobile : occupe la zone sûre (encoches), zoom utilisateur permis.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const origin = dataOrigin();
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Résolution anticipée des connexions externes (gros gain de latence
            sur mobile) : fond de carte, tuiles bureaux, glyphes. Le WASM DuckDB
            est self-hosté (cf. scripts/copy-duckdb.mjs) → plus de CDN tiers.
            Rendus dans l'arbre : React 19 les hisse dans <head>. */}
        <link rel="preconnect" href="https://a.basemaps.cartocdn.com" />
        <link rel="dns-prefetch" href="https://b.basemaps.cartocdn.com" />
        <link rel="dns-prefetch" href="https://c.basemaps.cartocdn.com" />
        <link rel="dns-prefetch" href="https://d.basemaps.cartocdn.com" />
        <link rel="dns-prefetch" href="https://object.files.data.gouv.fr" />
        <link rel="dns-prefetch" href="https://demotiles.maplibre.org" />
        {/* Origine Supabase : elle sert TOUTES les données (choroplèthes, tuiles,
            détails) ET l'authentification. C'était la seule origine critique sans
            préconnexion — on économise DNS + TCP + TLS avant la première requête. */}
        {origin && <link rel="preconnect" href={origin} crossOrigin="" />}
        {/* Thème : clair par défaut, sombre disponible via le sélecteur du menu
            profil (next-themes pose `.dark` sur <html>). `enableSystem` permet
            l'option « Système ». Toutes les surfaces/bordures passent par des
            tokens CSS (cf. globals.css → :root / .dark). */}
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <Suspense fallback={null}>
              <RouteProgress />
            </Suspense>
            <AppHeader />
            {/* Parcours d'abonnement : essai en cours / résiliation programmée. */}
            <SubscriptionBanner />
            {/* Couche PWA : service worker (prod) + capture de l'invite d'installation. */}
            <Pwa />
            {/* pb réservé à la nav basse mobile (--bottom-nav = 0 en desktop). */}
            <main className="flex-1 flex flex-col pb-[var(--bottom-nav)]">{children}</main>
            <CommandPalette />
            <Toaster />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
