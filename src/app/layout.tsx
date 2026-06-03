import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/providers/theme-provider";
import { QueryProvider } from "@/providers/query-provider";
import { AppHeader } from "@/components/app-header";
import { CommandPalette } from "@/components/command-palette";
import { RouteProgress } from "@/components/route-progress";

// On charge explicitement les poids utilisés dans les maquettes v3 modern
// (300 light, 400 regular, 500 medium dominant, 600 semibold).
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
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
  themeColor: "#f4f3ef",
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
            <main className="flex-1 flex flex-col">{children}</main>
            <CommandPalette />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
