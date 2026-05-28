import { PagePlaceholder } from "@/components/page-placeholder";

export default function MarginalitePage() {
  return (
    <PagePlaceholder
      module="Analyser"
      title="Carte des sièges marginaux"
      description="Identifier les circonscriptions législatives les plus disputées selon le score de marginalité."
      bullets={[
        "Calcul de l'écart T2 (ou comparable) par circo",
        "Filtres par bloc politique, région, marge cible",
        "Export ciblage stratégique",
      ]}
    />
  );
}
