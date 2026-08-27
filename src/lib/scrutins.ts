/**
 * Catalogue des scrutins — module ISOMORPHE (aucune directive "use client",
 * aucun import de `next/navigation`).
 *
 * Il vit séparé de `url-state.ts` parce que ces constantes sont lues aussi bien
 * par des composants clients que par le préfetch SERVEUR des fiches
 * (commune / circo / bureau, via `queries.ts`). Tant qu'il vivait dans un module
 * marqué "use client", le serveur n'en recevait qu'une référence client :
 * `Object.keys(SCRUTIN_META)` y valait 0, le préfetch itérait sur une liste de
 * scrutins vide et déshydratait un historique vide en statut « succès » — d'où
 * des fiches « Aucune donnée ». Ne pas y ajouter de hook.
 */
import type { Maille } from "@/lib/map-config";

// ─── Scrutins disponibles ─────────────────────────────────────────────────────
// L'identifiant correspond directement au nom des Parquet agrégés
// (public/electoral/agg/{scrutin}_territoires.parquet & _candidats.parquet).

export type Scrutin =
  | "presid-2017-t1"
  | "presid-2017-t2"
  | "presid-2022-t1"
  | "presid-2022-t2"
  | "legis-2017-t1"
  | "legis-2017-t2"
  | "legis-2022-t1"
  | "legis-2022-t2"
  | "legis-2024-t1"
  | "legis-2024-t2"
  | "euro-2019-t1"
  | "euro-2024-t1"
  | "municipales-2020-t1"
  | "municipales-2020-t2"
  | "municipales-2026-t1"
  | "municipales-2026-t2"
  | "sociologie"
  | "tendances"
  | "potentiel";

export type Coloration =
  | "vainqueur"
  | "participation"
  | "abstention"
  | "bloc-gauche"
  | "bloc-ecolo"
  | "bloc-centre"
  | "bloc-droite"
  | "bloc-rn"
  | "revenu"
  | "pauvrete"
  | "inegalites"
  | "prestations"
  | "pensions"
  | "age65"
  | "chomage"
  | "cadres"
  | "diplome"
  | "ouvriers"
  | "densite"
  | "jeunes"
  | "evopop"
  | "proprietaires"
  | "ressecondaires"
  | "logvacants"
  | "monoparentales"
  | "personnes-seules"
  | "nouveaux-arrivants"
  | "evo-abstention"
  | "dynamique-rn"
  | "dynamique-gauche"
  | "legis-abstention"
  | "legis-rn"
  | "legis-gauche"
  | "pot-rn"
  | "pot-gauche"
  | "pot-ecolo"
  | "pot-centre"
  | "pot-droite";

export type ScrutinFamily =
  | "presidentielle"
  | "legislative"
  | "europeenne"
  | "municipale"
  | "sociologie"
  | "tendances"
  | "potentiel";

type ScrutinMeta = {
  short: string;
  long: string;
  family: ScrutinFamily;
  mailles: Maille[];
};

// Scrutins disposant de résultats par bureau de vote (agrégats `*_bureaux_*`).
const WITH_BUREAUX: Maille[] = ["regions", "departements", "circonscriptions", "communes", "bureaux"];
// Européennes et municipales : pas de circonscription législative (l'une est un
// scrutin national de liste, l'autre élit un conseil municipal), mais résultats
// par bureau de vote disponibles.
const NO_CIRCO_BUREAUX: Maille[] = ["regions", "departements", "communes", "bureaux"];

