"use client";

import { useQuery } from "@tanstack/react-query";
import { inseeUrl, parquetUrl, query } from "@/lib/duckdb";
import type { Maille } from "@/lib/map-config";
import { SCRUTIN_META, isElection, type Scrutin } from "@/lib/url-state";
import { blocById, type BlocId } from "@/lib/analysis";

const FILOSOFI_PARQUET = "filosofi_2021_commune.parquet";
const RP_PARQUET = "rp_2022_commune.parquet";

const aggUrl = (
  scrutin: Scrutin,
  kind: "territoires" | "candidats",
  maille?: Maille,
) =>
  parquetUrl(`agg/${scrutin}${maille === "bureaux" ? "_bureaux" : ""}_${kind}.parquet`);

// ─── Types partagés ───────────────────────────────────────────────────────────

export type WinningNuanceRow = { code: string; nuance: string };
export type NumericRow = { code: string; value: number };
export type CommuneNumericRow = NumericRow;

export type ScrutinCandidate = {
  label: string;
  nuance: string | null;
  voix: number;
  pct: number;
  elu: boolean;
};

export type ScrutinDetail = {
  code: string;
  libelle: string | null;
  inscrits: number;
  votants: number;
  exprimes: number;
  abstentions: number;
  blancs: number;
  nuls: number;
  participation: number;
  candidates: ScrutinCandidate[];
  /** Législatives au niveau commune : la commune relève de plusieurs circonscriptions
   *  (candidats issus de courses différentes → résultats agrégés par nuance). */
  multiCirco?: boolean;
};

export type CommuneSociologie = {
  code: string;
  revenuMedian: number | null;
  tauxPauvrete: number | null;
  decile1: number | null;
  decile9: number | null;
  interdecile: number | null;
  partPensions: number | null;
  partPrestations: number | null;
  partChomage: number | null;
  menagesImposes: number | null;
};

// ─── Choroplèthes électorales (génériques, lisent les agrégats) ───────────────

/**
 * Nuance gagnante par territoire pour un scrutin × maille donné.
 * On somme les voix par nuance (gère le cas où plusieurs candidats partagent
 * une nuance, ex. extrême gauche en présidentielle) puis on garde le top.
 */
export function useScrutinWinner(scrutin: Scrutin, maille: Maille, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["scrutin-winner", scrutin, maille],
    queryFn: async (): Promise<WinningNuanceRow[]> => {
      const url = aggUrl(scrutin, "candidats", maille);
      const rows = await query<{ code: string; nuance: string }>(
        `
        WITH s AS (
          SELECT code, nuance, SUM(voix) AS v
          FROM read_parquet('${url}')
          WHERE maille = ? AND nuance IS NOT NULL
          GROUP BY code, nuance
        )
        SELECT code, nuance FROM s
        QUALIFY ROW_NUMBER() OVER (PARTITION BY code ORDER BY v DESC) = 1
      `,
        [maille],
      );
      return rows.filter((r) => r.code && r.nuance);
    },
    staleTime: 60 * 60 * 1000,
  });
}

/** Participation ou abstention (rapport sur inscrits) par territoire. */
export function useScrutinMetric(
  scrutin: Scrutin,
  maille: Maille,
  metric: "participation" | "abstention",
  enabled = true,
) {
  return useQuery({
    enabled,
    queryKey: ["scrutin-metric", scrutin, maille, metric],
    queryFn: async (): Promise<NumericRow[]> => {
      const url = aggUrl(scrutin, "territoires", maille);
      const numer = metric === "participation" ? "votants" : "abstentions";
      const rows = await query<{ code: string; value: number }>(
        `
        SELECT code, CAST(${numer} AS DOUBLE) / inscrits AS value
        FROM read_parquet('${url}')
        WHERE maille = ? AND inscrits > 0
      `,
        [maille],
      );
      return rows
        .filter((r) => r.code && Number.isFinite(r.value))
        .map((r) => ({ code: String(r.code), value: Number(r.value) }));
    },
    staleTime: 60 * 60 * 1000,
  });
}

/**
 * Détail complet d'un territoire pour un scrutin (chiffres clés + candidats).
 * Fonction pure réutilisable (hors hook) — `maille`/`code` sont liés en
 * paramètres, jamais interpolés (cf. `query`).
 */
