import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { circoHistoryOptions } from "@/lib/queries";
import { CircoFiche } from "./circo-fiche";

export default async function CirconscriptionPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  // Préfetch serveur du contenu principal (historique électoral) → HTML initial
  // avec contenu. Best-effort : pas de régression si le storage est indisponible.
  // Les bureaux (onglet stratégie) et les bornes carte restent côté client.
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery(circoHistoryOptions(code)).catch(() => {});

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CircoFiche code={code} />
    </HydrationBoundary>
  );
}
