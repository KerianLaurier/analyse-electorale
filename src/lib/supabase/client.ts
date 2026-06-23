"use client";

import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

/**
 * Client Supabase côté navigateur (auth gérée via cookies).
 *
 * Deux garde-fous indispensables ici :
 *
 * 1. Instance unique (singleton). Chaque `createBrowserClient` instancie un
 *    `GoTrueClient`. L'app en appelle beaucoup (header + stores pins, tâches,
 *    créneaux, contacts, notes, notifications…). Un seul client suffit.
 *
 * 2. Verrou d'auth neutralisé. Par défaut supabase-js sérialise les opérations
 *    d'auth via `navigator.locks`. Avec de nombreux appels concurrents au
 *    chargement d'une page, ce verrou entre en contention et `getSession()`
 *    peut ne jamais se résoudre — gelant TOUTES les requêtes client
 *    (`.from()`, `.rpc()`…), si bien que plus aucune donnée ne se charge ni ne
 *    s'enregistre. On remplace le verrou par un passe-plat (un seul onglet :
 *    pas de coordination inter-onglets nécessaire).
 */
const passthroughLock = <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => fn();

function build() {
  return createBrowserClient(
    env.SUPABASE_URL,
    env.SUPABASE_ANON_KEY,
    { auth: { lock: passthroughLock } },
  );
}

let client: ReturnType<typeof build> | undefined;

export function createClient() {
  return (client ??= build());
}