export async function fetchScrutinDetail(
  scrutin: Scrutin,
  maille: Maille,
  code: string,
): Promise<ScrutinDetail | null> {
  const terr = aggUrl(scrutin, "territoires", maille);
  const cand = aggUrl(scrutin, "candidats", maille);

  const headerRows = await query<{
    libelle: string | null;
    inscrits: number;
    votants: number;
    exprimes: number;
    abstentions: number;
    blancs: number;
    nuls: number;
  }>(
    `
        SELECT libelle, inscrits, votants, exprimes, abstentions, blancs, nuls
        FROM read_parquet('${terr}')
        WHERE maille = ? AND code = ?
        LIMIT 1
      `,
    [maille, code],
  );
  if (headerRows.length === 0) return null;
  const h = headerRows[0];
  const exprimes = Number(h.exprimes ?? 0);
  const inscrits = Number(h.inscrits ?? 0);

  const candRows = await query<{
    label: string | null;
    nuance: string | null;
    voix: number;
    elu: boolean;
  }>(
    `
        SELECT label, nuance, voix, elu
        FROM read_parquet('${cand}')
        WHERE maille = ? AND code = ? AND voix IS NOT NULL
        ORDER BY voix DESC
      `,
    [maille, code],
  );

  const rawCandidates: ScrutinCandidate[] = candRows.map((c) => ({
    label: c.label ?? "",
    nuance: c.nuance ?? null,
    voix: Number(c.voix ?? 0),
    pct: exprimes > 0 ? Number(c.voix) / exprimes : 0,
    elu: Boolean(c.elu),
  }));

  // Législatives au niveau commune : une commune peut relever de plusieurs
  // circonscriptions → l'agrégat mélange des candidats de courses différentes.
  // On regroupe alors par nuance (seule unité comparable à cette maille).
  const legislativeCommune = SCRUTIN_META[scrutin].family === "legislative" && maille === "communes";
  const { candidates, multiCirco } = legislativeCommune
    ? collapseByNuance(rawCandidates, exprimes)
    : { candidates: rawCandidates, multiCirco: false };

  return {
    code,
    libelle: h.libelle ?? null,
    inscrits,
    votants: Number(h.votants ?? 0),
    exprimes,
    abstentions: Number(h.abstentions ?? 0),
    blancs: Number(h.blancs ?? 0),
    nuls: Number(h.nuls ?? 0),
    participation: inscrits > 0 ? Number(h.votants) / inscrits : 0,
    candidates,
    multiCirco,
  };
}

// ─── Bureaux de vote d'un territoire (pour générer le plan de terrain) ─────────

export type TerritoryBureau = { code: string; name: string; registered: number };

/** Garde-fou : un code INSEE / circo ne contient que des alphanum. */
const sanitizeCode = (s: string) => s.replace(/[^0-9A-Za-z]/g, "");

/**
 * Liste les bureaux de vote rattachés à un territoire (commune ou circo), avec
 * leurs inscrits (Légis. 2024 T1). Pour une circo, on ne retient que les
 * communes appartenant à cette seule circo ; `splitCommunes` compte celles
 * partagées entre plusieurs circos (bureaux non attribuables → à ajouter à la main).
 */
export async function fetchTerritoryBureaux(target: {
  type: string;
  id: string;
}): Promise<{ bureaux: TerritoryBureau[]; splitCommunes: number }> {
  const url = aggUrl("legis-2024-t1", "territoires", "bureaux");
  let filter: string;
  let splitCommunes = 0;

  if (target.type === "commune") {
    filter = `split_part(code, '_', 1) = '${sanitizeCode(target.id)}'`;
  } else if (target.type === "circo") {
    const res = await fetch("/electoral/commune_circo.json");
    if (!res.ok) return { bureaux: [], splitCommunes: 0 };
    const map = (await res.json()) as Record<string, string[]>;
    const communes: string[] = [];
    for (const [insee, circos] of Object.entries(map)) {
      if (!circos.includes(target.id)) continue;
      if (circos.length === 1) communes.push(insee);
      else splitCommunes++;
    }
    if (communes.length === 0) return { bureaux: [], splitCommunes };
    const inList = communes.map((c) => `'${sanitizeCode(c)}'`).join(",");
    filter = `split_part(code, '_', 1) IN (${inList})`;
  } else {
    return { bureaux: [], splitCommunes: 0 };
  }

  const rows = await query<{ code: string; libelle: string | null; inscrits: number }>(
    `
      SELECT code, libelle, inscrits
      FROM read_parquet('${url}')
      WHERE maille = 'bureaux' AND ${filter}
      ORDER BY code
    `,
  );
  const bureaux = rows.map((r) => ({
    code: r.code,
    name: r.libelle?.trim() || `Bureau ${r.code.split("_")[1] ?? r.code}`,
    registered: Number(r.inscrits ?? 0),
  }));
  return { bureaux, splitCommunes };
}

// ─── Ciblage : bureaux d'une circo classés par potentiel de campagne ──────────

export type BureauCand = { nuance: string | null; voix: number };

/** Données brutes d'un bureau (récupérées une fois, scorées ensuite). */
export type CircoBureauRaw = {
  code: string;
  name: string;
  insee: string;
  inscrits: number;
  exprimes: number;
  abstentions: number;
  cands: BureauCand[]; // triés par voix décroissantes
};

export type TargetReason =
  | "bascule" // 2e à portée du 1er
  | "bastion" // bloc en tête → mobiliser la base
  | "conquete" // bloc en retrait mais atteignable
  | "reservoir" // forte abstention (mode indifférent)
  | "dispute" // écart 1er/2e serré (mode indifférent)
  | "defavorable" // peu de potentiel
  | "neutre";

export type TargetBureau = {
  code: string;
  name: string;
  insee: string;
  inscrits: number;
  abstentionRate: number; // 0..1
  marginPct: number | null; // écart 1er/2e en part des exprimés (0..1)
  winnerNuance: string | null;
  /** Part du bloc choisi (0..1) ; null en mode indifférent. */
  blocShare: number | null;
  reason: TargetReason;
  /** Score composite 0..100 (plus haut = plus prioritaire à travailler). */
  priority: number;
};

/** Liste des communes appartenant à une SEULE circo (attribuables sans ambiguïté). */
async function communesOfCirco(circo: string): Promise<string[]> {
  const res = await fetch("/electoral/commune_circo.json");
  if (!res.ok) return [];
  const map = (await res.json()) as Record<string, string[]>;
  const communes: string[] = [];
  for (const [insee, circos] of Object.entries(map)) {
    if (circos.length === 1 && circos[0] === circo) communes.push(insee);
  }
  return communes;
}

