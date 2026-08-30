import { redirect } from "next/navigation";
import { EspaceToday } from "@/app/(app)/espace/espace-today";
import { LEGACY_TAB_REDIRECTS } from "@/app/(app)/espace/routes";

/**
 * Tableau de bord du QG — « aujourd'hui ».
 *
 * Assure aussi la compatibilité des anciens liens `/espace?tab=…`, partagés
 * entre membres ou mis en favori du temps où le QG tenait en une seule route à
 * dix onglets.
 */
export default async function EspacePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  if (tab) {
    const target = LEGACY_TAB_REDIRECTS[tab];
    // Onglet inconnu : on nettoie simplement l'URL vers le tableau de bord.
    redirect(target ?? "/espace");
  }

  return <EspaceToday />;
}
