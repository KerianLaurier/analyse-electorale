"use client";

import { useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Campagne locale d'une équipe (1 par équipe) : territoire visé, objectif
 * électoral chiffré et découpage du terrain en secteurs. Partagé entre tous
 * les membres de l'équipe (RLS team-scoped).
 */

export type CampaignTarget = { type: string; id: string; label: string; href: string };

export type Campaign = {
  target: CampaignTarget | null;
  election: string | null;
  registered: number | null;
  turnoutTarget: number | null; // fraction 0..1
  scoreTarget: number | null; // fraction 0..1
};

export type SectorStatus = "todo" | "doing" | "done";

export type Sector = {
  id: string;
  name: string;
  registered: number | null;
  status: SectorStatus;
  contacted: number;
  favorable: number;
};

export const SECTOR_STATUS_LABELS: Record<SectorStatus, string> = {
  todo: "À couvrir",
  doing: "En cours",
  done: "Couvert",
};

type CampaignRow = {
  target_type: string | null;
  target_id: string | null;
  target_label: string | null;
  target_href: string | null;
  election: string | null;
  registered: number | null;
  turnout_target: number | null;
  score_target: number | null;
};

type SectorRow = {
  id: string;
  name: string;
  registered: number | null;
  status: SectorStatus;
  contacted: number;
  favorable: number;
};

let myTeamId: string | null = null;
let hasTeam = false;
let campaign: Campaign | null = null;
let sectors: Sector[] = [];
let loadStarted = false;
const listeners = new Set<() => void>();
const EMPTY: Sector[] = [];

function emit() {
  listeners.forEach((l) => l());
}

function mapCampaign(r: CampaignRow): Campaign {
  return {
    target: r.target_type && r.target_id
      ? {
          type: r.target_type,
          id: r.target_id,
          label: r.target_label ?? r.target_id,
          href: r.target_href ?? "#",
        }
      : null,
    election: r.election,
    registered: r.registered,
    turnoutTarget: r.turnout_target != null ? Number(r.turnout_target) : null,
    scoreTarget: r.score_target != null ? Number(r.score_target) : null,
  };
}

async function load() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    hasTeam = false;
    myTeamId = null;
    campaign = null;
    sectors = [];
    emit();
    return;
  }
  const { data: prof } = await supabase.from("profiles").select("team_id").eq("id", user.id).single();
  myTeamId = (prof?.team_id as string | null) ?? null;
  hasTeam = myTeamId != null;
  if (!myTeamId) {
    campaign = null;
    sectors = [];
    emit();
    return;
  }
  const [{ data: c }, { data: s }] = await Promise.all([
    supabase.from("campaigns").select("*").eq("team_id", myTeamId).maybeSingle(),
    supabase.from("campaign_sectors").select("*").eq("team_id", myTeamId).order("created_at", { ascending: true }),
  ]);
  campaign = c ? mapCampaign(c as CampaignRow) : null;
  sectors = (s ?? []).map((r) => r as SectorRow);
  emit();
}

function ensureLoaded() {
  if (loadStarted) return;
  loadStarted = true;
  void load();
  createClient().auth.onAuthStateChange(() => void load());
}

export async function reloadCampaign(): Promise<void> {
  await load();
}

export type CampaignPatch = {
  target?: CampaignTarget | null;
  election?: string | null;
  registered?: number | null;
  turnoutTarget?: number | null;
  scoreTarget?: number | null;
};

export async function saveCampaign(patch: CampaignPatch): Promise<void> {
  if (!myTeamId) return;
  const next: Campaign = {
    target: patch.target !== undefined ? patch.target : campaign?.target ?? null,
    election: patch.election !== undefined ? patch.election : campaign?.election ?? null,
    registered: patch.registered !== undefined ? patch.registered : campaign?.registered ?? null,
    turnoutTarget: patch.turnoutTarget !== undefined ? patch.turnoutTarget : campaign?.turnoutTarget ?? null,
    scoreTarget: patch.scoreTarget !== undefined ? patch.scoreTarget : campaign?.scoreTarget ?? null,
  };
  campaign = next;
  emit();

  const supabase = createClient();
  await supabase.from("campaigns").upsert(
    {
      team_id: myTeamId,
      target_type: next.target?.type ?? null,
      target_id: next.target?.id ?? null,
      target_label: next.target?.label ?? null,
      target_href: next.target?.href ?? null,
      election: next.election,
      registered: next.registered,
      turnout_target: next.turnoutTarget,
      score_target: next.scoreTarget,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "team_id" },
  );
}

export type NewSector = { name: string; registered?: number | null };

export async function addSector(input: NewSector): Promise<void> {
  if (!myTeamId) return;
  const supabase = createClient();
  const { data } = await supabase
    .from("campaign_sectors")
    .insert({ team_id: myTeamId, name: input.name, registered: input.registered ?? null })
    .select("*")
    .single();
  if (data) {
    sectors = [...sectors, data as SectorRow];
    emit();
  }
}

export type SectorPatch = {
  name?: string;
  registered?: number | null;
  status?: SectorStatus;
  contacted?: number;
  favorable?: number;
};

export async function updateSector(id: string, patch: SectorPatch): Promise<void> {
  const idx = sectors.findIndex((s) => s.id === id);
  if (idx < 0) return;
  const next = { ...sectors[idx], ...patch };
  sectors = [...sectors.slice(0, idx), next, ...sectors.slice(idx + 1)];
  emit();
  const supabase = createClient();
  const { error } = await supabase
    .from("campaign_sectors")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) await load();
}

export async function deleteSector(id: string): Promise<void> {
  sectors = sectors.filter((s) => s.id !== id);
  emit();
  const supabase = createClient();
  await supabase.from("campaign_sectors").delete().eq("id", id);
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  ensureLoaded();
  return () => {
    listeners.delete(l);
  };
}

export function useCampaign(): Campaign | null {
  return useSyncExternalStore(subscribe, () => campaign, () => null);
}

export function useSectors(): Sector[] {
  return useSyncExternalStore(subscribe, () => sectors, () => EMPTY);
}

export function useHasTeam(): boolean {
  return useSyncExternalStore(subscribe, () => hasTeam, () => false);
}

/** Voix nécessaires = inscrits × participation cible × score cible. */
export function voteGoal(c: Campaign | null): number | null {
  if (!c || c.registered == null || c.turnoutTarget == null || c.scoreTarget == null) return null;
  return Math.round(c.registered * c.turnoutTarget * c.scoreTarget);
}
