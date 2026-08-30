import { redirect } from "next/navigation";
import { circoShortLabel } from "@/lib/territoire";
import { CiblageLens } from "@/app/(app)/analyser/ciblage/ciblage-lens";

export default async function CiblagePage({
  searchParams,
}: {
  searchParams: Promise<{ circo?: string; t?: string }>;
}) {
  const { circo, t } = await searchParams;
  // Ancien lien profond `/analyser/ciblage?circo=1502` : la circonscription
  // était propre à cet écran, elle devient le périmètre partagé d'Analyser.
  if (circo && !t) {
    const q = new URLSearchParams({ t: "circo", c: circo, l: circoShortLabel(circo) });
    redirect(`/analyser/ciblage?${q.toString()}`);
  }
  return <CiblageLens />;
}
