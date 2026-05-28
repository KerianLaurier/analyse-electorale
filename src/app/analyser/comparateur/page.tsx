import { PagePlaceholder } from "@/components/page-placeholder";

export default function ComparateurPage() {
  return (
    <PagePlaceholder
      module="Analyser"
      title="Comparateur de scrutins"
      description="Superposer plusieurs élections sur un même territoire pour identifier les bascules."
      bullets={[
        "Sélection multi-élections (présidentielle, législatives, européennes, régionales)",
        "Affichage côte-à-côte ou en différentiel",
        "Export PDF / CSV",
      ]}
    />
  );
}
