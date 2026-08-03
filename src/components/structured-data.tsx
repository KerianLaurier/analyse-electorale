import { marketingUrl } from "@/lib/site-url";

/**
 * Données structurées schema.org (JSON-LD) de la vitrine.
 *
 * Rendues en <script type="application/ld+json"> dans la page, conformément à
 * la recommandation Next 16 (node_modules/next/dist/docs/01-app/02-guides/json-ld.md).
 *
 * ⚠️ `JSON.stringify` ne protège pas des injections XSS : on échappe `<` en
 * `<`, comme le prescrit ce guide. Toutes les valeurs sont ici statiques
 * ou issues de constantes du dépôt, mais l'échappement reste la ceinture de
 * sécurité si un jour le contenu devient dynamique.
 *
 * Volontairement PAS de `Offer` : les tarifs sont retirés pendant le
 * pré-lancement. Déclarer un prix absent de la page produirait des données
 * structurées en contradiction avec le contenu visible — ce que les moteurs
 * sanctionnent.
 */

const DESCRIPTION =
  "Plateforme d'analyse électorale et de pilotage de campagne : cartographie des résultats " +
  "du national au bureau de vote, sociologie INSEE, historique multi-scrutins et QG de terrain. " +
  "Données publiques officielles.";

export function StructuredData({ faq }: { faq: { q: string; a: string }[] }) {
  const base = marketingUrl();

  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${base}/#organization`,
        name: "MOUVANCIA",
        url: base,
        logo: `${base}/icon.svg`,
        description: DESCRIPTION,
        email: "contact@mouvancia.fr",
        areaServed: { "@type": "Country", name: "France" },
      },
      {
        "@type": "WebSite",
        "@id": `${base}/#website`,
        url: base,
        name: "MOUVANCIA",
        description: DESCRIPTION,
        inLanguage: "fr-FR",
        publisher: { "@id": `${base}/#organization` },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${base}/#software`,
        name: "MOUVANCIA",
        applicationCategory: "BusinessApplication",
        applicationSubCategory: "Analyse électorale",
        operatingSystem: "Web",
        url: base,
        description: DESCRIPTION,
        inLanguage: "fr-FR",
        publisher: { "@id": `${base}/#organization` },
      },
      {
        "@type": "FAQPage",
        "@id": `${base}/#faq`,
        // Reprend exactement la FAQ affichée : les données structurées doivent
        // refléter le contenu visible, sinon elles sont ignorées ou pénalisées.
        mainEntity: faq.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(graph).replace(/</g, "\\u003c"),
      }}
    />
  );
}
