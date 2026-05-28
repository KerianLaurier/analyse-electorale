import { PagePlaceholder } from "@/components/page-placeholder";

export default function SimulateurPage() {
  return (
    <PagePlaceholder
      module="Analyser"
      title="Simulateur législatif"
      description="Entrer un score national par bloc → projection siège par siège (swing uniforme + correctifs régionaux)."
      bullets={[
        "Définir les hypothèses de score par bloc politique",
        "Projection circonscription par circonscription",
        "Comparaison à 2022 / 2024",
        "Export du tableau des sièges",
      ]}
    />
  );
}
