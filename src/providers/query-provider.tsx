"use client";

import {
  QueryClient,
  QueryClientProvider,
  isServer,
} from "@tanstack/react-query";
import { type ReactNode } from "react";

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        refetchOnWindowFocus: false,
      },
    },
  });
}

let browserClient: QueryClient | undefined;

/**
 * QueryClient partagé.
 *
 * - Navigateur : singleton. Indispensable pour que les fonctions impératives
 *   hors-React (ex. `togglePin`, `setPinScope`) accèdent au MÊME cache que les
 *   hooks `useQuery` rendus dans l'arbre.
 * - Serveur : une instance neuve à chaque appel (pas de fuite de cache entre
 *   requêtes). Les stores ne tournent de toute façon que côté navigateur.
 */
export function getQueryClient(): QueryClient {
  if (isServer) return makeClient();
  return (browserClient ??= makeClient());
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const client = getQueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
