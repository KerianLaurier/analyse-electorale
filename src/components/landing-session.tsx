"use client";

import { useSyncExternalStore, type ReactNode } from "react";

/**
 * Détection de session pour la VITRINE, sans charger `@supabase/supabase-js`.
 *
 * La landing ne se sert de l'état connecté que pour choisir un libellé de CTA
 * (« Rejoindre la liste d'attente » vs « Accéder à mon QG »). Le faire côté
 * serveur imposait un rendu dynamique de `/` à chaque requête (aucun cache CDN)
 * et un `getUser()` réseau ; le faire avec le client Supabase côté navigateur
 * ramènerait 62 kB gz de JS sur une page qui n'en a pas besoin.
 *
 * On se contente donc de regarder si un cookie de session existe. C'est un
 * indice d'affichage, jamais une autorisation : l'accès réel reste vérifié par
 * le proxy (`src/proxy.ts`) à l'ouverture de l'application.
 *
 * En production, la vitrine (`mouvancia.fr`) et l'app (`app.mouvancia.fr`) sont
 * deux hôtes distincts et les cookies Supabase sont posés sans attribut
 * `domain` : le cookie n'est donc pas visible ici et la variante « visiteur »
 * s'affiche toujours. C'est le comportement attendu — la bascule ne sert que
 * sur un hôte unique (dev, aperçus de déploiement).
 */
function hasSessionCookie(): boolean {
  // Mêmes chunks que `sessionCookieSnapshot()` (src/lib/session-cookie.ts) :
  // on exclut le cookie PKCE, posé AVANT la session (faux positif).
  return document.cookie
    .split("; ")
    .some((c) => c.includes("-auth-token") && !c.includes("code-verifier"));
}

// Le cookie ne change pas pendant la vie de la page (on ne se connecte pas
// depuis la vitrine) : rien à observer, l'abonnement est un no-op.
const subscribe = () => () => {};

/**
 * `false` côté serveur : le HTML statique montre toujours la variante
 * « visiteur » — celle que voient les robots d'indexation et l'immense majorité
 * des visiteurs. La valeur réelle est lue à l'hydratation.
 *
 * `useSyncExternalStore` plutôt qu'un `useState` + `useEffect` : React lit le
 * snapshot au bon moment sans provoquer de rendu en cascade après le montage.
 */
function useSessionCookie(): boolean {
  return useSyncExternalStore(subscribe, hasSessionCookie, () => false);
}

/** Rendu uniquement si un cookie de session est présent (après hydratation). */
export function WhenAuthed({ children }: { children: ReactNode }) {
  return useSessionCookie() ? <>{children}</> : null;
}

/** Rendu par défaut (HTML statique), masqué si une session est détectée. */
export function WhenAnon({ children }: { children: ReactNode }) {
  return useSessionCookie() ? null : <>{children}</>;
}

export { useSessionCookie };
