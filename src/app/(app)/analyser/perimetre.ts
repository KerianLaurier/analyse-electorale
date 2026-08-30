import { TERRITORY_LABELS, type TerritoryType } from "@/lib/territory-analysis";

/**
 * Le PÉRIMÈTRE est l'objet central d'Analyser : on le choisit une fois, il vit
 * dans l'URL, et il suit d'une lentille à l'autre.
 *
 * Avant cette refonte, `/analyser` était centré sur un territoire tandis que ses
 * six « outils spécialisés » repartaient chacun d'un état national codé en dur
 * (« Nord », « legis-2024-t1 »), avec leur propre sélecteur et leur propre
 * bouton retour. Choisir un territoire ici n'avait aucun effet là-bas.
 *
 * La France n'est plus un mode à part : c'est simplement le périmètre par
 * défaut. « Sièges marginaux » devient la lentille Ciblage à l'échelle France,
 * « ciblage terrain » la même lentille à l'échelle circonscription.
 */
export type Perimetre =
  | { scope: "france" }
  | { scope: "territoire"; type: TerritoryType; code: string; label: string };

export const FRANCE: Perimetre = { scope: "france" };

export function perimetreLabel(p: Perimetre): string {
  return p.scope === "france" ? "France entière" : p.label;
}

export function perimetreKindLabel(p: Perimetre): string {
  return p.scope === "france" ? "National" : TERRITORY_LABELS[p.type];
}

/** Clé stable pour remonter un composant quand le périmètre change. */
export function perimetreKey(p: Perimetre): string {
  return p.scope === "france" ? "france" : `${p.type}-${p.code}`;
}

const TYPES = new Set<TerritoryType>(["region", "departement", "circo", "commune"]);

/**
 * Lit le périmètre de l'URL. `null` si aucun territoire n'y figure — l'appelant
 * décide alors du défaut (la cible de campagne du QG, sinon la France).
 * Les paramètres `t` / `c` / `l` sont ceux d'avant la refonte : les analyses
 * déjà partagées continuent de s'ouvrir sur le bon territoire.
 */
export function perimetreFromParams(params: URLSearchParams): Perimetre | null {
  const type = params.get("t") as TerritoryType | null;
  const code = params.get("c");
  if (!type || !TYPES.has(type) || !code) return null;
  return { scope: "territoire", type, code, label: params.get("l") ?? code };
}

/** Query string du périmètre — vide pour la France (URL propre par défaut). */
export function perimetreQuery(p: Perimetre): string {
  if (p.scope === "france") return "";
  const q = new URLSearchParams({ t: p.type, c: p.code, l: p.label });
  return `?${q.toString()}`;
}

// ─── Lentilles ────────────────────────────────────────────────────────────────

export type LentilleId = "diagnostic" | "historique" | "sociologie" | "ciblage" | "projection";

export type Lentille = {
  id: LentilleId;
  /** Segment de route ; vide pour la lentille d'accueil (`/analyser`). */
  segment: string;
  label: string;
  /** La question à laquelle la lentille répond, montrée sous l'onglet. */
  question: string;
};

export const LENTILLES: Lentille[] = [
  { id: "diagnostic", segment: "", label: "Diagnostic", question: "Où j’en suis" },
  { id: "historique", segment: "historique", label: "Historique", question: "Comment on en est arrivé là" },
  { id: "sociologie", segment: "sociologie", label: "Sociologie", question: "Qui vote quoi" },
  { id: "ciblage", segment: "ciblage", label: "Ciblage", question: "Où porter l’effort" },
  { id: "projection", segment: "projection", label: "Projection", question: "Ce que donnerait 2027" },
];

export function lentilleHref(l: Lentille, p: Perimetre): string {
  const base = l.segment ? `/analyser/${l.segment}` : "/analyser";
  return `${base}${perimetreQuery(p)}`;
}

/** Lentille correspondant à un chemin (`/analyser/sociologie` → sociologie). */
export function lentilleFromPathname(pathname: string): Lentille {
  const rest = pathname.replace(/^\/analyser\/?/, "").split("/")[0] ?? "";
  return LENTILLES.find((l) => l.segment === rest) ?? LENTILLES[0];
}
