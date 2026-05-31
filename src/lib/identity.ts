"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Identité partagée de l'utilisateur courant (id, équipe, droits).
 *
 * POURQUOI CE MODULE — performance. Auparavant, chaque store (tâches, notes,
 * créneaux, contacts, pins, campagne, porte-à-porte) ET le header résolvaient
 * l'utilisateur indépendamment : `auth.getUser()` (un round-trip réseau qui
 * revalide le JWT) + une requête `profiles` pour l'équipe. Sur une page comme
 * le QG, ~8 stores + le header → ~9 `getUser` réseau + 8 `profiles`, multipliés
 * à chaque évènement d'auth. Le navigateur plafonnant à ~6 requêtes concurrentes
 * par hôte, ces centaines d'appels se sérialisent et retardent l'affichage des
 * données de plusieurs secondes.
 *
 * Ici on résout l'identité UNE fois (promesse mise en cache, partagée par tous
 * les appelants) et on n'écoute qu'UN seul `onAuthStateChange`. Les stores
 * appellent `getIdentity()` (instantané une fois résolu) au lieu de refaire
 * leur propre couple getUser+profiles.
 *
 * `getSession()` (et non `getUser()`) : lit le JWT signé depuis le stockage
 * local, sans round-trip réseau. La sécurité reste garantie côté serveur par
 * les politiques RLS (scoping équipe via `current_team_id()`), qui s'appliquent
 * à chaque requête indépendamment de ce que le client croit être.
 */

export type Identity = {
  userId: string | null;
  email: string | null;
  teamId: string | null;
  isSuperAdmin: boolean;
};

const ANON: Identity = { userId: null, email: null, teamId: null, isSuperAdmin: false };

let cached: Identity | null = null;
let inflight: Promise<Identity> | null = null;
let authWired = false;
const listeners = new Set<() => void>();

async function resolve(): Promise<Identity> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user?.id ?? null;
  if (!userId) {
    cached = ANON;
    return cached;
  }
  const email = session?.user?.email ?? null;
  const { data: prof } = await supabase
    .from("profiles")
    .select("team_id, is_super_admin")
    .eq("id", userId)
    .single();
  cached = {
    userId,
    email,
    teamId: (prof?.team_id as string | null) ?? null,
    isSuperAdmin: prof?.is_super_admin === true,
  };
  return cached;
}

function wireAuth() {
  if (authWired) return;
  authWired = true;
  createClient().auth.onAuthStateChange((_event, session) => {
    // Déféré hors du callback : appeler supabase dans onAuthStateChange (qui
    // tient le verrou d'auth) provoque un deadlock ré-entrant.
    const nextUser = session?.user?.id ?? null;
    // Une résolution est déjà en cours : elle reflètera l'état courant.
    if (inflight) return;
    // Même utilisateur (ex. simple rafraîchissement de token) : ne rien
    // recharger — c'est précisément ce qui provoquait des tempêtes de requêtes.
    if (cached && nextUser === cached.userId) return;
    setTimeout(() => {
      cached = null;
      inflight = null;
      void getIdentity().then(() => listeners.forEach((l) => l()));
    }, 0);
  });
}

/** Identité courante, résolue une seule fois puis mise en cache. */
export function getIdentity(): Promise<Identity> {
  wireAuth();
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = resolve().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

/** Identité déjà résolue (synchrone), ou null si pas encore chargée. */
export function currentIdentity(): Identity | null {
  return cached;
}

/**
 * S'abonne aux changements d'identité (connexion / déconnexion / changement
 * d'utilisateur). Ne se déclenche PAS sur un simple rafraîchissement de token.
 */
export function onIdentityChange(listener: () => void): () => void {
  wireAuth();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
