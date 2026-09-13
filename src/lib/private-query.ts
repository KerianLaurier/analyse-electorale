"use client";

import {
  useQuery,
  type QueryKey,
  type QueryFilters,
} from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import {
  currentIdentity,
  identityRevision,
  onIdentityChange,
} from "@/lib/identity";
import { getQueryClient } from "@/providers/query-provider";

function scope() {
  const identity = currentIdentity();
  return [
    "private",
    identityRevision(),
    identity?.userId ?? null,
    identity?.teamId ?? null,
  ] as const;
}

let wired = false;
function wire() {
  if (wired || typeof window === "undefined") return;
  wired = true;
  onIdentityChange(() => {
    const client = getQueryClient();
    // L'invalidation seule garde les anciennes données pendant le refetch.
    void client.cancelQueries({ queryKey: ["private"] });
    client.removeQueries({ queryKey: ["private"] });
  });
}

/** Capturer ce client AVANT la requête : une réponse tardive devient sans effet. */
export function getPrivateQueryClient() {
  wire();
  const client = getQueryClient();
  const captured = scope();
  const valid = () => captured.every((value, i) => value === scope()[i]);
  const key = (queryKey: QueryKey) => [...captured, ...queryKey];
  const filters = (input: QueryFilters = {}) => ({
    ...input,
    queryKey: key(input.queryKey ?? []),
  });
  return {
    getQueryData<T>(queryKey: QueryKey): T | undefined {
      return valid() ? client.getQueryData<T>(key(queryKey)) : undefined;
    },
    setQueryData<T>(
      queryKey: QueryKey,
      value: T | undefined | ((old: T | undefined) => T | undefined),
    ) {
      if (valid()) return client.setQueryData<T>(key(queryKey), value);
    },
    cancelQueries(input?: QueryFilters) {
      return valid() ? client.cancelQueries(filters(input)) : Promise.resolve();
    },
    invalidateQueries(input?: QueryFilters) {
      return valid()
        ? client.invalidateQueries(filters(input))
        : Promise.resolve();
    },
    refetchQueries(input?: QueryFilters) {
      return valid()
        ? client.refetchQueries(filters(input))
        : Promise.resolve();
    },
  };
}

export function usePrivateQuery<T>(options: {
  queryKey: QueryKey;
  queryFn: () => Promise<T>;
  staleTime?: number;
}) {
  wire();
  useSyncExternalStore(
    onIdentityChange,
    () =>
      `${identityRevision()}:${currentIdentity()?.userId ?? ""}:${currentIdentity()?.teamId ?? ""}`,
    () => "server",
  );
  return useQuery({
    ...options,
    queryKey: [...scope(), ...options.queryKey],
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  });
}
