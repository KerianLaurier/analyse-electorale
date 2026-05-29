// Codes de nuance politique MinInt (présidentielle + législatives 2024).
// Couleurs adaptées aux conventions cartographiques du ministère de l'Intérieur
// tout en restant lisibles sur un fond clair Positron.

export type NuanceCode =
  | "EXG"
  | "DXG"
  | "COM"
  | "FI"
  | "SOC"
  | "RDG"
  | "DVG"
  | "ECO"
  | "UG"
  | "NUP"
  | "VEC"
  | "REG"
  | "DIV"
  | "DVC"
  | "ENS"
  | "MDM"
  | "HOR"
  | "UDI"
  | "UDC"
  | "UC"
  | "LR"
  | "DLF"
  | "DVD"
  | "DSV"
  | "RN"
  | "UXD"
  | "REC"
  | "EXD"
  // Municipales (nuances de liste — codes MinInt préfixés L)
  | "LEXG"
  | "LCOM"
  | "LFI"
  | "LUG"
  | "LSOC"
  | "LDVG"
  | "LECO"
  | "LVEC"
  | "LREG"
  | "LDIV"
  | "LREN"
  | "LMDM"
  | "LUDI"
  | "LUC"
  | "LDVC"
  | "LHOR"
  | "LLR"
  | "LUD"
  | "LUDR"
  | "LDVD"
  | "LDSV"
  | "LREC"
  | "LRN"
  | "LUXD"
  | "LEXD";

type NuanceMeta = { label: string; color: string };

export const NUANCES: Record<NuanceCode, NuanceMeta> = {
  EXG: { label: "Extrême gauche",        color: "#7f1d1d" },
  DXG: { label: "Divers extrême gauche", color: "#991b1b" },
  COM: { label: "Communiste",            color: "#b91c1c" },
  FI:  { label: "La France insoumise",   color: "#dc2626" },
  UG:  { label: "Union de la gauche / NFP", color: "#be123c" },
  NUP: { label: "Nouvelle Union Populaire (NUPES)", color: "#be123c" },
  SOC: { label: "Socialiste",            color: "#f43f5e" },
  RDG: { label: "Radical de gauche",     color: "#fb7185" },
  ECO: { label: "Écologiste",            color: "#16a34a" },
  VEC: { label: "Les Écologistes",       color: "#16a34a" },
  DVG: { label: "Divers gauche",         color: "#fda4af" },
  REG: { label: "Régionaliste",          color: "#0d9488" },
  DIV: { label: "Divers",                color: "#9ca3af" },
  DVC: { label: "Divers centre",         color: "#fcd34d" },
  ENS: { label: "Ensemble (majorité)",   color: "#f59e0b" },
  MDM: { label: "Modem",                 color: "#f97316" },
  HOR: { label: "Horizons",              color: "#fbbf24" },
  UDI: { label: "UDI",                   color: "#fb923c" },
  UDC: { label: "Union du centre",       color: "#fbbf24" },
  UC:  { label: "Union du centre",       color: "#fbbf24" },
  LR:  { label: "Les Républicains",      color: "#1e40af" },
  DLF: { label: "Debout la France",      color: "#334155" },
  DVD: { label: "Divers droite",         color: "#60a5fa" },
  DSV: { label: "Droite souverainiste",  color: "#1e293b" },
  // Extrême droite : famille bleu marine (RN = bleu marine de référence)
  RN:  { label: "Rassemblement National", color: "#13294b" },
  UXD: { label: "Union de l'extrême droite", color: "#243b66" },
  REC: { label: "Reconquête",            color: "#33405c" },
  EXD: { label: "Extrême droite",        color: "#0b1a33" },
  // Municipales — nuances de liste (mêmes familles, codes MinInt préfixés L)
  LEXG: { label: "Liste extrême gauche",  color: "#7f1d1d" },
  LCOM: { label: "Liste communiste",      color: "#b91c1c" },
  LFI:  { label: "Liste France insoumise", color: "#dc2626" },
  LUG:  { label: "Liste union de la gauche", color: "#be123c" },
  LSOC: { label: "Liste socialiste",      color: "#f43f5e" },
  LDVG: { label: "Liste divers gauche",   color: "#fda4af" },
  LECO: { label: "Liste écologiste",      color: "#16a34a" },
  LVEC: { label: "Liste écologiste",      color: "#16a34a" },
  LREG: { label: "Liste régionaliste",    color: "#0d9488" },
  LDIV: { label: "Liste divers",          color: "#9ca3af" },
  LREN: { label: "Liste Renaissance (majorité)", color: "#f59e0b" },
  LMDM: { label: "Liste Modem",           color: "#f97316" },
  LUDI: { label: "Liste UDI",             color: "#fb923c" },
  LUC:  { label: "Liste union du centre", color: "#fbbf24" },
  LDVC: { label: "Liste divers centre",   color: "#fcd34d" },
  LHOR: { label: "Liste Horizons",        color: "#fbbf24" },
  LLR:  { label: "Liste Les Républicains", color: "#1e40af" },
  LUD:  { label: "Liste union de la droite", color: "#3b82f6" },
  LUDR: { label: "Liste Union des droites (UDR)", color: "#1e3a8a" },
  LDVD: { label: "Liste divers droite",   color: "#60a5fa" },
  LDSV: { label: "Liste droite souverainiste", color: "#1e293b" },
  // Extrême droite (listes) : famille bleu marine
  LREC: { label: "Liste Reconquête",      color: "#33405c" },
  LRN:  { label: "Liste Rassemblement National", color: "#13294b" },
  LUXD: { label: "Liste union de l'extrême droite", color: "#243b66" },
  LEXD: { label: "Liste extrême droite",  color: "#0b1a33" },
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

/** Mapping candidat présidentielle 2017 (nom MinInt) → nuance politique. */
export const PRESID_2017_NUANCE: Record<string, NuanceCode> = {
  ARTHAUD: "EXG",
  POUTOU: "EXG",
  "DUPONT-AIGNAN": "DSV",
  "LE PEN": "RN",
  MACRON: "ENS",
  HAMON: "SOC",
  ASSELINEAU: "DSV",
  LASSALLE: "REG",
  MÉLENCHON: "FI",
  CHEMINADE: "DIV",
  FILLON: "LR",
};

export function presid2017Nuance(nom: string | null | undefined): NuanceCode | null {
  if (!nom) return null;
  return PRESID_2017_NUANCE[nom.toUpperCase().trim()] ?? null;
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
