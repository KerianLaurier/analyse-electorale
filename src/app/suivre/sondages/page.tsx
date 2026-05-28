import { PagePlaceholder } from "@/components/page-placeholder";

export default function SondagesPage() {
  return (
    <PagePlaceholder
      module="Suivre"
      title="Agrégateur de sondages"
      description="Synthèse des intentions de vote présidentielles et législatives 2027, via Nsppolls."
      bullets={[
        "Courbes par candidat / par hypothèse avec intervalle de confiance",
        "Tableau de bord des intentions législatives par bloc",
        "Métadonnées des instituts (commanditaire, méthode, échantillon)",
      ]}
    />
  );
}