/**
 * Récupère les bureaux d'une circo avec leurs candidats (Légis. 2024 T1).
 * Données brutes : le scoring (dépendant du positionnement) se fait ensuite
 * côté client via `scoreBureaux`, ce qui permet de re-scorer instantanément.
 */
export async function fetchCircoBureaux(circo: string): Promise<CircoBureauRaw[]> {
  const communes = await communesOfCirco(circo);
  if (communes.length === 0) return [];
  const inList = communes.map((c) => `'${sanitizeCode(c)}'`).join(",");
  const terr = aggUrl("legis-2024-t1", "territoires", "bureaux");
  const cand = aggUrl("legis-2024-t1", "candidats", "bureaux");

  const [terrRows, candRows] = await Promise.all([
    query<{ code: string; libelle: string | null; inscrits: number; exprimes: number; abstentions: number }>(
      `SELECT code, libelle, inscrits, exprimes, abstentions
       FROM read_parquet('${terr}')
       WHERE maille = 'bureaux' AND split_part(code, '_', 1) IN (${inList})`,
    ),
    query<{ code: string; nuance: string | null; voix: number }>(
      `SELECT code, nuance, voix FROM read_parquet('${cand}')
       WHERE maille = 'bureaux' AND voix IS NOT NULL AND split_part(code, '_', 1) IN (${inList})`,
    ),
  ]);

  const candsByCode = new Map<string, BureauCand[]>();
  for (const c of candRows) {
    const arr = candsByCode.get(c.code) ?? [];
    arr.push({ nuance: c.nuance ?? null, voix: Number(c.voix ?? 0) });
    candsByCode.set(c.code, arr);
  }

  return terrRows.map((t) => ({
    code: t.code,
    name: t.libelle?.trim() || `Bureau ${t.code.split("_")[1] ?? t.code}`,
    insee: t.code.split("_")[0] ?? "",
    inscrits: Number(t.inscrits ?? 0),
    exprimes: Number(t.exprimes ?? 0),
    abstentions: Number(t.abstentions ?? 0),
    cands: (candsByCode.get(t.code) ?? []).sort((a, b) => b.voix - a.voix),
  }));
}

export function useCircoBureaux(circo: string | null) {
  return useQuery({
    enabled: !!circo,
    queryKey: ["circo-bureaux", circo],
    queryFn: () => fetchCircoBureaux(circo as string),
    staleTime: 30 * 60 * 1000,
  });
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function pickBlocReason(blocShare: number, deficit: number): TargetReason {
  if (blocShare < 0.06) return "defavorable";
  if (deficit <= 0.005) return "bastion"; // le bloc est en tête
  if (deficit <= 0.07) return "bascule"; // 2e très proche du 1er
  if (deficit <= 0.18) return "conquete"; // en retrait mais atteignable
  return "defavorable";
}

/**
 * Classe les bureaux selon le **positionnement politique** (bloc) :
 * - compétitivité du bloc (proche de gagner) — 45 %
 * - base à mobiliser (part du bloc × abstention) — 35 %
 * - taille (inscrits) — 20 %
 * Sans bloc (« indifférent »), score générique (abstention + marginalité + taille).
 */
export function scoreBureaux(raw: CircoBureauRaw[], blocId: BlocId | null): TargetBureau[] {
  const blocCodes = blocId ? new Set(blocById(blocId).codes) : null;

  const inter = raw.map((b) => {
    const abstentionRate = b.inscrits > 0 ? b.abstentions / b.inscrits : 0;
    const top1 = b.cands[0]?.voix ?? 0;
    const top2 = b.cands[1]?.voix ?? 0;
    const marginPct = b.exprimes > 0 && b.cands.length >= 2 ? (top1 - top2) / b.exprimes : null;
    const winnerNuance = b.cands[0]?.nuance ?? null;
    let blocShare: number | null = null;
    let deficit = 0;
    let competitiveness = 0;
    if (blocCodes && b.exprimes > 0) {
      const blocVoix = b.cands.filter((c) => c.nuance && blocCodes.has(c.nuance)).reduce((s, c) => s + c.voix, 0);
      blocShare = blocVoix / b.exprimes;
      deficit = Math.max(0, top1 / b.exprimes - blocShare);
      competitiveness = blocShare <= 0.02 ? 0 : clamp01(1 - deficit / 0.2);
    }
    return { b, abstentionRate, marginPct, winnerNuance, blocShare, deficit, competitiveness };
  });

  const sizes = inter.map((x) => x.b.inscrits);
  const minS = Math.min(...sizes, 0), maxS = Math.max(...sizes, 1);
  const norm = (v: number, lo: number, hi: number) => (hi > lo ? clamp01((v - lo) / (hi - lo)) : 0);

  const head = (x: (typeof inter)[number]) => ({
    code: x.b.code,
    name: x.b.name,
    insee: x.b.insee,
    inscrits: x.b.inscrits,
    abstentionRate: x.abstentionRate,
    marginPct: x.marginPct,
    winnerNuance: x.winnerNuance,
  });

  if (blocCodes) {
    const maxMob = Math.max(...inter.map((x) => (x.blocShare ?? 0) * x.abstentionRate), 0.0001);
    return inter
      .map((x): TargetBureau => {
        const sizeN = norm(x.b.inscrits, minS, maxS);
        const mobN = ((x.blocShare ?? 0) * x.abstentionRate) / maxMob;
        const priority = Math.round(100 * (0.45 * x.competitiveness + 0.35 * mobN + 0.2 * sizeN));
        return { ...head(x), blocShare: x.blocShare, reason: pickBlocReason(x.blocShare ?? 0, x.deficit), priority };
      })
      .sort((a, b) => b.priority - a.priority);
  }

  const absts = inter.map((x) => x.abstentionRate);
  const minA = Math.min(...absts, 0), maxA = Math.max(...absts, 1);
  const margins = inter.map((x) => x.marginPct).filter((m): m is number => m != null);
  const maxM = margins.length ? Math.max(...margins) : 1;
  return inter
    .map((x): TargetBureau => {
      const abstN = norm(x.abstentionRate, minA, maxA);
      const sizeN = norm(x.b.inscrits, minS, maxS);
      const marginN = x.marginPct == null ? 0 : 1 - norm(x.marginPct, 0, maxM || 1);
      const priority = Math.round(100 * (0.45 * abstN + 0.35 * marginN + 0.2 * sizeN));
      const reason: TargetReason = x.marginPct != null && x.marginPct < 0.05 ? "dispute" : abstN > 0.6 ? "reservoir" : "neutre";
      return { ...head(x), blocShare: null, reason, priority };
    })
    .sort((a, b) => b.priority - a.priority);
}

export type CircoListItem = { code: string; libelle: string };

/** Liste des circonscriptions (code + libellé) pour un sélecteur. */
export function useCircoList() {
  return useQuery({
    queryKey: ["circo-list"],
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    queryFn: async (): Promise<CircoListItem[]> => {
      const url = aggUrl("legis-2024-t1", "territoires", "circonscriptions");
      const rows = await query<{ code: string; libelle: string | null }>(
        `SELECT code, any_value(libelle) AS libelle FROM read_parquet('${url}') WHERE maille = 'circonscriptions' GROUP BY code ORDER BY code`,
      );
      return rows.map((r) => ({ code: String(r.code), libelle: r.libelle ?? String(r.code) }));
    },
  });
}

// ─── Bornes géographiques d'un territoire (pour cadrer une carte) ─────────────

export type LngLatBounds = [number, number, number, number]; // [ouest, sud, est, nord]

type GeoPolygon = { coordinates?: number[][][] };
function bboxFromPolygon(poly: GeoPolygon | null | undefined): LngLatBounds | null {
  const ring = poly?.coordinates?.[0];
  if (!ring || ring.length === 0) return null;
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const pt of ring) {
    const [lng, lat] = pt;
    if (lng < w) w = lng;
    if (lng > e) e = lng;
    if (lat < s) s = lat;
    if (lat > n) n = lat;
  }
  return Number.isFinite(w) ? [w, s, e, n] : null;
}
const unionBounds = (a: LngLatBounds, b: LngLatBounds): LngLatBounds => [
  Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3]),
];

