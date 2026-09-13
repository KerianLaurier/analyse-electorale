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

import { parseWorkspaceEntitlement } from "@/lib/workspace-entitlement";
import type { Cycle, SubscriptionStatus, Tier } from "@/lib/billing";

export type IdentitySubscription = {
  coveredByTeam?: boolean;
  status: SubscriptionStatus;
  tier: Tier;
  trialEndsAt: string | null;
  cancelAt: string | null;
  billingCycle: Cycle | null;
};

export type Identity = {
  userId: string | null;
  email: string | null;
  fullName: string | null;
  teamId: string | null;
  isSuperAdmin: boolean;
  /** Abonnement effectif : personnel ou fourni par l’équipe. */
  subscription: IdentitySubscription | null;
};

const ANON: Identity = {
  userId: null,
  email: null,
  fullName: null,
  teamId: null,
  isSuperAdmin: false,
  subscription: null,
};

let cached: Identity | null = null;
let inflight: Promise<Identity> | null = null;
let authWired = false;
let identityChannel: BroadcastChannel | null = null;
let revision = 0;
let observedUser: string | null | undefined;
const listeners = new Set<() => void>();

async function resolve(): Promise<Identity> {
  const supabase = createClient();
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const userId = session?.user?.id ?? null;
  if (!userId) {
    return ANON;
  }
  const email = session?.user?.email ?? null;
  const { data: prof, error: profileError } = await supabase
    // Une seule ligne personnelle ; les droits effectifs viennent de la RPC.
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (profileError) throw profileError;
  if (!prof) throw new Error("Profil indisponible");
  const { data: entitlementData, error: entitlementError } = await supabase.rpc(
    "workspace_entitlement",
  );
  if (entitlementError) throw entitlementError;
  const entitlement = parseWorkspaceEntitlement(entitlementData);
  return {
    userId,
    email,
    fullName: (prof?.full_name as string | null) ?? null,
    teamId: entitlement.team_access
      ? ((prof.team_id as string | null) ?? null)
      : null,
    isSuperAdmin: prof?.is_super_admin === true,
    subscription: {
      ...entitlement.subscription,
      coveredByTeam: entitlement.covered_by_team,
    },
  };
}

/**
 * Force un rechargement de l'identité (et notifie les abonnés). À appeler
 * après une mutation du compte qui ne change pas d'utilisateur — ex. une
 * souscription/résiliation (onAuthStateChange ignore volontairement les
 * rafraîchissements de token du même utilisateur).
 */
function notify() {
  listeners.forEach((listener) => listener());
}

export function identityRevision(): number {
  return revision;
}

function invalidate() {
  revision += 1;
  cached = null;
  inflight = null;
}

export async function refreshIdentity(broadcast = true): Promise<Identity> {
  invalidate();
  if (broadcast) identityChannel?.postMessage("refresh");
  notify();
  return getIdentity();
}

function wireAuth() {
  if (authWired) return;
  authWired = true;
  if (typeof window !== "undefined") {
    if (typeof BroadcastChannel !== "undefined") {
      identityChannel = new BroadcastChannel("mouvancia:identity");
      identityChannel.onmessage = () => {
        void refreshIdentity(false).catch(() => notify());
      };
    }
    window.addEventListener("focus", () => {
      void refreshIdentity(false).catch(() => notify());
    });
  }
  createClient().auth.onAuthStateChange((_event, session) => {
    const nextUser = session?.user?.id ?? null;
    if (observedUser === nextUser) return;
    observedUser = nextUser;
    invalidate();
    if (!nextUser) cached = ANON;
    const expected = revision;
    // Aucun appel au SDK (y compris via un abonné) sous son verrou d'auth.
    setTimeout(() => {
      if (revision !== expected) return;
      notify();
      void getIdentity().catch(() => notify());
    }, 0);
  });
}

/** Toute résolution ancienne rejoint la génération courante sans la publier. */
export function getIdentity(): Promise<Identity> {
  wireAuth();
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    const expected = revision;
    const pending = resolve()
      .then(
        (identity) => {
          if (revision !== expected) return getIdentity();
          cached = identity;
          observedUser = identity.userId;
          notify();
          return identity;
        },
        (error) => {
          if (revision !== expected) return getIdentity();
          throw error;
        },
      )
      .finally(() => {
        if (inflight === pending) inflight = null;
      });
    inflight = pending;
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
