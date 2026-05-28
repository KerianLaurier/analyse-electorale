import { PagePlaceholder } from "@/components/page-placeholder";

export default function AgendaPage() {
  return (
    <PagePlaceholder
      module="Suivre"
      title="Agenda électoral"
      description="Décrets de convocation, dates limites de dépôt, période officielle de campagne, plafonds de dépenses."
      bullets={[
        "Présidentielle 2027 (1er tour 11 ou 18 avril)",
        "Législatives juin 2027 (à confirmer)",
        "Sénatoriales 27 septembre 2026",
        "Source : JORF / Légifrance",
      ]}
    />
  );
}