/** Bornes d'un territoire (commune ou circo) via l'API Géo (data.gouv). */
export async function fetchTerritoryBounds(target: { type: string; id: string }): Promise<LngLatBounds | null> {
  try {
    if (target.type === "commune") {
      const r = await fetch(`https://geo.api.gouv.fr/communes/${encodeURIComponent(sanitizeCode(target.id))}?fields=bbox`);
      if (!r.ok) return null;
      const j = (await r.json()) as { bbox?: GeoPolygon };
      return bboxFromPolygon(j.bbox);
    }
    if (target.type === "circo") {
      const communes = new Set(await communesOfCirco(target.id));
      if (communes.size === 0) return null;
      const dept = target.id.slice(0, Math.max(2, target.id.length - 2));
      const r = await fetch(`https://geo.api.gouv.fr/departements/${encodeURIComponent(dept)}/communes?fields=code,bbox`);
      if (!r.ok) return null;
      const arr = (await r.json()) as { code: string; bbox?: GeoPolygon }[];
      let b: LngLatBounds | null = null;
      for (const c of arr) {
        if (!communes.has(c.code)) continue;
        const bb = bboxFromPolygon(c.bbox);
        if (bb) b = b ? unionBounds(b, bb) : bb;
      }
      return b;
    }
  } catch {
    return null;
  }
  return null;
}

export function useTerritoryBounds(target: { type: string; id: string } | null) {
  return useQuery({
    enabled: !!target,
    queryKey: ["territory-bounds", target?.type, target?.id],
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    queryFn: () => fetchTerritoryBounds(target as { type: string; id: string }),
  });
}

/**
 * Regroupe des candidats par nuance (somme des voix). `multiCirco` est vrai si
 * au moins une nuance comptait plusieurs candidats (= plusieurs circonscriptions).
 * Le libellé reste le nom du candidat quand la nuance n'en a qu'un.
 */
function collapseByNuance(
  rawCandidates: ScrutinCandidate[],
  exprimes: number,
): { candidates: ScrutinCandidate[]; multiCirco: boolean } {
  const groups = new Map<string, { nuance: string | null; voix: number; label: string; count: number; elu: boolean }>();
  for (const c of rawCandidates) {
    const key = c.nuance ?? `__${c.label}`;
    const g = groups.get(key);
    if (g) {
      g.voix += c.voix;
      g.count += 1;
      g.elu = g.elu || c.elu;
    } else {
      groups.set(key, { nuance: c.nuance, voix: c.voix, label: c.label, count: 1, elu: c.elu });
    }
  }
  const ordered = [...groups.values()].sort((a, b) => b.voix - a.voix);
  // Signal fiable : le groupe gagnant agrège plusieurs candidatures (≈ la commune
  // relève de plusieurs circonscriptions). Une nuance mineure dédoublée dans une
  // seule circo (candidats dissidents) ne déclenche donc pas le drapeau.
  const multiCirco = (ordered[0]?.count ?? 0) > 1;
  const candidates = ordered.map((g) => ({
    label: g.count === 1 ? g.label : "",
    nuance: g.nuance,
    voix: g.voix,
    pct: exprimes > 0 ? g.voix / exprimes : 0,
    elu: g.elu,
  }));
  return { candidates, multiCirco };
}

