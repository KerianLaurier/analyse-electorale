import { PagePlaceholder } from "@/components/page-placeholder";

export default async function EluPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <PagePlaceholder
      module="Fiche personne"
      title={`Élu ${id}`}
      description="Profil élu : mandats RNE, activité parlementaire (NosDéputés/NosSénateurs), HATVP."
      bullets={[
        "Mandats actifs et passés (RNE)",
        "Votes, présence, amendements, questions au gouvernement",
        "Déclarations HATVP",
      ]}
    />
  );
}
