"use client";

import { useQuery } from "@tanstack/react-query";
import { useHydrated } from "@/lib/use-hydrated";
import { createClient } from "@/lib/supabase/client";
import { getIdentity, onIdentityChange } from "@/lib/identity";
import { getQueryClient } from "@/providers/query-provider";

/**
 * Campagne locale d'une équipe (1 par équipe) : territoire visé, objectif
 * électoral chiffré et découpage du terrain en secteurs. Partagé entre tous
 * les membres de l'équipe (RLS team-scoped).
 *
 * Adossé à TanStack Query (cf. migration des stores, pilote `pins`). Campagne,
 * secteurs et flag équipe partagent une même entrée de cache. API publique
 * inchangée.
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
  bureauCode: string | null;
  priority: number | null;
  address: string | null;
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
  bureau_code: string | null;
  priority: number | null;
  address: string | null;
};

type CampaignData = { campaign: Campaign | null; sectors: Sector[]; hasTeam: boolean };

const CAMPAIGN_KEY = ["campaign"] as const;
const EMPTY_SECTORS: Sector[] = [];
const EMPTY_DATA: CampaignData = { campaign: null, sectors: EMPTY_SECTORS, hasTeam: false };

const campaignQuery = {
  queryKey: CAMPAIGN_KEY,
  queryFn: fetchCampaign,
  staleTime: 5 * 60 * 1000,
};

function mapSector(r: SectorRow): Sector {
  return {
    id: r.id,
    name: r.name,
    registered: r.registered,
    status: r.status,
    contacted: r.contacted,
    favorable: r.favorable,
    bureauCode: r.bureau_code ?? null,
    priority: r.priority ?? null,
    address: r.address ?? null,
  };
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

async function fetchCampaign(): Promise<CampaignData> {
  const { userId, teamId } = await getIdentity();
  if (!userId || !teamId) {
    return { campaign: null, sectors: [], hasTeam: false };
  }
  const supabase = createClient();
  const [{ data: c }, { data: s }] = await Promise.all([
    supabase.from("campaigns").select("*").eq("team_id", teamId).maybeSingle(),
    supabase.from("campaign_sectors").select("*").eq("team_id", teamId).order("created_at", { ascending: true }),
  ]);
  return {
    campaign: c ? mapCampaign(c as CampaignRow) : null,
    sectors: (s ?? []).map((r) => mapSector(r as SectorRow)),
    hasTeam: true,
  };
}

let identityWired = false;
function ensureIdentityWired() {
  if (identityWired || typeof window === "undefined") return;
  identityWired = true;
  onIdentityChange(() => {
    void getQueryClient().invalidateQueries({ queryKey: CAMPAIGN_KEY });
  });
}

function currentData(): CampaignData {
  return getQueryClient().getQueryData<CampaignData>(CAMPAIGN_KEY) ?? EMPTY_DATA;
}
function patchData(fn: (d: CampaignData) => CampaignData) {
  getQueryClient().setQueryData<CampaignData>(CAMPAIGN_KEY, (old) => fn(old ?? EMPTY_DATA));
}

export async function reloadCampaign(): Promise<void> {
  await getQueryClient().refetchQueries({ queryKey: CAMPAIGN_KEY, type: "all" });
}

export type CampaignPatch = {
  target?: CampaignTarget | null;
  election?: string | null;
  registered?: number | null;
  turnoutTarget?: number | null;
  scoreTarget?: number | null;
};

export async function saveCampaign(patch: CampaignPatch): Promise<void> {
  const { teamId } = await getIdentity();
  if (!teamId) return;
  const prev = currentData().campaign;
  const next: Campaign = {
    target: patch.target !== undefined ? patch.target : prev?.target ?? null,
    election: patch.election !== undefined ? patch.election : prev?.election ?? null,
    registered: patch.registered !== undefined ? patch.registered : prev?.registered ?? null,
    turnoutTarget: patch.turnoutTarget !== undefined ? patch.turnoutTarget : prev?.turnoutTarget ?? null,
    scoreTarget: patch.scoreTarget !== undefined ? patch.scoreTarget : prev?.scoreTarget ?? null,
  };
  patchData((d) => ({ ...d, campaign: next, hasTeam: true }));

  const supabase = createClient();
  await supabase.from("campaigns").upsert(
    {
      team_id: teamId,
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

export type NewSector = {
  name: string;
  registered?: number | null;
  bureauCode?: string | null;
  priority?: number | null;
};

export async function addSector(input: NewSector): Promise<void> {
  const { teamId } = await getIdentity();
  if (!teamId) return;
  const supabase = createClient();
  const { data } = await supabase
    .from("campaign_sectors")
    .insert({ team_id: teamId, name: input.name, registered: input.registered ?? null })
    .select("*")
    .single();
  if (data) {
    patchData((d) => ({ ...d, sectors: [...d.sectors, mapSector(data as SectorRow)] }));
  }
}

/** Ajoute plusieurs secteurs d'un coup (génération / ciblage). Dédoublonne par
 *  code bureau si présent, sinon par nom. Renvoie le nombre réellement ajouté. */