export function useScrutinDetail(
  scrutin: Scrutin | null,
  maille: Maille,
  code: string | null,
) {
  return useQuery({
    enabled: !!scrutin && !!code,
    queryKey: ["scrutin-detail", scrutin, maille, code],
    queryFn: (): Promise<ScrutinDetail | null> =>
      scrutin && code ? fetchScrutinDetail(scrutin, maille, code) : Promise.resolve(null),
    staleTime: 30 * 60 * 1000,
  });
}

// ─── Historique d'une circonscription (tous scrutins couvrant la maille) ──────

export type CircoTimelinePoint = ScrutinDetail & { scrutin: Scrutin };

/**
 * Récupère, pour une circonscription donnée, le détail de chaque scrutin
 * disponible à la maille circonscriptions (présidentielles + législatives),
 * en parallèle. Sert la fiche /circo/[code].
 */
export function useCircoHistory(code: string | null) {
  return useQuery({
    enabled: !!code,
    queryKey: ["circo-history", code],
    queryFn: async (): Promise<CircoTimelinePoint[]> => {
      if (!code) return [];
      const scrutins = (Object.keys(SCRUTIN_META) as Scrutin[]).filter(
        (s) => isElection(s) && SCRUTIN_META[s].mailles.includes("circonscriptions"),
      );
      const results = await Promise.all(
        scrutins.map(async (s) => {
          const detail = await fetchScrutinDetail(s, "circonscriptions", code);
          return detail ? { ...detail, scrutin: s } : null;
        }),
      );
      return results.filter((r): r is CircoTimelinePoint => r !== null);
    },
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * Historique d'une commune : chaque scrutin disponible à la maille communes
 * (présidentielles + législatives + municipales), lectures en parallèle.
 * Sert la fiche /commune/[insee].
 */
export function useCommuneHistory(insee: string | null) {
  return useQuery({
    enabled: !!insee,
    queryKey: ["commune-history", insee],
    queryFn: async (): Promise<CircoTimelinePoint[]> => {
      if (!insee) return [];
      const scrutins = (Object.keys(SCRUTIN_META) as Scrutin[]).filter(
        (s) => isElection(s) && SCRUTIN_META[s].mailles.includes("communes"),
      );
      const results = await Promise.all(
        scrutins.map(async (s) => {
          const detail = await fetchScrutinDetail(s, "communes", insee);
          return detail ? { ...detail, scrutin: s } : null;
        }),
      );
      return results.filter((r): r is CircoTimelinePoint => r !== null);
    },
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * Table commune → circonscription(s) législative(s) (MinInt, découpage 2010).
 * Permet d'afficher/lier les circonscriptions d'une commune (multi-circo inclus).
 */
export function useCommuneCircoMap(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["commune-circo-map"],
    queryFn: async (): Promise<Record<string, string[]>> => {
      const res = await fetch("/electoral/commune_circo.json");
      if (!res.ok) throw new Error("Table commune↔circo introuvable");
      return (await res.json()) as Record<string, string[]>;
    },
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
}

/**
 * Historique d'un bureau de vote : chaque scrutin disponible à la maille
 * bureaux (présidentielles 2017/2022, législatives 2022/2024). Sert /bureau/[code].
 */
export function useBureauHistory(code: string | null) {
  return useQuery({
    enabled: !!code,
    queryKey: ["bureau-history", code],
    queryFn: async (): Promise<CircoTimelinePoint[]> => {
      if (!code) return [];
      const scrutins = (Object.keys(SCRUTIN_META) as Scrutin[]).filter(
        (s) => isElection(s) && SCRUTIN_META[s].mailles.includes("bureaux"),
      );
      const results = await Promise.all(
        scrutins.map(async (s) => {
          const detail = await fetchScrutinDetail(s, "bureaux", code);
          return detail ? { ...detail, scrutin: s } : null;
        }),
      );
      return results.filter((r): r is CircoTimelinePoint => r !== null);
    },
    staleTime: 30 * 60 * 1000,
  });
}

/** Participation nationale (métropole) d'un scrutin — pour les comparaisons. */
export function useScrutinNationalParticipation(scrutin: Scrutin | null, enabled = true) {
  return useQuery({
    enabled: enabled && !!scrutin,
    queryKey: ["scrutin-national-participation", scrutin],
    queryFn: async (): Promise<number | null> => {
      if (!scrutin) return null;
      const url = aggUrl(scrutin, "territoires");
      const rows = await query<{ value: number }>(`
        SELECT CAST(SUM(votants) AS DOUBLE) / SUM(inscrits) AS value
        FROM read_parquet('${url}')
        WHERE maille = 'departements' AND inscrits > 0
      `);
      const v = rows[0]?.value;
      return v != null && Number.isFinite(v) ? Number(v) : null;
    },
    staleTime: 60 * 60 * 1000,
  });
}

// ─── Sociologie INSEE (Filosofi 2021, niveau commune) ─────────────────────────

/** Niveau de vie médian (€) par commune — indicateur Filosofi MED_SL. */
export function useRevenuMedianCommune(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["choropleth", "revenu-median-commune"],
    queryFn: async (): Promise<CommuneNumericRow[]> => {
      const url = inseeUrl(FILOSOFI_PARQUET);
      const rows = await query<{ code: string; value: number }>(`
        SELECT code, MED_SL AS value
        FROM read_parquet('${url}')
        WHERE MED_SL IS NOT NULL
      `);
      return rows.map((r) => ({ code: String(r.code), value: Number(r.value) }));
    },
    staleTime: 24 * 60 * 60 * 1000,
  });
}

/** Taux de pauvreté (%, seuil 60% médiane) par commune — indicateur PR_MD60. */
export function useTauxPauvreteCommune(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["choropleth", "taux-pauvrete-commune"],
    queryFn: async (): Promise<CommuneNumericRow[]> => {
      const url = inseeUrl(FILOSOFI_PARQUET);
      const rows = await query<{ code: string; value: number }>(`
        SELECT code, PR_MD60 AS value
        FROM read_parquet('${url}')
        WHERE PR_MD60 IS NOT NULL
      `);
      return rows.map((r) => ({ code: String(r.code), value: Number(r.value) }));
    },
    staleTime: 24 * 60 * 60 * 1000,
  });
}

/** Colonnes Filosofi exposables en choroplèthe (liste blanche — jamais d'entrée libre). */
const SOCIO_COLUMNS = [
  "MED_SL", "PR_MD60", "D1_SL", "D9_SL", "IR_D9_D1_SL",
  "S_RET_PEN_DI", "S_SOC_BEN_DI", "S_EI_DI_UNE", "S_HH_TAX",
] as const;
export type SocioColumn = (typeof SOCIO_COLUMNS)[number];

/** Choroplèthe sociologie générique pour une colonne Filosofi par commune. */
export function useSocioColumnCommune(column: SocioColumn, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["choropleth", "socio", column],
    queryFn: async (): Promise<CommuneNumericRow[]> => {
      const url = inseeUrl(FILOSOFI_PARQUET);
      // Liste blanche : `column` est une union typée, on revérifie par sécurité.
      const col: SocioColumn = SOCIO_COLUMNS.includes(column) ? column : "MED_SL";
      const rows = await query<{ code: string; value: number }>(`
        SELECT code, ${col} AS value
        FROM read_parquet('${url}')
        WHERE ${col} IS NOT NULL
      `);
      return rows.map((r) => ({ code: String(r.code), value: Number(r.value) }));
    },
    staleTime: 24 * 60 * 60 * 1000,
  });
}

