"use client";

import { useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Comptes-rendus de porte-à-porte (table `canvass_reports`) — partagés avec
 * l'équipe (RLS). Chaque CR consigne, pour une action : portes frappées,
 * personnes rencontrées et la ventilation favorable / neutre / défavorable.
 * La synthèse en dérive un « sondage terrain » (déclaratif).
 */

export type CanvassReport = {
  id: string;
  authorId: string;
  sectorId: string | null;
  zone: string | null;
  date: string;
  volunteers: number;
  doors: number;
  met: number;
  favorable: number;
  neutral: number;
  unfavorable: number;
  notes: string | null;
  teamId: string | null;
  shared: boolean;
  mine: boolean;
  createdAt: number;
};

type Row = {
  id: string;
  user_id: string;
  team_id: string | null;
  sector_id: string | null;
  zone: string | null;
  date: string;
  volunteers: number;
  doors: number;
  met: number;
  favorable: number;
  neutral: number;
  unfavorable: number;
  notes: string | null;
  created_at: string;
};

let myUserId: string | null = null;
let myTeamId: string | null = null;
let reports: CanvassReport[] = [];
let loadStarted = false;
const listeners = new Set<() => void>();
const EMPTY: CanvassReport[] = [];

function emit() {
  listeners.forEach((l) => l());
}

function mapRow(r: Row): CanvassReport {
  return {
    id: r.id,
    authorId: r.user_id,
    sectorId: r.sector_id,
    zone: r.zone,
    date: r.date,
    volunteers: r.volunteers,
    doors: r.doors,
    met: r.met,
    favorable: r.favorable,
    neutral: r.neutral,
    unfavorable: r.unfavorable,
    notes: r.notes,
    teamId: r.team_id,
    shared: r.team_id != null,
    mine: r.user_id === myUserId,
    createdAt: new Date(r.created_at).getTime(),
  };
}

async function load() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  myUserId = user?.id ?? null;
  if (!user) {
    myTeamId = null;
    reports = [];
    emit();
    return;
  }
  const { data: prof } = await supabase.from("profiles").select("team_id").eq("id", user.id).single();
  myTeamId = (prof?.team_id as string | null) ?? null;
  const { data } = await supabase.from("canvass_reports").select("*").order("date", { ascending: false });
  reports = (data ?? []).map((r) => mapRow(r as Row));
  emit();
}

function ensureLoaded() {
  if (loadStarted) return;
  loadStarted = true;
  void load();
  createClient().auth.onAuthStateChange(() => {
    setTimeout(() => void load(), 0);
  });
}

export type NewReport = {
  sectorId?: string | null;
  zone?: string | null;
  date: string;
  volunteers?: number;
  doors?: number;
  met?: number;
  favorable?: number;
  neutral?: number;
  unfavorable?: number;
  notes?: string | null;
  shared?: boolean;
};

export async function addReport(input: NewReport): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  myUserId = user.id;
  const team_id = input.shared && myTeamId ? myTeamId : null;
  const { data } = await supabase
    .from("canvass_reports")
    .insert({
      user_id: user.id,
      team_id,
      sector_id: input.sectorId ?? null,
      zone: input.zone ?? null,
      date: input.date,
      volunteers: input.volunteers ?? 1,
      doors: input.doors ?? 0,
      met: input.met ?? 0,
      favorable: input.favorable ?? 0,
      neutral: input.neutral ?? 0,
      unfavorable: input.unfavorable ?? 0,
      notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (data) {
    reports = [mapRow(data as Row), ...reports].sort((a, b) => (a.date < b.date ? 1 : -1));
    emit();
  }
}

export async function deleteReport(id: string): Promise<void> {
  reports = reports.filter((r) => r.id !== id);
  emit();
  const supabase = createClient();
  await supabase.from("canvass_reports").delete().eq("id", id);
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  ensureLoaded();
  return () => {
    listeners.delete(l);
  };
}

export function useReports(): CanvassReport[] {
  return useSyncExternalStore(subscribe, () => reports, () => EMPTY);
}

// ── Synthèse ────────────────────────────────────────────────────────────────

export type CanvassSummary = {
  sessions: number;
  doors: number;
  met: number;
  favorable: number;
  neutral: number;
  unfavorable: number;
  /** Personnes ayant exprimé un avis (= fav + neu + déf). */
  opinions: number;
  favPct: number; // part des avis
  neuPct: number;
  unfPct: number;
  contactRate: number; // rencontrés / portes
};

export function summarize(reports: CanvassReport[]): CanvassSummary {
  const s = reports.reduce(
    (a, r) => {
      a.sessions += 1;
      a.doors += r.doors;
      a.met += r.met;
      a.favorable += r.favorable;
      a.neutral += r.neutral;
      a.unfavorable += r.unfavorable;
      return a;
    },
    { sessions: 0, doors: 0, met: 0, favorable: 0, neutral: 0, unfavorable: 0 },
  );
  const opinions = s.favorable + s.neutral + s.unfavorable;
  return {
    ...s,
    opinions,
    favPct: opinions > 0 ? s.favorable / opinions : 0,
    neuPct: opinions > 0 ? s.neutral / opinions : 0,
    unfPct: opinions > 0 ? s.unfavorable / opinions : 0,
    contactRate: s.doors > 0 ? s.met / s.doors : 0,
  };
}

export type SectorAgg = {
  sessions: number;
  doors: number;
  met: number;
  favorable: number;
  neutral: number;
  unfavorable: number;
};

/** Agrégat par secteur (progression du plan d'action + sentiment par zone). */
export function bySector(reports: CanvassReport[]): Map<string, SectorAgg> {
  const m = new Map<string, SectorAgg>();
  for (const r of reports) {
    if (!r.sectorId) continue;
    const cur = m.get(r.sectorId) ?? { sessions: 0, doors: 0, met: 0, favorable: 0, neutral: 0, unfavorable: 0 };
    cur.sessions += 1;
    cur.doors += r.doors;
    cur.met += r.met;
    cur.favorable += r.favorable;
    cur.neutral += r.neutral;
    cur.unfavorable += r.unfavorable;
    m.set(r.sectorId, cur);
  }
  return m;
}

export type WeekPoint = {
  week: string; // date du lundi (ISO)
  label: string;
  sessions: number;
  met: number;
  favorable: number;
  neutral: number;
  unfavorable: number;
  favPct: number;
};

/** Lundi de la semaine d'une date (ISO yyyy-mm-dd, en heure locale). */
function mondayOf(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const day = (d.getDay() + 6) % 7; // 0 = lundi
  d.setDate(d.getDate() - day);
  // Format local (éviter le décalage UTC de toISOString).
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Tendance hebdomadaire du sentiment (ordre chronologique croissant). */
export function weeklyTrend(reports: CanvassReport[]): WeekPoint[] {
  const m = new Map<string, WeekPoint>();
  for (const r of reports) {
    const wk = mondayOf(r.date);
    const cur =
      m.get(wk) ??
      ({ week: wk, label: "", sessions: 0, met: 0, favorable: 0, neutral: 0, unfavorable: 0, favPct: 0 } as WeekPoint);
    cur.sessions += 1;
    cur.met += r.met;
    cur.favorable += r.favorable;
    cur.neutral += r.neutral;
    cur.unfavorable += r.unfavorable;
    m.set(wk, cur);
  }
  return [...m.values()]
    .sort((a, b) => (a.week < b.week ? -1 : 1))
    .map((w) => {
      const op = w.favorable + w.neutral + w.unfavorable;
      return {
        ...w,
        favPct: op > 0 ? w.favorable / op : 0,
        label: new Date(w.week + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
      };
    });
}
