import { PersonneFiche } from "@/components/personne-fiche";

// id = "{scrutin}__{circo}__{slug}" — ex. "legis-2024-t1__2602__pollet"
export default async function CandidatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [scrutin = "", circo = "", slug = ""] = decodeURIComponent(id).split("__");
  return <PersonneFiche mode="candidat" scrutin={scrutin} circo={circo} slug={slug} />;
}
