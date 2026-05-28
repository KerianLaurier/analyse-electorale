import { PagePlaceholder } from "@/components/page-placeholder";

export default async function CandidatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <PagePlaceholder
      module="Fiche personne"
      title={`Candidat ${id}`}
      description="Profil candidat : parrainages, intentions de vote, comptes de campagne, HATVP."
      bullets={[
        "Compteur de parrainages (Conseil constitutionnel)",
        "Agrégat sondages avec intervalle de confiance",
        "Comptes de campagne CNCCFP (historique)",
        "Déclarations d'intérêts et de patrimoine HATVP",
      ]}
    />
  );
}
