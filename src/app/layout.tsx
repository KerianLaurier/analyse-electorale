import type { Metadata } from "next";
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
        {/* Thème clair forcé : le mode sombre n'est pas encore finalisé (de
            nombreuses couleurs sont en dur). On évite ainsi un rendu cassé pour
            les utilisateurs dont l'OS est en sombre. Le dark mode propre pourra
            être réactivé via `enableSystem`/un sélecteur dans un sprint dédié. */}
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          forcedTheme="light"
          disableTransitionOnChange
        >
          <QueryProvider>
            <Suspense fallback={null}>
              <RouteProgress />
            </Suspense>
            <AppHeader />
            {/* pb-16 : dégagement pour la barre de navigation basse (mobile). */}
            <main className="flex-1 flex flex-col pb-16 lg:pb-0">{children}</main>
            <CommandPalette />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
