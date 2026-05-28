import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/providers/theme-provider";
import { QueryProvider } from "@/providers/query-provider";
import { AppHeader } from "@/components/app-header";
import { CommandPalette } from "@/components/command-palette";

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
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <AppHeader />
            <main className="flex-1 flex flex-col">{children}</main>
            <CommandPalette />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
