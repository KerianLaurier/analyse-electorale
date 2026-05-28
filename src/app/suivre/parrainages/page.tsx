import { PagePlaceholder } from "@/components/page-placeholder";

export default function ParrainagesPage() {
  return (
    <PagePlaceholder
      module="Suivre"
      title="Parrainages présidentiels 2027"
      description="Suivi du flux open data du Conseil constitutionnel (mises à jour pluri-hebdomadaires entre janvier et mars 2027)."
      bullets={[
        "Compteur par candidat",
        "Cartographie des parrainages par département",
        "Historisation des évolutions hebdo",
      ]}
    />
  );
}
