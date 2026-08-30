import { PersonneFiche } from "@/components/personne-fiche";

// id = "{circo}" (député en exercice, légis. 2024 T2) ou "{scrutin}__{circo}".
export default async function EluPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const parts = decodeURIComponent(id).split("__");
  const [scrutin, circo] = parts.length >= 2 ? parts : ["legis-2024-t2", parts[0] ?? ""];
  return <PersonneFiche mode="elu" scrutin={scrutin} circo={circo} />;
}
