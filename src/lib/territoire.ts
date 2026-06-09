import type { CampaignTarget } from "@/lib/campaign";

/**
 * Contexte territorial dérivé de la cible de campagne du QG. Sert à
 * territorialiser l'onglet Suivre : requête presse pertinente, département,
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
