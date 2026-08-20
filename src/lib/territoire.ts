import type { CampaignTarget } from "@/lib/campaign";

/**
 * Contexte territorial dérivé de la cible de campagne du QG : département,
 * circonscription (→ député en exercice), libellé court.
 */

/** Noms des départements (référentiel INSEE, stable). */
export const DEPT_NAMES: Record<string, string> = {
  "01": "Ain", "02": "Aisne", "03": "Allier", "04": "Alpes-de-Haute-Provence",
  "05": "Hautes-Alpes", "06": "Alpes-Maritimes", "07": "Ardèche", "08": "Ardennes",
  "09": "Ariège", "10": "Aube", "11": "Aude", "12": "Aveyron",
  "13": "Bouches-du-Rhône", "14": "Calvados", "15": "Cantal", "16": "Charente",
  "17": "Charente-Maritime", "18": "Cher", "19": "Corrèze", "2A": "Corse-du-Sud",
  "2B": "Haute-Corse", "21": "Côte-d'Or", "22": "Côtes-d'Armor", "23": "Creuse",
  "24": "Dordogne", "25": "Doubs", "26": "Drôme", "27": "Eure",
  "28": "Eure-et-Loir", "29": "Finistère", "30": "Gard", "31": "Haute-Garonne",
  "32": "Gers", "33": "Gironde", "34": "Hérault", "35": "Ille-et-Vilaine",
  "36": "Indre", "37": "Indre-et-Loire", "38": "Isère", "39": "Jura",
  "40": "Landes", "41": "Loir-et-Cher", "42": "Loire", "43": "Haute-Loire",
  "44": "Loire-Atlantique", "45": "Loiret", "46": "Lot", "47": "Lot-et-Garonne",
  "48": "Lozère", "49": "Maine-et-Loire", "50": "Manche", "51": "Marne",
  "52": "Haute-Marne", "53": "Mayenne", "54": "Meurthe-et-Moselle", "55": "Meuse",
  "56": "Morbihan", "57": "Moselle", "58": "Nièvre", "59": "Nord",
  "60": "Oise", "61": "Orne", "62": "Pas-de-Calais", "63": "Puy-de-Dôme",
  "64": "Pyrénées-Atlantiques", "65": "Hautes-Pyrénées", "66": "Pyrénées-Orientales",
  "67": "Bas-Rhin", "68": "Haut-Rhin", "69": "Rhône", "70": "Haute-Saône",
  "71": "Saône-et-Loire", "72": "Sarthe", "73": "Savoie", "74": "Haute-Savoie",
  "75": "Paris", "76": "Seine-Maritime", "77": "Seine-et-Marne", "78": "Yvelines",
  "79": "Deux-Sèvres", "80": "Somme", "81": "Tarn", "82": "Tarn-et-Garonne",
  "83": "Var", "84": "Vaucluse", "85": "Vendée", "86": "Vienne",
  "87": "Haute-Vienne", "88": "Vosges", "89": "Yonne", "90": "Territoire de Belfort",
  "91": "Essonne", "92": "Hauts-de-Seine", "93": "Seine-Saint-Denis",
  "94": "Val-de-Marne", "95": "Val-d'Oise",
  "971": "Guadeloupe", "972": "Martinique", "973": "Guyane", "974": "La Réunion",
  "975": "Saint-Pierre-et-Miquelon", "976": "Mayotte", "977": "Saint-Barthélemy",
  "978": "Saint-Martin", "986": "Wallis-et-Futuna", "987": "Polynésie française",
  "988": "Nouvelle-Calédonie", "99": "Français de l'étranger",
};

/** Code département depuis un code INSEE commune (gère Corse 2A/2B et outre-mer). */
export function deptFromInsee(insee: string): string | null {
  if (!insee || insee.length < 2) return null;
  if (insee.startsWith("97") || insee.startsWith("98")) return insee.slice(0, 3);
  return insee.slice(0, 2).toUpperCase();
}

/** Code département depuis un code circonscription (« 1507 » → « 15 », « 97101 » → « 971 »). */
export function deptFromCirco(circo: string): string | null {
  if (!circo || circo.length < 3) return null;
  return circo.slice(0, circo.length - 2).toUpperCase();
}

/**
 * Complément de nom d'un département, article contracté inclus : « de l'Hérault »,
 * « du Rhône », « de la Drôme », « des Landes », « de Paris ».
 *
 * Table explicite plutôt que règle dérivée du nom : le genre et le nombre des
 * départements français ne se devinent pas de façon fiable (le Nord / la Somme /
 * les Landes / l'Aisne), et un « de le Rhône » se remarque immédiatement.
 */
