import type { MetadataRoute } from "next";

// Web App Manifest (PWA). Sert /manifest.webmanifest, lié automatiquement par
// Next. Installation possible dès lors que le site est servi en HTTPS (Netlify).
export default function manifest(): MetadataRoute.Manifest {
  return {
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
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