export const SCRUTIN_META: Record<Scrutin, ScrutinMeta> = {
  "presid-2017-t1": { short: "Prés. 2017 · T1", long: "PRÉSIDENTIELLE 2017 · 1ER TOUR", family: "presidentielle", mailles: WITH_BUREAUX },
  "presid-2017-t2": { short: "Prés. 2017 · T2", long: "PRÉSIDENTIELLE 2017 · 2ND TOUR", family: "presidentielle", mailles: WITH_BUREAUX },
  "presid-2022-t1": { short: "Prés. 2022 · T1", long: "PRÉSIDENTIELLE 2022 · 1ER TOUR", family: "presidentielle", mailles: WITH_BUREAUX },
  "presid-2022-t2": { short: "Prés. 2022 · T2", long: "PRÉSIDENTIELLE 2022 · 2ND TOUR", family: "presidentielle", mailles: WITH_BUREAUX },
  "legis-2017-t1": { short: "Légis. 2017 · T1", long: "LÉGISLATIVES 2017 · 1ER TOUR", family: "legislative", mailles: WITH_BUREAUX },
  "legis-2017-t2": { short: "Légis. 2017 · T2", long: "LÉGISLATIVES 2017 · 2ND TOUR", family: "legislative", mailles: WITH_BUREAUX },
  "legis-2022-t1": { short: "Légis. 2022 · T1", long: "LÉGISLATIVES 2022 · 1ER TOUR", family: "legislative", mailles: WITH_BUREAUX },
  "legis-2022-t2": { short: "Légis. 2022 · T2", long: "LÉGISLATIVES 2022 · 2ND TOUR", family: "legislative", mailles: WITH_BUREAUX },
  "legis-2024-t1": { short: "Légis. 2024 · T1", long: "LÉGISLATIVES 2024 · 1ER TOUR", family: "legislative", mailles: WITH_BUREAUX },
  "legis-2024-t2": { short: "Légis. 2024 · T2", long: "LÉGISLATIVES 2024 · 2ND TOUR", family: "legislative", mailles: WITH_BUREAUX },
  "euro-2019-t1": { short: "Europ. 2019", long: "EUROPÉENNES 2019", family: "europeenne", mailles: NO_CIRCO_BUREAUX },
  "euro-2024-t1": { short: "Europ. 2024", long: "EUROPÉENNES 2024", family: "europeenne", mailles: NO_CIRCO_BUREAUX },
  "municipales-2020-t1": { short: "Municip. 2020 · T1", long: "MUNICIPALES 2020 · 1ER TOUR", family: "municipale", mailles: NO_CIRCO_BUREAUX },
  "municipales-2020-t2": { short: "Municip. 2020 · T2", long: "MUNICIPALES 2020 · 2ND TOUR", family: "municipale", mailles: NO_CIRCO_BUREAUX },
  "municipales-2026-t1": { short: "Municip. 2026 · T1", long: "MUNICIPALES 2026 · 1ER TOUR", family: "municipale", mailles: NO_CIRCO_BUREAUX },
  "municipales-2026-t2": { short: "Municip. 2026 · T2", long: "MUNICIPALES 2026 · 2ND TOUR", family: "municipale", mailles: NO_CIRCO_BUREAUX },
  "sociologie": { short: "Sociologie", long: "INSEE FILOSOFI 2021", family: "sociologie", mailles: ["communes"] },
  "tendances": { short: "Tendances", long: "DYNAMIQUES PRÉSIDENTIELLES 2017 → 2022", family: "tendances", mailles: ["regions", "departements", "circonscriptions", "communes"] },
  "potentiel": { short: "Potentiel", long: "POTENTIEL PAR BLOC (AFFINITÉ SOCIO − RÉEL)", family: "potentiel", mailles: ["communes"] },
};

/** Conservé pour compatibilité : { short, long } par scrutin. */
export const SCRUTIN_LABELS: Record<Scrutin, { short: string; long: string }> =
  Object.fromEntries(
    Object.entries(SCRUTIN_META).map(([k, v]) => [k, { short: v.short, long: v.long }]),
  ) as Record<Scrutin, { short: string; long: string }>;

