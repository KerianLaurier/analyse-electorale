import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/providers/theme-provider";
import { QueryProvider } from "@/providers/query-provider";
import { AppHeader } from "@/components/app-header";
import { SubscriptionBanner } from "@/components/subscription-banner";
import { CommandPalette } from "@/components/command-palette";
import { RouteProgress } from "@/components/route-progress";
import { Toaster } from "@/components/toaster";

// On charge explicitement les poids utilisés dans les maquettes v3 modern
// (300 light, 400 regular, 500 medium dominant, 600 semibold).
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  // 300 retiré (inutilisé) → un fichier de police de moins à charger.
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Analyse électorale",
  description:
    "Outil professionnel d'analyse politique et électorale — présidentielle et législatives 2027.",
  applicationName: "MOUVANCIA",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "MOUVANCIA" },
  formatDetection: { telephone: false },
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
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
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
