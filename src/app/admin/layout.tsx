import { Geist_Mono } from "next/font/google";

// Geist Mono ne sert que dans le back-office (clés techniques, champ mot de
// passe). Le charger ici plutôt que dans le layout racine évite de télécharger
// deux fichiers de police sur TOUTES les pages de l'application pour un usage
// réservé aux super-admins.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${geistMono.variable} contents`}>{children}</div>;
}
