import type { MetadataRoute } from "next";
import { marketingUrl } from "@/lib/site-url";

/**
 * Plan de site : uniquement les pages publiques indexables (vitrine + légal).
 * Les écrans d'authentification et l'espace applicatif en sont exclus (privés).
 * Servi publiquement (cf. PUBLIC_PATHS dans src/proxy.ts).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = marketingUrl();
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/mentions-legales`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/confidentialite`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/cgu`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
