import type { MetadataRoute } from "next";
import { marketingUrl } from "@/lib/site-url";

/**
 * robots.txt : la vitrine (landing + pages légales) est indexable ; l'espace
 * applicatif et les écrans d'authentification ne le sont pas (contenu privé /
 * derrière connexion). Servi publiquement (cf. PUBLIC_PATHS dans src/proxy.ts).
 */
export default function robots(): MetadataRoute.Robots {
  const base = marketingUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/explorer",
        "/analyser",
        "/suivre",
        "/espace",
        "/admin",
        "/circo",
        "/commune",
        "/bureau",
        "/candidat",
        "/elu",
        "/bienvenue",
        "/auth",
        "/api",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
