import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import {
  communeHistoryOptions,
  communeCircoMapOptions,
  sociologieCommuneOptions,
  demographieCommuneOptions,
} from "@/lib/queries";
import { CommuneFiche } from "./commune-fiche";

export default async function CommunePage({
  params,
}: {
  params: Promise<{ insee: string }>;
}) {
  const { insee } = await params;

  // Préfetch serveur des données de la fiche (JSON figés servis depuis le CDN) →
  // HTML initial avec contenu, pas de re-fetch client. Best-effort : si le
  // storage est indisponible (ex. dev sans NEXT_PUBLIC_DATA_URL), on n'échoue
  // pas — les queries en échec ne sont pas déshydratées et le client fetchera
  // comme avant. Pattern reproductible aux autres fiches une fois validé.
  const queryClient = new QueryClient();
  await Promise.allSettled([
    queryClient.prefetchQuery(communeHistoryOptions(insee)),
    queryClient.prefetchQuery(sociologieCommuneOptions(insee)),
    queryClient.prefetchQuery(demographieCommuneOptions(insee)),
    queryClient.prefetchQuery(communeCircoMapOptions()),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CommuneFiche insee={insee} />
    </HydrationBoundary>
  );
}
