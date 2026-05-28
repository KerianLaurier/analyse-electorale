import { PagePlaceholder } from "@/components/page-placeholder";

export default function SoireePage() {
  return (
    <PagePlaceholder
      module="Suivre"
      title="Mode soirée électorale"
      description="Ingestion du flux temps réel resultats.interieur.gouv.fr, refresh auto, layout full-screen."
      bullets={[
        "Carte de France live au fil du dépouillement",
        "Détection d'anomalies (participation, écarts à l'historique)",
        "Mode focus (touche F) pour présentation et screenshots",
      ]}
    />
  );
}