export const COLORATION_LABELS: Record<Coloration, string> = {
  vainqueur: "Vainqueur",
  participation: "Participation",
  abstention: "Abstention",
  "bloc-gauche": "Score gauche / NFP",
  "bloc-ecolo": "Score écologistes",
  "bloc-centre": "Score centre / majorité",
  "bloc-droite": "Score droite (LR)",
  "bloc-rn": "Score RN / ext. droite",
  revenu: "Revenu médian",
  pauvrete: "Taux de pauvreté",
  inegalites: "Inégalités (D9/D1)",
  prestations: "Prestations sociales",
  pensions: "Pensions / retraites",
  age65: "Part des 65 ans +",
  chomage: "Taux de chômage",
  cadres: "Part de cadres",
  diplome: "Diplômés du supérieur",
  ouvriers: "Part d'ouvriers",
  densite: "Densité de population",
  jeunes: "Part des 15-29 ans",
  evopop: "Évolution de population 2016 → 2022",
  proprietaires: "Part de propriétaires",
  ressecondaires: "Résidences secondaires",
  logvacants: "Logements vacants",
  monoparentales: "Familles monoparentales",
  "personnes-seules": "Personnes seules",
  "nouveaux-arrivants": "Nouveaux arrivants (1 an)",
  "evo-abstention": "Abstention · présid. 17→22",
  "dynamique-rn": "RN / ext. droite · présid. 17→22",
  "dynamique-gauche": "Gauche / NFP · présid. 17→22",
  "legis-abstention": "Abstention · légis. 22→24",
  "legis-rn": "RN / ext. droite · légis. 22→24",
  "legis-gauche": "Gauche / NFP · légis. 22→24",
  "pot-rn": "Potentiel RN / ext. droite",
  "pot-gauche": "Potentiel gauche / NFP",
  "pot-ecolo": "Potentiel écologistes",
  "pot-centre": "Potentiel centre",
  "pot-droite": "Potentiel droite (LR)",
};

export function isElection(scrutin: Scrutin): boolean {
  return scrutin !== "sociologie" && scrutin !== "tendances" && scrutin !== "potentiel";
}

// ─── Catalogue des scrutins (sélection à deux niveaux : type → année → tour) ──

export const FAMILY_ORDER: ScrutinFamily[] = [
  "presidentielle",
  "legislative",
  "europeenne",
  "municipale",
  "sociologie",
  "tendances",
  "potentiel",
];

export const FAMILY_LABELS: Record<ScrutinFamily, string> = {
  presidentielle: "Présidentielle",
  legislative: "Législatives",
  europeenne: "Européennes",
  municipale: "Municipales",
  sociologie: "Sociologie",
  tendances: "Tendances",
  potentiel: "Potentiel",
};

const ALL_SCRUTINS = Object.keys(SCRUTIN_META) as Scrutin[];

export type ParsedScrutin = { family: ScrutinFamily; year: number | null; tour: 1 | 2 | null };

/** Décompose un identifiant de scrutin (« presid-2022-t1 » → 2022 / T1). */
export function parseScrutin(s: Scrutin): ParsedScrutin {
  const m = /(\d{4})-t(\d)$/.exec(s);
  return {
    family: SCRUTIN_META[s].family,
    year: m ? Number(m[1]) : null,
    tour: m ? (Number(m[2]) as 1 | 2) : null,
  };
}

/** Années disponibles pour une famille (décroissant). */
export function yearsFor(family: ScrutinFamily): number[] {
  const years = new Set<number>();
  for (const s of ALL_SCRUTINS) {
    if (SCRUTIN_META[s].family !== family) continue;
    const { year } = parseScrutin(s);
    if (year != null) years.add(year);
  }
  return [...years].sort((a, b) => b - a);
}

/** Tours disponibles pour une famille × année (croissant). */
export function toursFor(family: ScrutinFamily, year: number): (1 | 2)[] {
  const tours: (1 | 2)[] = [];
  for (const s of ALL_SCRUTINS) {
    const p = parseScrutin(s);
    if (p.family === family && p.year === year && p.tour) tours.push(p.tour);
  }
  return tours.sort();
}

/** Identifiant de scrutin pour une combinaison famille × année × tour. */
export function scrutinFor(family: ScrutinFamily, year: number, tour: 1 | 2): Scrutin | null {
  return (
    ALL_SCRUTINS.find((s) => {
      const p = parseScrutin(s);
      return p.family === family && p.year === year && p.tour === tour;
    }) ?? null
  );
}

/** Scrutin par défaut d'une famille : année la plus récente, 1er tour. */
export function defaultScrutinFor(family: ScrutinFamily): Scrutin {
  if (family === "sociologie") return "sociologie";
  if (family === "tendances") return "tendances";
  if (family === "potentiel") return "potentiel";
  const year = yearsFor(family)[0];
  return scrutinFor(family, year, 1) ?? scrutinFor(family, year, 2) ?? "presid-2022-t1";
}

