"use client";

import { useSyncExternalStore } from "react";

// Store factice : ne notifie jamais de changement.
const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * `false` au rendu serveur ET au premier paint client (hydratation), puis `true`.
 *
 * `useSyncExternalStore` renvoie le snapshot serveur pendant l'hydratation, puis
 * le snapshot client au commit suivant. On s'en sert pour ne révéler le contenu
 * dépendant de données côté client qu'après l'hydratation : le premier rendu
 * client reste identique au HTML serveur (le squelette), ce qui évite les
 * « hydration mismatch » sur les vues dont l'état de chargement ne peut pas
 * exister côté serveur (stores React Query alimentés depuis le navigateur).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