export async function addSectorsBulk(items: NewSector[]): Promise<number> {
  const { teamId } = await getIdentity();
  if (!teamId || items.length === 0) return 0;
  const sectors = currentData().sectors;
  const existingCodes = new Set(sectors.map((s) => s.bureauCode).filter(Boolean));
  const existingNames = new Set(sectors.map((s) => s.name));
  const fresh = items.filter((i) =>
    i.name && (i.bureauCode ? !existingCodes.has(i.bureauCode) : !existingNames.has(i.name)),
  );
  if (fresh.length === 0) return 0;
  const supabase = createClient();
  const { data } = await supabase
    .from("campaign_sectors")
    .insert(
      fresh.map((i) => ({
        team_id: teamId,
        name: i.name,
        registered: i.registered ?? null,
        bureau_code: i.bureauCode ?? null,
        priority: i.priority ?? null,
      })),
    )
    .select("*");
  if (data) {
    patchData((d) => ({ ...d, sectors: [...d.sectors, ...(data as SectorRow[]).map(mapSector)] }));
  }
  return data?.length ?? 0;
}

export type SectorPatch = {
  name?: string;
  registered?: number | null;
  status?: SectorStatus;
  contacted?: number;
  favorable?: number;
  address?: string | null;
};

export async function updateSector(id: string, patch: SectorPatch): Promise<void> {
  const qc = getQueryClient();
  const sectors = currentData().sectors;
  const idx = sectors.findIndex((s) => s.id === id);
  if (idx < 0) return;
  const next = { ...sectors[idx], ...patch };
  patchData((d) => ({
    ...d,
    sectors: [...d.sectors.slice(0, idx), next, ...d.sectors.slice(idx + 1)],
  }));
  const supabase = createClient();
  const { error } = await supabase
    .from("campaign_sectors")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) void qc.invalidateQueries({ queryKey: CAMPAIGN_KEY });
}

export async function deleteSector(id: string): Promise<void> {
  patchData((d) => ({ ...d, sectors: d.sectors.filter((s) => s.id !== id) }));
  const supabase = createClient();
  await supabase.from("campaign_sectors").delete().eq("id", id);
}

function useCampaignQuery() {
  ensureIdentityWired();
  return useQuery(campaignQuery);
}

export function useCampaign(): Campaign | null {
  return useCampaignQuery().data?.campaign ?? null;
}

export function useSectors(): Sector[] {
  return useCampaignQuery().data?.sectors ?? EMPTY_SECTORS;
}

export function useHasTeam(): boolean {
  return useCampaignQuery().data?.hasTeam ?? false;
}

/** Voix nécessaires = inscrits × participation cible × score cible. */
export function voteGoal(c: Campaign | null): number | null {
  if (!c || c.registered == null || c.turnoutTarget == null || c.scoreTarget == null) return null;
  return Math.round(c.registered * c.turnoutTarget * c.scoreTarget);
}

/** True une fois le premier chargement terminé (pour les squelettes). */
export function useLoaded(): boolean {
  // `&& useHydrated()` : contenu révélé après hydratation → pas de mismatch SSR.
  const ok = useCampaignQuery().isSuccess;
  const hydrated = useHydrated();
  return ok && hydrated;
}
