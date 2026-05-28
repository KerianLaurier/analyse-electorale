import { PagePlaceholder } from "@/components/page-placeholder";

export default async function CommunePage({
  params,
}: {
  params: Promise<{ insee: string }>;
}) {
  const { insee } = await params;
  return (
    <PagePlaceholder
      module="Fiche territoire"
      title={`Commune INSEE ${insee}`}
      description="Vue complète d'une commune : résultats par bureau, sociologie, élus municipaux."
      bullets={[
        "Résultats détaillés bureau de vote par bureau de vote",
        "Recherche d'adresse → bureau (BAN)",
        "Comparaison à la moyenne nationale et départementale",
      ]}
    />
  );
}