export const DEPT_OF: Record<string, string> = {
  "01": "de l'Ain", "02": "de l'Aisne", "03": "de l'Allier",
  "04": "des Alpes-de-Haute-Provence", "05": "des Hautes-Alpes", "06": "des Alpes-Maritimes",
  "07": "de l'Ardèche", "08": "des Ardennes", "09": "de l'Ariège",
  "10": "de l'Aube", "11": "de l'Aude", "12": "de l'Aveyron",
  "13": "des Bouches-du-Rhône", "14": "du Calvados", "15": "du Cantal",
  "16": "de la Charente", "17": "de la Charente-Maritime", "18": "du Cher",
  "19": "de la Corrèze", "2A": "de la Corse-du-Sud", "2B": "de la Haute-Corse",
  "21": "de la Côte-d'Or", "22": "des Côtes-d'Armor", "23": "de la Creuse",
  "24": "de la Dordogne", "25": "du Doubs", "26": "de la Drôme",
  "27": "de l'Eure", "28": "d'Eure-et-Loir", "29": "du Finistère",
  "30": "du Gard", "31": "de la Haute-Garonne", "32": "du Gers",
  "33": "de la Gironde", "34": "de l'Hérault", "35": "d'Ille-et-Vilaine",
  "36": "de l'Indre", "37": "d'Indre-et-Loire", "38": "de l'Isère",
  "39": "du Jura", "40": "des Landes", "41": "de Loir-et-Cher",
  "42": "de la Loire", "43": "de la Haute-Loire", "44": "de la Loire-Atlantique",
  "45": "du Loiret", "46": "du Lot", "47": "de Lot-et-Garonne",
  "48": "de la Lozère", "49": "de Maine-et-Loire", "50": "de la Manche",
  "51": "de la Marne", "52": "de la Haute-Marne", "53": "de la Mayenne",
  "54": "de Meurthe-et-Moselle", "55": "de la Meuse", "56": "du Morbihan",
  "57": "de la Moselle", "58": "de la Nièvre", "59": "du Nord",
  "60": "de l'Oise", "61": "de l'Orne", "62": "du Pas-de-Calais",
  "63": "du Puy-de-Dôme", "64": "des Pyrénées-Atlantiques", "65": "des Hautes-Pyrénées",
  "66": "des Pyrénées-Orientales", "67": "du Bas-Rhin", "68": "du Haut-Rhin",
  "69": "du Rhône", "70": "de la Haute-Saône", "71": "de Saône-et-Loire",
  "72": "de la Sarthe", "73": "de la Savoie", "74": "de la Haute-Savoie",
  "75": "de Paris", "76": "de la Seine-Maritime", "77": "de Seine-et-Marne",
  "78": "des Yvelines", "79": "des Deux-Sèvres", "80": "de la Somme",
  "81": "du Tarn", "82": "de Tarn-et-Garonne", "83": "du Var",
  "84": "du Vaucluse", "85": "de la Vendée", "86": "de la Vienne",
  "87": "de la Haute-Vienne", "88": "des Vosges", "89": "de l'Yonne",
  "90": "du Territoire de Belfort", "91": "de l'Essonne", "92": "des Hauts-de-Seine",
  "93": "de la Seine-Saint-Denis", "94": "du Val-de-Marne", "95": "du Val-d'Oise",
  "971": "de la Guadeloupe", "972": "de la Martinique", "973": "de la Guyane",
  "974": "de La Réunion", "975": "de Saint-Pierre-et-Miquelon", "976": "de Mayotte",
  "977": "de Saint-Barthélemy", "978": "de Saint-Martin", "986": "de Wallis-et-Futuna",
  "987": "de Polynésie française", "988": "de Nouvelle-Calédonie",
  "99": "des Français de l'étranger",
};

/**
 * Circonscriptions d'outre-mer et des Français de l'étranger : le ministère de
 * l'Intérieur ne les code PAS avec le numéro de département mais avec un préfixe
 * alphabétique (« ZD03 » = 3ᵉ de La Réunion). Sans cette table, `deptFromCirco`
 * renvoie « ZD », absent de DEPT_NAMES, et la circonscription s'affiche sans
 * territoire — soit 38 des 577 sièges.
 *
 * Attribution vérifiée par recoupement avec commune_circo.json (nombre de
 * communes ET nombre de sièges par zone).
 */
const CIRCO_ZONES: Record<string, { name: string; of: string }> = {
  ZA: { name: "Guadeloupe", of: "de la Guadeloupe" }, // 32 communes, 4 sièges
  ZB: { name: "Martinique", of: "de la Martinique" }, // 34 communes, 4 sièges
  ZC: { name: "Guyane", of: "de la Guyane" }, // 22 communes, 2 sièges
  ZD: { name: "La Réunion", of: "de La Réunion" }, // 24 communes, 7 sièges
  ZM: { name: "Mayotte", of: "de Mayotte" }, // 17 communes, 2 sièges
  ZN: { name: "Nouvelle-Calédonie", of: "de Nouvelle-Calédonie" }, // 33 communes, 2 sièges
  ZP: { name: "Polynésie française", of: "de Polynésie française" }, // 48 communes, 3 sièges
  ZS: { name: "Saint-Pierre-et-Miquelon", of: "de Saint-Pierre-et-Miquelon" }, // 2 communes, 1 siège
  ZW: { name: "Wallis-et-Futuna", of: "de Wallis-et-Futuna" }, // 1 commune, 1 siège
  ZX: { name: "Saint-Barthélemy et Saint-Martin", of: "de Saint-Barthélemy et Saint-Martin" }, // 1 siège
  ZZ: { name: "Français de l'étranger", of: "des Français de l'étranger" }, // 11 sièges
};