const numOrNull = (v: number | null | undefined) => (v != null ? Number(v) : null);

/** Indicateurs sociologie pour une commune (pour la fiche). */
export function useSociologieCommune(code: string | null) {
  return useQuery({
    enabled: !!code,
    queryKey: ["sociologie-commune", code],
    queryFn: async (): Promise<CommuneSociologie | null> => {
      if (!code) return null;
      const url = inseeUrl(FILOSOFI_PARQUET);
      const rows = await query<Record<SocioColumn, number | null> & { code: string }>(
        `
        SELECT code, ${SOCIO_COLUMNS.join(", ")}
        FROM read_parquet('${url}')
        WHERE code = ?
      `,
        [code],
      );
      if (rows.length === 0) return null;
      const r = rows[0];
      return {
        code: String(r.code),
        revenuMedian: numOrNull(r.MED_SL),
        tauxPauvrete: numOrNull(r.PR_MD60),
        decile1: numOrNull(r.D1_SL),
        decile9: numOrNull(r.D9_SL),
        interdecile: numOrNull(r.IR_D9_D1_SL),
        partPensions: numOrNull(r.S_RET_PEN_DI),
        partPrestations: numOrNull(r.S_SOC_BEN_DI),
        partChomage: numOrNull(r.S_EI_DI_UNE),
        menagesImposes: numOrNull(r.S_HH_TAX),
      };
    },
    staleTime: 60 * 60 * 1000,
  });
}

// ─── Dynamiques électorales (Palier 5 — métriques dérivées 2017→2022) ─────────
// Source : electoral/trends/presid_2017_2022.parquet (build-trends.py). Deltas
// signés en taux 0..1 par (maille, code).

export type TrendFile = "presid_2017_2022" | "legis_2022_2024";
const TREND_COLUMNS = [
  "d_abstention", "d_rn", "d_gauche",
  "abst_then", "abst_now", "rn_then", "rn_now", "gauche_then", "gauche_now",
] as const;
export type TrendColumn = (typeof TREND_COLUMNS)[number];

/** Choroplèthe d'une métrique de tendance (fichier × colonne) pour une maille. */
export function useTrendColumn(file: TrendFile, column: TrendColumn, maille: string, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["choropleth", "trend", file, column, maille],
    queryFn: async (): Promise<CommuneNumericRow[]> => {
      const url = parquetUrl(`trends/${file}.parquet`);
      const col: TrendColumn = TREND_COLUMNS.includes(column) ? column : "d_abstention";
      const rows = await query<{ code: string; value: number }>(
        `SELECT code, ${col} AS value FROM read_parquet('${url}') WHERE maille = ? AND ${col} IS NOT NULL`,
        [maille],
      );
      return rows.map((r) => ({ code: String(r.code), value: Number(r.value) }));
    },
    staleTime: 24 * 60 * 60 * 1000,
  });
}

