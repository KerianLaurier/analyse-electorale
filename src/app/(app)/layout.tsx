import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist } from "next/font/google";
import "../globals.css";
import { ThemeProvider } from "@/providers/theme-provider";
import { QueryProvider } from "@/providers/query-provider";
import { AppHeader } from "@/components/app-header";
import { SubscriptionBanner } from "@/components/subscription-banner";
import { CommandPalette } from "@/components/command-palette";
import { RouteProgress } from "@/components/route-progress";
import { Toaster } from "@/components/toaster";
import { Pwa } from "@/components/pwa";

/**
 * Layout racine de l'APPLICATION (groupe de routes `(app)`).
 *
 * Jumeau de `src/app/(vitrine)/layout.tsx` : il n'y a pas de `src/app/layout.tsx`,
 * chaque groupe porte son propre `<html>`/`<body>` (« multiple root layouts »).
 * Les groupes n'apparaissent pas dans les URL — `/explorer`, `/espace`,
 * `/auth/login`… sont inchangés.
 *
 * C'est ici, et nulle part ailleurs, que vit le chrome applicatif : en-tête,
 * palette ⌘K, cache de requêtes, bandeau d'abonnement, service worker, toasts.
 * Le sortir du tronc commun évite à la vitrine de télécharger supabase-js,
 * cmdk et TanStack Query pour ne rien en afficher.
 */

// URL de la vitrine (domaine racine) pour les URL absolues des images sociales.
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

// On charge explicitement les poids utilisés dans les maquettes v3 modern
// (400 regular, 500 medium dominant, 600 semibold, 700 bold).
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  // 300 retiré (inutilisé) → un fichier de police de moins à charger.
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Geist Mono n'est plus chargé ici : il ne sert que dans /admin et vit donc
// dans src/app/(app)/admin/layout.tsx (deux fichiers de police en moins sur
// toutes les autres pages). Le token --font-mono retombe sur la pile système.

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // Pas de `default` ici : chaque écran applicatif définit son titre, suffixé
  // par la marque. Le repli sert les rares pages qui n'en déclarent pas.
  title: {
    default: "MOUVANCIA",
    template: "%s · MOUVANCIA",
  },
  applicationName: "MOUVANCIA",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "MOUVANCIA" },
  formatDetection: { telephone: false },
  // L'application n'a pas vocation à être indexée : elle est derrière un compte
  // et le référencement est porté par la vitrine.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  // Barre système accordée au thème (approximation media : le choix manuel
  // clair/sombre d'Appica UI ne peut pas être reflété ici côté serveur).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f3ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0c" },
  ],
  // Confort mobile : occupe la zone sûre (encoches), zoom utilisateur permis.
  viewportFit: "cover",
};

export default function AppLayout({
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
            sur mobile) : tuiles des bureaux de vote + glyphes de la carte. Ces
            indices ne concernent que l'app — les déclarer ici plutôt que dans un
            tronc commun évite d'ouvrir des connexions inutiles depuis la vitrine.
            Rendus dans l'arbre : React 19 les hisse dans <head>. */}
        <link rel="dns-prefetch" href="https://object.files.data.gouv.fr" />
        {/* Glyphes des labels de villes (police Noto Sans du style de carte). */}
        <link rel="preconnect" href="https://protomaps.github.io" crossOrigin="" />
        {/* Origine Supabase : elle sert TOUTES les données (choroplèthes, tuiles,
            détails) ET l'authentification. On économise DNS + TCP + TLS avant la
            première requête. */}
        {origin && <link rel="preconnect" href={origin} crossOrigin="" />}
        {/* Thème : clair par défaut, sombre via le sélecteur du menu profil
            (le ThemeProvider Appica pose `.dark` sur <html>). `enableSystem`
            permet l'option « Système ». */}
        <ThemeProvider defaultTheme="light" enableSystem disableTransitionOnChange>
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
