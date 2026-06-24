import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { bureauHistoryOptions, sociologieBureauOptions } from "@/lib/queries";
import { BureauFiche } from "./bureau-fiche";

export default async function BureauPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  // Préfetch serveur des données de la fiche (historique + socio) → HTML initial
  // avec contenu. Best-effort : pas de régression si le storage est indisponible.
  const queryClient = new QueryClient();
  await Promise.allSettled([
    queryClient.prefetchQuery(bureauHistoryOptions(code)),
    queryClient.prefetchQuery(sociologieBureauOptions(code)),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <BureauFiche code={code} />
    </HydrationBoundary>
  );
}