/** Nom + forme « de … » du territoire d'une circonscription (département ou zone). */
function circoTerritory(code: string): { name: string; of: string } | null {
  const key = deptFromCirco(code);
  if (!key) return null;
  const zone = CIRCO_ZONES[key];
  if (zone) return zone;
  const name = DEPT_NAMES[key];
  const of = DEPT_OF[key];
  return name && of ? { name, of } : null;
}

/** Ordinal féminin (« circonscription ») : 1 → « 1ʳᵉ », n → « nᵉ ». */
export function ordinalFem(n: number): string {
  return n === 1 ? "1ʳᵉ" : `${n}ᵉ`;
}

/** Numéro de circonscription depuis son code (« 3401 » → 1). `null` si illisible. */
export function circoNumber(code: string): number | null {
  if (!code || code.length < 3) return null;
  const n = Number(code.slice(-2));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Libellé complet d'une circonscription : « 1ʳᵉ circonscription de l'Hérault ».
 *
 * Le seul numéro ne permet pas de savoir de quelle circonscription on parle —
 * il y a 577 « 1ʳᵉ circonscription ». À utiliser partout où une circonscription
 * est nommée (fiches, listes, résultats de recherche, épingles).
 */
export function circoLabel(code: string): string {
  const num = circoNumber(code);
  const territory = circoTerritory(code);
  if (num == null) {
    return territory ? `Circonscription ${territory.of}` : `Circonscription ${code}`;
  }
  const base = `${ordinalFem(num)} circonscription`;
  return territory ? `${base} ${territory.of}` : base;
}

/** Variante compacte pour les listes denses : « 1ʳᵉ circo. · Hérault ». */
export function circoShortLabel(code: string): string {
  const num = circoNumber(code);
  const territory = circoTerritory(code);
  const base = num != null ? `${ordinalFem(num)} circo.` : `Circo. ${code}`;
  return territory ? `${base} · ${territory.name}` : base;
}

export type Territory = {
  target: CampaignTarget;
  /** Code circonscription si la cible en désigne une (→ député en exercice). */
  circoCode: string | null;
  deptCode: string | null;
  deptName: string | null;
  /** Nom de commune quand la cible est une commune. */
  communeName: string | null;
  /** Requête presse par défaut (commune, département, ou nom de la personne suivie). */
  newsQuery: string | null;
  /** Libellé court affichable (« 2e circonscription · Cantal »). */
  shortLabel: string;
};

/**
 * Dérive le contexte territorial de la cible du QG. `null` si aucune cible.
 * Pour une cible personne (élu / candidat), la veille presse porte sur la
 * personne elle-même — c'est le cas « suivre un adversaire ».
 */
export function territoryFrom(target: CampaignTarget | null | undefined): Territory | null {
  if (!target) return null;

  let circoCode: string | null = null;
  let deptCode: string | null = null;
  let communeName: string | null = null;
  let newsQuery: string | null = null;

  switch (target.type) {
    case "circo": {
      circoCode = target.id;
      deptCode = deptFromCirco(target.id);
      break;
    }
    case "commune": {
      deptCode = deptFromInsee(target.id);
      communeName = target.label;
      newsQuery = target.label;
      break;
    }
    case "bureau": {
      // Code bureau = « {insee}_{numéro} » ; la presse pertinente est communale.
      deptCode = deptFromInsee(target.id.split("_")[0] ?? "");
      const commune = target.label.split("·").pop()?.trim();
      if (commune && !/^bureau/i.test(commune)) {
        communeName = commune;
        newsQuery = commune;
      }
      break;
    }
    case "elu": {
      // id = code circo (député en exercice) ; veille sur la personne.
      circoCode = target.id.split("__").pop() ?? null;
      deptCode = circoCode ? deptFromCirco(circoCode) : null;
      newsQuery = target.label;
      break;
    }
    case "candidat": {
      // id = « {scrutin}__{circo}__{slug} » ; veille sur la personne.
      const parts = target.id.split("__");
      circoCode = parts.length >= 2 ? parts[1] : null;
      deptCode = circoCode ? deptFromCirco(circoCode) : null;
      newsQuery = target.label;
      break;
    }
  }

  const deptName = deptCode ? DEPT_NAMES[deptCode] ?? null : null;
  if (!newsQuery) newsQuery = deptName; // repli : presse départementale

  const shortLabel = deptName && !target.label.includes(deptName)
    ? `${target.label} · ${deptName}`
    : target.label;

  return { target, circoCode, deptCode, deptName, communeName, newsQuery, shortLabel };
}