/** Tendances d'un territoire (fiche) : deltas + niveau récent, pour une comparaison. */
export type TerritoireTrends = {
  dAbstention: number | null;
  dRn: number | null;
  dGauche: number | null;
  abstNow: number | null;
  rnNow: number | null;
  gaucheNow: number | null;
};
export function useTrendsTerritoire(file: TrendFile, maille: string | null, code: string | null) {
  return useQuery({
    enabled: !!maille && !!code,
    queryKey: ["trends-territoire", file, maille, code],
    queryFn: async (): Promise<TerritoireTrends | null> => {
      if (!maille || !code) return null;
      const url = parquetUrl(`trends/${file}.parquet`);
      const rows = await query<{
        d_abstention: number | null; d_rn: number | null; d_gauche: number | null;
        abst_now: number | null; rn_now: number | null; gauche_now: number | null;
      }>(
        `SELECT d_abstention, d_rn, d_gauche, abst_now, rn_now, gauche_now
         FROM read_parquet('${url}') WHERE maille = ? AND code = ?`,
        [maille, code],
      );
      if (rows.length === 0) return null;
      const r = rows[0];
      return {
        dAbstention: numOrNull(r.d_abstention),
        dRn: numOrNull(r.d_rn),
        dGauche: numOrNull(r.d_gauche),
        abstNow: numOrNull(r.abst_now),
        rnNow: numOrNull(r.rn_now),
        gaucheNow: numOrNull(r.gauche_now),
      };
    },
    staleTime: 60 * 60 * 1000,
  });
}

// ─── Sociologie au niveau BUREAU DE VOTE (Palier 1 — croisement socio × BV) ───
// Source : bureaux_socio.parquet (généré par build-bureaux-socio.py). La socio
// est portée par la commune du bureau (1ers caractères du code = INSEE) →
// granularité commune, exposée via `grain` pour rester transparent.

const BUREAUX_SOCIO_PARQUET = "bureaux_socio.parquet";

export type BureauSociologie = {
  code: string;
  insee: string;
  grain: string;
  revenuMedian: number | null;
  tauxPauvrete: number | null;
  interdecile: number | null;
  partPensions: number | null;
  partPrestations: number | null;
  part65plus: number | null;
  tauxChomage: number | null;
  partCadres: number | null;
  partOuvriers: number | null;
  partDiplomeSup: number | null;
};

/** Profil socio-démo d'un bureau de vote (porté par sa commune). */
export function useSociologieBureau(code: string | null) {
  return useQuery({
    enabled: !!code,
    queryKey: ["sociologie-bureau", code],
    queryFn: async (): Promise<BureauSociologie | null> => {
      if (!code) return null;
      const url = inseeUrl(BUREAUX_SOCIO_PARQUET);
      const rows = await query<{
        code: string; insee: string; socio_grain: string;
        MED_SL: number | null; PR_MD60: number | null; IR_D9_D1_SL: number | null;
        S_RET_PEN_DI: number | null; S_SOC_BEN_DI: number | null;
        part65plus: number | null; tauxChomage: number | null;
        partCadres: number | null; partOuvriers: number | null; partDiplomeSup: number | null;
      }>(
        `
        SELECT code, insee, socio_grain,
               MED_SL, PR_MD60, IR_D9_D1_SL, S_RET_PEN_DI, S_SOC_BEN_DI,
               part65plus, tauxChomage, partCadres, partOuvriers, partDiplomeSup
        FROM read_parquet('${url}')
        WHERE code = ?
      `,
        [code],
      );
      if (rows.length === 0) return null;
      const r = rows[0];
      return {
        code: String(r.code),
        insee: String(r.insee),
        grain: String(r.socio_grain),
        revenuMedian: numOrNull(r.MED_SL),
        tauxPauvrete: numOrNull(r.PR_MD60),
        interdecile: numOrNull(r.IR_D9_D1_SL),
        partPensions: numOrNull(r.S_RET_PEN_DI),
        partPrestations: numOrNull(r.S_SOC_BEN_DI),
        part65plus: numOrNull(r.part65plus),
        tauxChomage: numOrNull(r.tauxChomage),
        partCadres: numOrNull(r.partCadres),
        partOuvriers: numOrNull(r.partOuvriers),
        partDiplomeSup: numOrNull(r.partDiplomeSup),
      };
    },
    staleTime: 60 * 60 * 1000,
  });
}

// ─── Démographie INSEE (Recensement RP 2022, niveau commune) ──────────────────

export type DemographieCommune = {
  code: string;
  population: number | null;
  part65plus: number | null;
  partMoins15: number | null;
  tauxChomage: number | null;
  partCadres: number | null;
  partOuvriers: number | null;
  partDiplomeSup: number | null;
};

/** Colonnes RP exposables en choroplèthe (liste blanche). */
const RP_COLUMNS = [
  "part65plus", "partMoins15", "tauxChomage",
  "partCadres", "partOuvriers", "partDiplomeSup",
] as const;
export type RpColumn = (typeof RP_COLUMNS)[number];

