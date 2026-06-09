"use client";

import { useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import { getIdentity, onIdentityChange } from "@/lib/identity";
import { toast } from "@/components/toaster";

/**
 * Mots-clés de veille presse (table `watch_keywords`) : noms d'adversaires,
 * thèmes locaux… Le briefing « Suivre » agrège une recherche presse par
 * mot-clé. Partagés avec l'équipe quand le compte en a une (liste de veille
 * commune de campagne), personnels sinon.
 */

export type WatchKeyword = {
  id: string;
  keyword: string;
  shared: boolean;
  mine: boolean;
  createdAt: number;
};

/** Plafond raisonnable : chaque mot-clé déclenche une recherche presse. */
export const MAX_KEYWORDS = 8;

type Row = {
  id: string;
  user_id: string;
  team_id: string | null;
  keyword: string;
  created_at: string;
};

let myUserId: string | null = null;
let myTeamId: string | null = null;
let keywords: WatchKeyword[] = [];
let loadStarted = false;
let loaded = false;
const listeners = new Set<() => void>();
const EMPTY: WatchKeyword[] = [];

function emit() {
  listeners.forEach((l) => l());
}

function mapRow(r: Row): WatchKeyword {
  return {
    id: r.id,
    keyword: r.keyword,
    shared: r.team_id != null,
    mine: r.user_id === myUserId,
    createdAt: new Date(r.created_at).getTime(),
  };
}

async function load() {
  const { userId, teamId } = await getIdentity();
  myUserId = userId;
  if (!userId) {
    myTeamId = null;
    keywords = [];
    emit();
    return;
  }
  myTeamId = teamId;
  const supabase = createClient();
  // Dégradation propre tant que la table n'existe pas (migration en attente) :
  // l'erreur laisse simplement la liste vide.
  const { data } = await supabase
    .from("watch_keywords")
    .select("*")
    .order("created_at", { ascending: true });
  keywords = (data ?? []).map((r) => mapRow(r as Row));
  emit();
}

function ensureLoaded() {
  if (loadStarted) return;
  loadStarted = true;
  void load().finally(() => { loaded = true; emit(); });
  onIdentityChange(() => void load());
}

/** Ajoute un mot-clé (partagé avec l'équipe si le compte en a une). */
export async function addKeyword(raw: string): Promise<boolean> {
  const keyword = raw.trim();
  if (keyword.length < 2) return false;
  if (keywords.length >= MAX_KEYWORDS) {
    toast.info(`Maximum ${MAX_KEYWORDS} mots-clés — retirez-en un d'abord.`);
    return false;
  }
  if (keywords.some((k) => k.keyword.toLowerCase() === keyword.toLowerCase())) {
    toast.info("Ce mot-clé est déjà suivi.");
    return false;
  }
  const { userId } = await getIdentity();
  if (!userId) return false;
  myUserId = userId;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("watch_keywords")
    .insert({ user_id: userId, team_id: myTeamId, keyword })
    .select("*")
    .single();
  if (error || !data) {
    toast.error("Impossible d'ajouter le mot-clé — vérifiez votre connexion puis réessayez.");
    return false;
  }
  keywords = [...keywords, mapRow(data as Row)];
  emit();
  return true;
}

export async function removeKeyword(id: string): Promise<void> {
  keywords = keywords.filter((k) => k.id !== id);
  emit();
  const supabase = createClient();
  const { error } = await supabase.from("watch_keywords").delete().eq("id", id);
  if (error) {
    await load(); // rollback : le mot-clé réapparaît
    toast.error("Suppression impossible — réessayez.");
  }
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  ensureLoaded();
  return () => {
    listeners.delete(l);
  };
}

export function useWatchKeywords(): WatchKeyword[] {
  return useSyncExternalStore(subscribe, () => keywords, () => EMPTY);
}

/** True une fois le premier chargement terminé (pour les squelettes). */
export function useLoaded(): boolean {
  return useSyncExternalStore(subscribe, () => loaded, () => false);
}
