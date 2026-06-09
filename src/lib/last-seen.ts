"use client";

import { useSyncExternalStore } from "react";

/**
 * « Depuis votre dernière visite » — horodatage local par section de Suivre.
 * Stocké en localStorage (par appareil, suffisant pour un compteur de
 * nouveautés) ; à la première visite, la base de référence est posée à
 * maintenant pour ne pas marquer tout l'historique comme nouveau.
 * Store module-level réactif (même pattern que les stores Supabase).
 */

export type SeenSection = "medias" | "opinion" | "parlement";

const STORAGE_KEY = "suivre:seen:v1";
const SECTIONS: SeenSection[] = ["medias", "opinion", "parlement"];

type SeenMap = Record<SeenSection, number>;

let seen: SeenMap | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function writeStore(map: SeenMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* stockage indisponible (navigation privée…) : compteurs simplement inactifs */
  }
}

/** Initialisation paresseuse côté client : lit le store, pose les bases manquantes. */
function ensureLoaded() {
  if (seen !== null || typeof window === "undefined") return;
  let stored: Partial<SeenMap> = {};
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<SeenMap>;
  } catch {
    /* contenu corrompu : repart de zéro */
  }
  const now = Date.now();
  const next = {} as SeenMap;
  for (const s of SECTIONS) next[s] = stored[s] ?? now;
  seen = next;
  writeStore(next);
}

export function markSeen(s: SeenSection) {
  ensureLoaded();
  if (!seen) return;
  // Pas d'écriture (ni de re-render) si rien de neuf depuis < 1 s.
  if (Date.now() - seen[s] < 1000) return;
  seen = { ...seen, [s]: Date.now() };
  writeStore(seen);
  emit();
}

function subscribe(l: () => void): () => void {
  ensureLoaded();
  // L'initialisation paresseuse vient de poser les bases : notifie après
  // l'abonnement pour que le premier snapshot client soit pris en compte.
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Horodatages de dernière consultation ; null côté serveur (avant hydratation). */
export function useSectionSeen(): SeenMap | null {
  return useSyncExternalStore(subscribe, () => seen, () => null);
}

/** Nombre d'éléments dont la date est postérieure à `since`. */
export function countNewer(dates: Array<string | null | undefined>, since: number | undefined): number {
  if (!since) return 0;
  let n = 0;
  for (const d of dates) {
    if (!d) continue;
    const t = new Date(d).getTime();
    if (Number.isFinite(t) && t > since) n++;
  }
  return n;
}