/** Choroplèthe démographique générique pour une colonne RP par commune. */
export function useRpColumnCommune(column: RpColumn, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["choropleth", "rp", column],
    queryFn: async (): Promise<CommuneNumericRow[]> => {
      const url = inseeUrl(RP_PARQUET);
      const col: RpColumn = RP_COLUMNS.includes(column) ? column : "part65plus";
      const rows = await query<{ code: string; value: number }>(`
        SELECT code, ${col} AS value
        FROM read_parquet('${url}')
        WHERE ${col} IS NOT NULL
      `);
      return rows.map((r) => ({ code: String(r.code), value: Number(r.value) }));
    },
    staleTime: 24 * 60 * 60 * 1000,
  });
}

// ─── Indice de potentiel par bloc (affinité socio + écart au réel) ────────────
export type PotentielBloc = "rn" | "gauche" | "ecolo" | "centre" | "droite";

/** Choroplèthe du potentiel (affinité − réel) d'un bloc, par commune. */
export function usePotentielColumn(bloc: PotentielBloc, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["choropleth", "potentiel", bloc],
    queryFn: async (): Promise<CommuneNumericRow[]> => {
      const url = parquetUrl("potentiel_commune.parquet");
      const col = `pot_${bloc}`;
      const rows = await query<{ code: string; value: number }>(
        `SELECT code, ${col} AS value FROM read_parquet('${url}') WHERE ${col} IS NOT NULL`,
      );
      return rows.map((r) => ({ code: String(r.code), value: Number(r.value) }));
    },
    staleTime: 24 * 60 * 60 * 1000,
  });
}

export type PotentielRow = { bloc: PotentielBloc; affinite: number | null; reel: number | null; potentiel: number | null };
/** Potentiel des 5 blocs pour une commune (fiche). */
export function usePotentielTerritoire(code: string | null) {
  return useQuery({
    enabled: !!code,
    queryKey: ["potentiel-territoire", code],
    queryFn: async (): Promise<PotentielRow[] | null> => {
      if (!code) return null;
      const url = parquetUrl("potentiel_commune.parquet");
      const blocs: PotentielBloc[] = ["rn", "gauche", "ecolo", "centre", "droite"];
      const cols = blocs.flatMap((b) => [`aff_${b}`, `reel_${b}`, `pot_${b}`]).join(", ");
      const rows = await query<Record<string, number | null>>(
        `SELECT ${cols} FROM read_parquet('${url}') WHERE code = ?`,
        [code],
      );
      if (rows.length === 0) return null;
      const r = rows[0];
      return blocs.map((b) => ({
        bloc: b,
        affinite: numOrNull(r[`aff_${b}`]),
        reel: numOrNull(r[`reel_${b}`]),
        potentiel: numOrNull(r[`pot_${b}`]),
      }));
    },
    staleTime: 60 * 60 * 1000,
  });
}

export type PotentielMeta = Record<string, { r2: number; moyenne: number }>;
/** Qualité du modèle (R²) par bloc — pour la transparence. */
export function usePotentielMeta() {
  return useQuery({
    queryKey: ["potentiel-meta"],
    queryFn: async (): Promise<PotentielMeta> => {
      const res = await fetch("/electoral/potentiel_meta.json");
      if (!res.ok) throw new Error("meta potentiel introuvable");
      const j = (await res.json()) as { blocs: PotentielMeta };
      return j.blocs;
    },
    staleTime: 24 * 60 * 60 * 1000,
  });
}

// ─── Logement par commune (Palier 3 — base Comparateur de territoires) ────────
const LOGEMENT_PARQUET = "logement_2022_commune.parquet";
const LOGEMENT_COLUMNS = [
  "partProprietaires", "partLocataires", "partResSecondaires", "partLogVacants",
] as const;
export type LogementColumn = (typeof LOGEMENT_COLUMNS)[number];

/** Choroplèthe d'un indicateur logement par commune (statut d'occupation…). */
export function useLogementColumnCommune(column: LogementColumn, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["choropleth", "logement", column],
    queryFn: async (): Promise<CommuneNumericRow[]> => {
      const url = inseeUrl(LOGEMENT_PARQUET);
      const col: LogementColumn = LOGEMENT_COLUMNS.includes(column) ? column : "partProprietaires";
      const rows = await query<{ code: string; value: number }>(`
        SELECT code, ${col} AS value
        FROM read_parquet('${url}')
        WHERE ${col} IS NOT NULL
      `);
      return rows.map((r) => ({ code: String(r.code), value: Number(r.value) }));
    },
    staleTime: 24 * 60 * 60 * 1000,
  });
}

/** Indicateurs démographiques RP pour une commune (pour la fiche). */
export function useDemographieCommune(code: string | null) {
  return useQuery({
    enabled: !!code,
    queryKey: ["demographie-commune", code],
    queryFn: async (): Promise<DemographieCommune | null> => {
      if (!code) return null;
      const url = inseeUrl(RP_PARQUET);
      const rows = await query<Record<string, number | null> & { code: string }>(
        `
        SELECT code, population, part65plus, partMoins15, tauxChomage,
               partCadres, partOuvriers, partDiplomeSup
        FROM read_parquet('${url}')
        WHERE code = ?
      `,
        [code],
      );
      if (rows.length === 0) return null;
      const r = rows[0];
      return {
        code: String(r.code),
        population: numOrNull(r.population),
        part65plus: numOrNull(r.part65plus),
        partMoins15: numOrNull(r.partMoins15),
        tauxChomage: numOrNull(r.tauxChomage),
        partCadres: numOrNull(r.partCadres),
        partOuvriers: numOrNull(r.partOuvriers),
        partDiplomeSup: numOrNull(r.partDiplomeSup),
      };
    },
    staleTime: 60 * 60 * 1000,
  });
}
