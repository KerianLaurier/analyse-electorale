import { PagePlaceholder } from "@/components/page-placeholder";

export default async function CirconscriptionPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return (
    <PagePlaceholder
      module="Fiche territoire"
      title={`Circonscription ${code}`}
      description="Vue complète d'une circonscription législative : historique, sociologie, marginalité, élus."
      bullets={[
        "Historique des scrutins (2002 → aujourd'hui)",
        "Sociologie INSEE (revenu médian, CSP, âge médian)",
        "Score de marginalité et projection 2027",
        "Députés successifs, votes, présence",
      ]}
    />
  );
}
