// Codes de nuance politique MinInt (présidentielle + législatives 2024).
// Couleurs adaptées aux conventions cartographiques du ministère de l'Intérieur
// tout en restant lisibles sur un fond clair Positron.

export type NuanceCode =
  | "EXG"
  | "COM"
  | "FI"
  | "SOC"
  | "RDG"
  | "DVG"
  | "ECO"
  | "UG"
  | "REG"
  | "DIV"
  | "DVC"
  | "ENS"
  | "HOR"
  | "UDI"
  | "UDC"
  | "LR"
  | "DVD"
  | "DSV"
  | "RN"
  | "UXD"
  | "REC"
  | "EXD";

type NuanceMeta = { label: string; color: string };

export const NUANCES: Record<NuanceCode, NuanceMeta> = {
  EXG: { label: "Extrême gauche",        color: "#7f1d1d" },
  COM: { label: "Communiste",            color: "#b91c1c" },
  FI:  { label: "La France insoumise",   color: "#dc2626" },
  UG:  { label: "Union de la gauche / NFP", color: "#be123c" },
  SOC: { label: "Socialiste",            color: "#f43f5e" },
  RDG: { label: "Radical de gauche",     color: "#fb7185" },
  ECO: { label: "Écologiste",            color: "#16a34a" },
  DVG: { label: "Divers gauche",         color: "#fda4af" },
  REG: { label: "Régionaliste",          color: "#0d9488" },
  DIV: { label: "Divers",                color: "#9ca3af" },
  DVC: { label: "Divers centre",         color: "#fcd34d" },
  ENS: { label: "Ensemble (majorité)",   color: "#f59e0b" },
  HOR: { label: "Horizons",              color: "#fbbf24" },
  UDI: { label: "UDI",                   color: "#fb923c" },
  UDC: { label: "Union du centre",       color: "#fbbf24" },
  LR:  { label: "Les Républicains",      color: "#1e40af" },
  DVD: { label: "Divers droite",         color: "#60a5fa" },
  DSV: { label: "Droite souverainiste",  color: "#1e293b" },
  RN:  { label: "Rassemblement National", color: "#1c1917" },
  UXD: { label: "Union de l'extrême droite", color: "#3f3f46" },
  REC: { label: "Reconquête",            color: "#525252" },
  EXD: { label: "Extrême droite",        color: "#27272a" },
};

const FALLBACK_COLOR = "#cbd5e1";

export function nuanceColor(code: string | null | undefined): string {
  if (!code) return FALLBACK_COLOR;
  const cfg = NUANCES[code as NuanceCode];
  return cfg ? cfg.color : FALLBACK_COLOR;
}

/**
 * Mapping candidat présidentielle 2022 (nom de famille tel que publié par
 * MinInt) → nuance politique. Permet de réutiliser la palette + match expression
 * existante pour la couche "vote dominant prés. 2022".
 */
export const PRESID_2022_NUANCE: Record<string, NuanceCode> = {
  ARTHAUD: "EXG",
  POUTOU: "EXG",
  ROUSSEL: "COM",
  MÉLENCHON: "FI",
  HIDALGO: "SOC",
  JADOT: "ECO",
  MACRON: "ENS",
  LASSALLE: "REG",
  PÉCRESSE: "LR",
  "DUPONT-AIGNAN": "DSV",
  "LE PEN": "RN",
  ZEMMOUR: "REC",
};

export function presid2022Nuance(nom: string | null | undefined): NuanceCode | null {
  if (!nom) return null;
  return PRESID_2022_NUANCE[nom.toUpperCase().trim()] ?? null;
}

export function nuanceLabel(code: string | null | undefined): string {
  if (!code) return "—";
  const cfg = NUANCES[code as NuanceCode];
  return cfg ? cfg.label : code;
}

/** Renvoie l'expression MapLibre `match` pour colorer par nuance. */
export function buildNuanceMatchExpression(): unknown[] {
  const entries: unknown[] = [];
  for (const [code, meta] of Object.entries(NUANCES)) {
    entries.push(code, meta.color);
  }
  return ["match", ["feature-state", "nuance"], ...entries, FALLBACK_COLOR];
}
