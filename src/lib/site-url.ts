/**
 * URL de la vitrine (domaine racine), pour le SEO (robots.txt, sitemap.xml).
 *
 * En production, `NEXT_PUBLIC_APP_URL` pointe l'app (`https://app.mouvancia.fr`)
 * et la vitrine vit sur le domaine racine (`https://mouvancia.fr`, cf. le split
 * par sous-domaine dans src/proxy.ts). On dérive donc la vitrine en retirant le
 * sous-domaine `app.`. Hors production (local/preview, variable absente), on
 * retombe sur le domaine canonique.
 */
export function marketingUrl(): string {
  const app = process.env.NEXT_PUBLIC_APP_URL;
  if (app) return app.replace(/:\/\/app\./, "://").replace(/\/$/, "");
  return "https://mouvancia.fr";
}