/** Colorations proposées pour un scrutin donné. */
export function colorationsFor(scrutin: Scrutin): Coloration[] {
  if (scrutin === "sociologie")
    return [
      "revenu", "pauvrete", "inegalites", "prestations", "pensions",
      "age65", "jeunes", "chomage", "cadres", "ouvriers", "diplome",
      "densite", "evopop",
      "proprietaires", "ressecondaires", "logvacants",
      "monoparentales", "personnes-seules", "nouveaux-arrivants",
    ];
  if (scrutin === "tendances")
    return [
      "evo-abstention", "dynamique-rn", "dynamique-gauche",
      "legis-abstention", "legis-rn", "legis-gauche",
    ];
  if (scrutin === "potentiel")
    return ["pot-rn", "pot-gauche", "pot-ecolo", "pot-centre", "pot-droite"];
  return [
    "vainqueur", "participation", "abstention",
    "bloc-gauche", "bloc-ecolo", "bloc-centre", "bloc-droite", "bloc-rn",
  ];
}

/** Clé de la part de bloc dans les fichiers choro figés ({scrutin}_{maille}.json). */
export const BLOC_METRIC_KEYS = {
  "bloc-gauche": "bloc_gauche",
  "bloc-ecolo": "bloc_ecolo",
  "bloc-centre": "bloc_centre",
  "bloc-droite": "bloc_droite",
  "bloc-rn": "bloc_rn",
} as const satisfies Partial<Record<Coloration, string>>;

export type BlocMetricKey = (typeof BLOC_METRIC_KEYS)[keyof typeof BLOC_METRIC_KEYS];

/** Mailles couvertes par les données d'un scrutin. */
export function maillesFor(scrutin: Scrutin): Maille[] {
  return SCRUTIN_META[scrutin].mailles;
}

// ─── Frise chronologique ──────────────────────────────────────────────────────

/**
 * Tous les scrutins dans l'ordre où ils ont eu lieu (ancien → récent).
 *
 * Source unique de vérité : les fiches (commune, circonscription, bureau) et le
 * comparateur en gardaient chacun leur copie, et ces copies dérivaient — les
 * européennes n'apparaissaient nulle part alors que leurs données sont là
 * depuis longtemps, les législatives 2017 non plus, et la présidentielle 2022
 * (avril) était affichée APRÈS les législatives 2022 (juin) par endroits.
 * L'ordre ne se déduit pas de l'identifiant : à année égale il dépend des dates
 * réelles du scrutin, d'où cette liste explicite. Un test vérifie qu'aucune
 * élection du catalogue n'y manque.
 */
export const SCRUTINS_CHRONO: Scrutin[] = [
  "presid-2017-t1", "presid-2017-t2",   // avril / mai 2017
  "legis-2017-t1", "legis-2017-t2",     // juin 2017
  "euro-2019-t1",                       // mai 2019
  "municipales-2020-t1", "municipales-2020-t2", // mars / juin 2020
  "presid-2022-t1", "presid-2022-t2",   // avril 2022
  "legis-2022-t1", "legis-2022-t2",     // juin 2022
  "euro-2024-t1",                       // juin 2024
  "legis-2024-t1", "legis-2024-t2",     // juin / juillet 2024
  "municipales-2026-t1", "municipales-2026-t2", // mars 2026
];

/** Scrutins couvrant une maille donnée, dans l'ordre chronologique. */
export function chronoFor(maille: Maille): Scrutin[] {
  return SCRUTINS_CHRONO.filter((s) => SCRUTIN_META[s].mailles.includes(maille));
}

/** Familles présentes dans une liste de scrutins, dans l'ordre du catalogue. */
export function familiesOf(scrutins: Scrutin[]): { family: ScrutinFamily; label: string }[] {
  const present = new Set(scrutins.map((s) => SCRUTIN_META[s].family));
  return FAMILY_ORDER.filter((f) => present.has(f)).map((f) => ({
    family: f,
    label: FAMILY_LABELS[f],
  }));
}
