import type { MetadataRoute } from "next";

// Web App Manifest (PWA). Sert /manifest.webmanifest, lié automatiquement par
// Next. Icônes PNG générées par scripts/pipeline/build-icons.mjs (la maskable
// garde ~22 % de marge de sûreté) ; le SVG reste en source haute-fidélité.
// L'app shell hors-ligne vit dans public/sw.js (cf. src/components/pwa.tsx).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "MOUVANCIA — Analyse électorale",
    short_name: "MOUVANCIA",
    description:
      "Outil professionnel d'analyse politique et électorale — présidentielle et législatives 2027.",
    start_url: "/espace",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    lang: "fr",
    dir: "ltr",
    background_color: "#f4f3ef",
    theme_color: "#f4f3ef",
    categories: ["politics", "business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    // Accès rapides (appui long sur l'icône installée).
    shortcuts: [
      {
        name: "Explorer la carte",
        url: "/explorer",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Suivre — briefing du jour",
        url: "/suivre",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Mon QG de campagne",
        url: "/espace",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
    // Captures montrées dans l'interface d'installation (Chrome/Android).
    screenshots: [
      {
        src: "/screenshots/explorer-wide.png",
        sizes: "1280x800",
        type: "image/png",
        form_factor: "wide",
        label: "Carte électorale interactive, du national au bureau de vote",
      },
      {
        src: "/screenshots/suivre-narrow.png",
        sizes: "390x844",
        type: "image/png",
        form_factor: "narrow",
        label: "Briefing quotidien : sondages, Assemblée, agenda 2027",
      },
    ],
  };
}
