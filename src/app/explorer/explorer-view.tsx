"use client";

import {
  memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore,
  type RefObject,
} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Loader2, X, Search, BadgeCheck, ArrowUpRight, Info, SlidersHorizontal, RotateCw,
  ChevronLeft, MousePointerClick,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type Maille, MAILLE_LABELS } from "@/lib/map-config";
import {
  useScrutinWinner,
  useScrutinMetric,
  useScrutinDetail,
  useScrutinNationalParticipation,
  useRevenuMedianCommune,
  useTauxPauvreteCommune,
  useSocioColumnCommune,
  useRpColumnCommune,
  useLogementColumnCommune,
  useFamilleColumnCommune,
  useMobiliteColumnCommune,
  useStructpopColumnCommune,
  useSociologieCommune,
  useSociologieBureau,
  useTrendColumn,
  useTrendsTerritoire,
  usePotentielColumn,
  usePotentielTerritoire,
  usePotentielMeta,
  type WinningNuanceRow,
  type NumericRow,
  type ScrutinDetail,
  type CommuneSociologie,
  type BureauSociologie,
  type TerritoireTrends,
  type TrendFile,
  type TrendColumn,
  type PotentielBloc,
  type PotentielRow,
  type PotentielMeta,
} from "@/lib/queries";
import type { Choropleth } from "@/components/map";
import { buildNuanceMatchExpression, nuanceColor, nuanceLabel } from "@/lib/nuances";
import { circoLabel } from "@/lib/territoire";
import { fmtInt, fmtEuro, fmtPct } from "@/lib/format";
import {
  useExplorerUrlState,
  type Scrutin,
  type Coloration,
  type ScrutinFamily,
  type BlocMetricKey,
  SCRUTIN_META,
  COLORATION_LABELS,
  BLOC_METRIC_KEYS,
  FAMILY_ORDER,
  FAMILY_LABELS,
  colorationsFor,
  maillesFor,
  isElection,
  parseScrutin,
  yearsFor,
  toursFor,
  scrutinFor,
  defaultScrutinFor,
} from "@/lib/url-state";

const MapView = dynamic(() => import("@/components/map").then((m) => m.Map), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
      Chargement de la carte…
    </div>
  ),
});

// ─── Données statiques UI ─────────────────────────────────────────────────────

const MAILLE_COUNTS: Record<Maille, number> = {
  regions: 18,
  departements: 96,
  circonscriptions: 559,
  communes: 35798,
  bureaux: 69000,
};

const FR = { revenuMedian: 22040, tauxPauvrete: 14.4 };

// ─── Couleurs choroplèthes ─────────────────────────────────────────────────────

const PARTICIPATION_STOPS: Array<[number, string]> = [
  [0.3, "#f1f5f9"],
  [0.5, "#93c5fd"],
  [0.65, "#2563eb"],
  [0.8, "#1e3a8a"],
];
const ABSTENTION_STOPS: Array<[number, string]> = [
  [0.15, "#f1f5f9"],
  [0.3, "#fcd34d"],
  [0.45, "#f97316"],
  [0.6, "#7f1d1d"],
];
const REVENU_STOPS: Array<[number, string]> = [
  [12000, "#fef3c7"],
  [18000, "#bbf7d0"],
  [24000, "#34d399"],
  [30000, "#047857"],
  [40000, "#064e3b"],
];
const PAUVRETE_STOPS: Array<[number, string]> = [
  [0, "#f0fdf4"],
  [10, "#fef9c3"],
  [20, "#fb923c"],
  [30, "#dc2626"],
  [50, "#7f1d1d"],
];
const INEGALITES_STOPS: Array<[number, string]> = [
  [2.5, "#f0fdf4"],
  [3.5, "#fde68a"],
  [5, "#fb923c"],
  [7, "#dc2626"],
  [10, "#7f1d1d"],
];
const PRESTATIONS_STOPS: Array<[number, string]> = [
  [1, "#f1f5f9"],
  [4, "#bfdbfe"],
  [8, "#60a5fa"],
  [12, "#2563eb"],
  [18, "#1e3a8a"],
];
const PENSIONS_STOPS: Array<[number, string]> = [
  [10, "#fef3c7"],
  [22, "#fcd34d"],
  [32, "#f59e0b"],
  [45, "#b45309"],
];
const AGE65_STOPS: Array<[number, string]> = [
  [10, "#eff6ff"],
  [20, "#93c5fd"],
  [30, "#3b82f6"],
  [40, "#1e3a8a"],
];
const CHOMAGE_STOPS: Array<[number, string]> = [
  [4, "#f0fdf4"],
  [9, "#fde68a"],
  [15, "#fb923c"],
  [22, "#7f1d1d"],
];
const CADRES_STOPS: Array<[number, string]> = [
  [5, "#faf5ff"],
  [15, "#d8b4fe"],
  [30, "#a855f7"],
  [50, "#6b21a8"],
];
const DIPLOME_STOPS: Array<[number, string]> = [
  [10, "#f0fdfa"],
  [25, "#5eead4"],
  [40, "#14b8a6"],
  [60, "#0f766e"],
];
const PROPRIETAIRES_STOPS: Array<[number, string]> = [
  [35, "#eff6ff"],
  [55, "#bfdbfe"],
  [70, "#60a5fa"],
  [85, "#1d4ed8"],
];
const RESSEC_STOPS: Array<[number, string]> = [
  [2, "#fff7ed"],
  [10, "#fdba74"],
  [25, "#f97316"],
  [45, "#9a3412"],
];
const LOGVAC_STOPS: Array<[number, string]> = [
  [3, "#faf5ff"],
  [8, "#d8b4fe"],
  [13, "#a855f7"],
  [20, "#6b21a8"],
];
const MONO_STOPS: Array<[number, string]> = [
  [6, "#fdf2f8"],
  [12, "#f9a8d4"],
  [20, "#db2777"],
  [32, "#831843"],
];
const PSEUL_STOPS: Array<[number, string]> = [
  [15, "#eef2ff"],
  [28, "#a5b4fc"],
  [40, "#4f46e5"],
  [55, "#312e81"],
];
const NOUVARR_STOPS: Array<[number, string]> = [
  [4, "#f0fdfa"],
  [8, "#5eead4"],
  [14, "#14b8a6"],
  [22, "#115e59"],
];
// Lot 2 — structure & dynamique de population + ouvriers (socio_rp existant).
const OUVRIERS_STOPS: Array<[number, string]> = [
  [8, "#fff7ed"],
  [15, "#fdba74"],
  [22, "#ea580c"],
  [30, "#7c2d12"],
];
// Densité : progression quasi logarithmique (41 hab/km² médian, Paris > 20 000).
const DENSITE_STOPS: Array<[number, string]> = [
  [10, "#f1f5f9"],
  [100, "#c7d2fe"],
  [1000, "#6366f1"],
  [5000, "#312e81"],
];
const JEUNES_STOPS: Array<[number, string]> = [
  [8, "#f0f9ff"],
  [13, "#7dd3fc"],
  [18, "#0284c7"],
  [25, "#0c4a6e"],
];
// Divergent : déclin (rouge) ← stable (neutre) → croissance (vert).
const EVOPOP_STOPS: Array<[number, string]> = [
  [-10, "#7f1d1d"],
  [-3, "#fca5a5"],
  [0, "#f1f5f9"],
  [3, "#86efac"],
  [10, "#14532d"],
];

// Paliers DIVERGENTS pour les deltas (taux 0..1, signés). Négatif → positif.
// Abstention présidentielle (faibles variations) vs législatives (chute ~20 pts
// en 2024) → deux échelles distinctes. Hausse abstention = défavorable (rouge).
const ABST_PRESID_STOPS: Array<[number, string]> = [
  [-0.04, "#15803d"], [-0.01, "#86efac"], [0, "#f1f5f9"], [0.04, "#fb923c"], [0.08, "#dc2626"], [0.12, "#7f1d1d"],
];
const ABST_LEGIS_STOPS: Array<[number, string]> = [
  [-0.3, "#14532d"], [-0.18, "#22c55e"], [-0.08, "#86efac"], [0, "#f1f5f9"], [0.05, "#fb923c"], [0.1, "#dc2626"],
];
// RN / extrême droite : recul (bleu) → hausse (rouge sombre). Couvre présid + légis.
const RN_STOPS: Array<[number, string]> = [
  [-0.04, "#2563eb"], [-0.01, "#bfdbfe"], [0, "#f1f5f9"], [0.06, "#fca5a5"], [0.14, "#dc2626"], [0.25, "#7f1d1d"],
];
// Gauche / NFP : recul (bleu) → hausse (magenta), hue distincte du RN.
const GAUCHE_STOPS: Array<[number, string]> = [
  [-0.08, "#1d4ed8"], [-0.02, "#bfdbfe"], [0, "#f1f5f9"], [0.02, "#fbcfe8"], [0.08, "#be185d"], [0.16, "#831843"],
];

// Potentiel = affinité − réel. Positif = terrain favorable sous-exploité
// (« à conquérir », chaud) ; négatif = sur-performe son profil (bastion, froid).
const POTENTIEL_STOPS: Array<[number, string]> = [
  [-15, "#0f766e"],
  [-5, "#5eead4"],
  [0, "#f1f5f9"],
  [5, "#fbbf24"],
  [12, "#f97316"],
  [20, "#9a3412"],
];
const POT_DEF: Partial<Record<Coloration, PotentielBloc>> = {
  "pot-rn": "rn",
  "pot-gauche": "gauche",
  "pot-ecolo": "ecolo",
  "pot-centre": "centre",
  "pot-droite": "droite",
};

// Mapping coloration « Tendances » → (fichier, colonne, paliers). Une seule
// requête active à la fois selon la coloration choisie.
// ─── Scores par bloc (part des exprimés, rampes « heatmap » séquentielles) ───
// Blanc cassé → couleur pleine du bloc (teintes alignées sur nuances.ts).
// Domaine 2 % → 50 % : lisible au 1er tour, sature (foncé) sur les duels de
// 2nd tour — au-delà du dernier palier, MapLibre borne à la couleur pleine.
const BLOC_GAUCHE_STOPS: Array<[number, string]> = [
  [0.02, "#f1f5f9"], [0.15, "#fda4af"], [0.3, "#e11d48"], [0.5, "#7f1d1d"],
];
const BLOC_ECOLO_STOPS: Array<[number, string]> = [
  [0.02, "#f1f5f9"], [0.1, "#86efac"], [0.2, "#16a34a"], [0.35, "#14532d"],
];
const BLOC_CENTRE_STOPS: Array<[number, string]> = [
  [0.02, "#f1f5f9"], [0.15, "#fde68a"], [0.3, "#f59e0b"], [0.5, "#92400e"],
];
const BLOC_DROITE_STOPS: Array<[number, string]> = [
  [0.02, "#f1f5f9"], [0.12, "#93c5fd"], [0.25, "#3b82f6"], [0.45, "#1d4ed8"],
];
const BLOC_RN_STOPS: Array<[number, string]> = [
  [0.02, "#f1f5f9"], [0.15, "#a5b4fc"], [0.3, "#4f46e5"], [0.5, "#1e1b4b"],
];

const BLOC_DEF: Partial<Record<Coloration, { key: BlocMetricKey; stops: Array<[number, string]> }>> = {
  "bloc-gauche": { key: BLOC_METRIC_KEYS["bloc-gauche"], stops: BLOC_GAUCHE_STOPS },
  "bloc-ecolo": { key: BLOC_METRIC_KEYS["bloc-ecolo"], stops: BLOC_ECOLO_STOPS },
  "bloc-centre": { key: BLOC_METRIC_KEYS["bloc-centre"], stops: BLOC_CENTRE_STOPS },
  "bloc-droite": { key: BLOC_METRIC_KEYS["bloc-droite"], stops: BLOC_DROITE_STOPS },
  "bloc-rn": { key: BLOC_METRIC_KEYS["bloc-rn"], stops: BLOC_RN_STOPS },
};

const TREND_DEF: Partial<Record<Coloration, { file: TrendFile; column: TrendColumn; stops: Array<[number, string]> }>> = {
  "evo-abstention": { file: "presid_2017_2022", column: "d_abstention", stops: ABST_PRESID_STOPS },
  "dynamique-rn": { file: "presid_2017_2022", column: "d_rn", stops: RN_STOPS },
  "dynamique-gauche": { file: "presid_2017_2022", column: "d_gauche", stops: GAUCHE_STOPS },
  "legis-abstention": { file: "legis_2022_2024", column: "d_abstention", stops: ABST_LEGIS_STOPS },
  "legis-rn": { file: "legis_2022_2024", column: "d_rn", stops: RN_STOPS },
  "legis-gauche": { file: "legis_2022_2024", column: "d_gauche", stops: GAUCHE_STOPS },
};

// Regroupement des indicateurs par thème (désencombre les longues listes).
type ColorationGroup = { title?: string; items: Coloration[] };
function colorationGroups(scrutin: Scrutin): ColorationGroup[] {
  if (scrutin === "sociologie")
    return [
      { title: "Revenus", items: ["revenu", "pauvrete", "inegalites", "prestations", "pensions"] },
      { title: "Démographie", items: ["age65", "jeunes", "chomage", "nouveaux-arrivants"] },
      { title: "Emploi & classes sociales", items: ["cadres", "ouvriers", "diplome"] },
      { title: "Territoire", items: ["densite", "evopop"] },
      { title: "Logement", items: ["proprietaires", "ressecondaires", "logvacants"] },
      { title: "Famille", items: ["monoparentales", "personnes-seules"] },
    ];
  if (scrutin === "tendances")
    return [
      { title: "Présidentielle 2017 → 2022", items: ["evo-abstention", "dynamique-rn", "dynamique-gauche"] },
      { title: "Législatives 2022 → 2024", items: ["legis-abstention", "legis-rn", "legis-gauche"] },
    ];
  if (scrutin === "potentiel")
    return [{ items: ["pot-rn", "pot-gauche", "pot-ecolo", "pot-centre", "pot-droite"] }];
  return [
    { items: ["vainqueur", "participation", "abstention"] },
    { title: "Score par bloc", items: ["bloc-gauche", "bloc-ecolo", "bloc-centre", "bloc-droite", "bloc-rn"] },
  ];
}

// Aide contextuelle : explique l'indicateur courant au point de décision.
function colorationHelp(coloration: Coloration): string | null {
  if (coloration === "vainqueur") return "Couleur = nuance politique arrivée en tête.";
  if (BLOC_DEF[coloration])
    return "Part des suffrages exprimés du bloc. Plus la teinte est foncée, plus le bloc pèse dans le territoire.";
  if (coloration === "evopop")
    return "Évolution de la population entre 2016 et 2022. Rouge = déclin démographique, vert = croissance.";
  if (coloration === "densite")
    return "Habitants au km² (échelle resserrée sur le rural : 10 → 5 000+).";
  if (POT_DEF[coloration])
    return "Score attendu (profil socio) − réel. Chaud = terrain favorable sous-exploité ; froid = bastion qui sur-performe.";
  if (TREND_DEF[coloration]) return "Évolution en points entre les deux scrutins. Rouge = hausse, vert = recul.";
  return null;
}

// Libellé court pour les pills : le titre de groupe porte déjà le contexte
// (période / thème), donc on retire le suffixe redondant. La légende, elle,
// garde le libellé complet (COLORATION_LABELS).
const COLORATION_PILL_LABEL: Partial<Record<Coloration, string>> = {
  "evo-abstention": "Abstention", "dynamique-rn": "RN / ext. droite", "dynamique-gauche": "Gauche / NFP",
  "legis-abstention": "Abstention", "legis-rn": "RN / ext. droite", "legis-gauche": "Gauche / NFP",
  "pot-rn": "RN / ext. droite", "pot-gauche": "Gauche / NFP", "pot-ecolo": "Écologistes",
  "pot-centre": "Centre", "pot-droite": "Droite (LR)",
  "bloc-gauche": "Gauche / NFP", "bloc-ecolo": "Écologistes", "bloc-centre": "Centre",
  "bloc-droite": "Droite (LR)", "bloc-rn": "RN / ext. droite",
};
const pillLabel = (c: Coloration) => COLORATION_PILL_LABEL[c] ?? COLORATION_LABELS[c];

function continuousChoropleth(
  stateKey: string,
  stops: Array<[number, string]>,
  rows: NumericRow[],
): Choropleth {
  return {
    stateKey,
    data: rows.map((r) => ({ code: r.code, value: r.value })),
    paint: [
      "interpolate",
      ["linear"],
      ["feature-state", stateKey],
      ...stops.flat(),
    ] as unknown as Choropleth["paint"],
  };
}

function nuanceChoropleth(rows: WinningNuanceRow[]): Choropleth {
  return {
    stateKey: "nuance",
    data: rows.map((r) => ({ code: r.code, value: r.nuance })),
    paint: buildNuanceMatchExpression() as unknown as Choropleth["paint"],
  };
}

function pickName(props: Record<string, unknown>): string {
  // Bureau de vote : « Bureau 0001 · Commune » (contours officiels REU).
  const numBV = props["numeroBureauVote"];
  const nomCommune = props["nomCommune"];
  if (typeof numBV === "string" && typeof nomCommune === "string") {
    return `Bureau ${numBV} · ${nomCommune}`;
  }
  for (const key of ["nom", "NOM", "libelle", "LIBELLE", "nomCirconscription", "name"]) {
    const value = props[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return "Sans nom";
}
/**
 * Nom affichable d'une entité selon sa maille. Les tuiles « circonscriptions »
 * ne portent que le numéro (« 1ère circonscription ») : sans le département, on
 * ne sait pas de laquelle il s'agit — on reconstruit donc le libellé complet.
 */
function territoryName(maille: Maille, props: Record<string, unknown>, code: string | null): string {
  if (maille === "circonscriptions" && code) return circoLabel(code);
  return pickName(props);
}

function pickCode(props: Record<string, unknown>): string | null {
  for (const key of ["codeBureauVote", "code", "codeCirconscription", "CODE", "INSEE_COM", "insee", "id"]) {
    const value = props[key];
    if (typeof value === "string" || typeof value === "number") return String(value);
  }
  return null;
}

function openSearchPalette() {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
}

// ─── Formatage ────────────────────────────────────────────────────────────────

const fmtSignedPts = (v: number) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}`;
const fmtSignedInt = (v: number) => `${v > 0 ? "+" : ""}${Math.round(v)}`;

/** Formatage de la valeur d'un indicateur (survol, cohérent avec la légende). */
function colorationValueFmt(coloration: Coloration): (v: number) => string {
  if (coloration === "participation" || coloration === "abstention") return (v) => fmtPct(v, 0);
  if (coloration === "revenu") return fmtEuro;
  if (coloration === "inegalites") return (v) => v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  if (TREND_DEF[coloration]) return (v) => `${fmtSignedPts(v)} pts`;
  if (POT_DEF[coloration]) return (v) => `${fmtSignedInt(v)} pts`;
  return (v) => `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

// ─── Composant principal ────────────────────────────────────────────────────

function ExplorerView() {
  const { maille, scrutin, coloration, code, update } = useExplorerUrlState();
  const [lastClicked, setLastClicked] = useState<{ code: string; name: string; maille: Maille } | null>(null);

  // Recale maille & coloration sur ce qui est disponible pour le scrutin courant.
  useEffect(() => {
    const validM = maillesFor(scrutin);
    const validC = colorationsFor(scrutin);
    const patch: { maille?: Maille; coloration?: Coloration } = {};
    if (!validM.includes(maille)) patch.maille = validM[0];
    if (!validC.includes(coloration)) patch.coloration = validC[0];
    if (Object.keys(patch).length) update(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrutin]);

  const election = isElection(scrutin);

  const winner = useScrutinWinner(scrutin, maille, election && coloration === "vainqueur");
  const participation = useScrutinMetric(
    scrutin,
    maille,
    "participation",
    election && coloration === "participation",
  );
  const abstention = useScrutinMetric(
    scrutin,
    maille,
    "abstention",
    election && coloration === "abstention",
  );
  const revenu = useRevenuMedianCommune(scrutin === "sociologie" && coloration === "revenu");
  const pauvrete = useTauxPauvreteCommune(scrutin === "sociologie" && coloration === "pauvrete");
  const inegalites = useSocioColumnCommune(
    "IR_D9_D1_SL",
    scrutin === "sociologie" && coloration === "inegalites",
  );
  const prestations = useSocioColumnCommune(
    "S_SOC_BEN_DI",
    scrutin === "sociologie" && coloration === "prestations",
  );
  const pensions = useSocioColumnCommune(
    "S_RET_PEN_DI",
    scrutin === "sociologie" && coloration === "pensions",
  );
  const age65 = useRpColumnCommune("part65plus", scrutin === "sociologie" && coloration === "age65");
  const chomage = useRpColumnCommune("tauxChomage", scrutin === "sociologie" && coloration === "chomage");
  const cadres = useRpColumnCommune("partCadres", scrutin === "sociologie" && coloration === "cadres");
  const diplome = useRpColumnCommune("partDiplomeSup", scrutin === "sociologie" && coloration === "diplome");
  const proprietaires = useLogementColumnCommune("partProprietaires", scrutin === "sociologie" && coloration === "proprietaires");
  const ressecondaires = useLogementColumnCommune("partResSecondaires", scrutin === "sociologie" && coloration === "ressecondaires");
  const logvacants = useLogementColumnCommune("partLogVacants", scrutin === "sociologie" && coloration === "logvacants");
  const monoparentales = useFamilleColumnCommune("partFamMono", scrutin === "sociologie" && coloration === "monoparentales");
  const personnesSeules = useFamilleColumnCommune("partPersonnesSeules", scrutin === "sociologie" && coloration === "personnes-seules");
  const nouveauxArrivants = useMobiliteColumnCommune(scrutin === "sociologie" && coloration === "nouveaux-arrivants");
  const ouvriers = useRpColumnCommune("partOuvriers", scrutin === "sociologie" && coloration === "ouvriers");
  const densite = useStructpopColumnCommune("densite", scrutin === "sociologie" && coloration === "densite");
  const jeunes = useStructpopColumnCommune("partJeunes", scrutin === "sociologie" && coloration === "jeunes");
  const evopop = useStructpopColumnCommune("evoPop", scrutin === "sociologie" && coloration === "evopop");
  const blocDef = election ? BLOC_DEF[coloration] : undefined;
  const blocMetric = useScrutinMetric(scrutin, maille, blocDef?.key ?? "participation", !!blocDef);
  const trendDef = scrutin === "tendances" ? TREND_DEF[coloration] : undefined;
  const trend = useTrendColumn(
    trendDef?.file ?? "presid_2017_2022",
    trendDef?.column ?? "d_abstention",
    maille,
    !!trendDef,
  );
  const potBloc = scrutin === "potentiel" ? POT_DEF[coloration] : undefined;
  const potentiel = usePotentielColumn(potBloc ?? "rn", !!potBloc);

  const choropleth = useMemo<Choropleth | undefined>(() => {
    if (potBloc) {
      return potentiel.data ? continuousChoropleth(coloration, POTENTIEL_STOPS, potentiel.data) : undefined;
    }
    if (trendDef) {
      return trend.data ? continuousChoropleth(coloration, trendDef.stops, trend.data) : undefined;
    }
    if (blocDef) {
      return blocMetric.data ? continuousChoropleth(coloration, blocDef.stops, blocMetric.data) : undefined;
    }
    switch (coloration) {
      case "vainqueur":
        return winner.data ? nuanceChoropleth(winner.data) : undefined;
      case "participation":
        return participation.data
          ? continuousChoropleth("participation", PARTICIPATION_STOPS, participation.data)
          : undefined;
      case "abstention":
        return abstention.data
          ? continuousChoropleth("abstention", ABSTENTION_STOPS, abstention.data)
          : undefined;
      case "revenu":
        return revenu.data ? continuousChoropleth("revenu", REVENU_STOPS, revenu.data) : undefined;
      case "pauvrete":
        return pauvrete.data
          ? continuousChoropleth("pauvrete", PAUVRETE_STOPS, pauvrete.data)
          : undefined;
      case "inegalites":
        return inegalites.data
          ? continuousChoropleth("inegalites", INEGALITES_STOPS, inegalites.data)
          : undefined;
      case "prestations":
        return prestations.data
          ? continuousChoropleth("prestations", PRESTATIONS_STOPS, prestations.data)
          : undefined;
      case "pensions":
        return pensions.data
          ? continuousChoropleth("pensions", PENSIONS_STOPS, pensions.data)
          : undefined;
      case "age65":
        return age65.data ? continuousChoropleth("age65", AGE65_STOPS, age65.data) : undefined;
      case "chomage":
        return chomage.data ? continuousChoropleth("chomage", CHOMAGE_STOPS, chomage.data) : undefined;
      case "cadres":
        return cadres.data ? continuousChoropleth("cadres", CADRES_STOPS, cadres.data) : undefined;
      case "diplome":
        return diplome.data ? continuousChoropleth("diplome", DIPLOME_STOPS, diplome.data) : undefined;
      case "proprietaires":
        return proprietaires.data ? continuousChoropleth("proprietaires", PROPRIETAIRES_STOPS, proprietaires.data) : undefined;
      case "ressecondaires":
        return ressecondaires.data ? continuousChoropleth("ressecondaires", RESSEC_STOPS, ressecondaires.data) : undefined;
      case "logvacants":
        return logvacants.data ? continuousChoropleth("logvacants", LOGVAC_STOPS, logvacants.data) : undefined;
      case "monoparentales":
        return monoparentales.data ? continuousChoropleth("monoparentales", MONO_STOPS, monoparentales.data) : undefined;
      case "personnes-seules":
        return personnesSeules.data ? continuousChoropleth("personnes-seules", PSEUL_STOPS, personnesSeules.data) : undefined;
      case "nouveaux-arrivants":
        return nouveauxArrivants.data ? continuousChoropleth("nouveaux-arrivants", NOUVARR_STOPS, nouveauxArrivants.data) : undefined;
      case "ouvriers":
        return ouvriers.data ? continuousChoropleth("ouvriers", OUVRIERS_STOPS, ouvriers.data) : undefined;
      case "densite":
        return densite.data ? continuousChoropleth("densite", DENSITE_STOPS, densite.data) : undefined;
      case "jeunes":
        return jeunes.data ? continuousChoropleth("jeunes", JEUNES_STOPS, jeunes.data) : undefined;
      case "evopop":
        return evopop.data ? continuousChoropleth("evopop", EVOPOP_STOPS, evopop.data) : undefined;
      default:
        return undefined;
    }
  }, [
    coloration,
    blocDef,
    blocMetric.data,
    trendDef,
    trend.data,
    potBloc,
    potentiel.data,
    proprietaires.data,
    ressecondaires.data,
    logvacants.data,
    ouvriers.data,
    densite.data,
    jeunes.data,
    evopop.data,
    monoparentales.data,
    personnesSeules.data,
    nouveauxArrivants.data,
    winner.data,
    participation.data,
    abstention.data,
    revenu.data,
    pauvrete.data,
    inegalites.data,
    prestations.data,
    pensions.data,
    age65.data,
    chomage.data,
    cadres.data,
    diplome.data,
  ]);

  const isLoading =
    winner.isFetching ||
    participation.isFetching ||
    abstention.isFetching ||
    revenu.isFetching ||
    pauvrete.isFetching ||
    inegalites.isFetching ||
    prestations.isFetching ||
    pensions.isFetching ||
    age65.isFetching ||
    chomage.isFetching ||
    cadres.isFetching ||
    diplome.isFetching ||
    proprietaires.isFetching ||
    ressecondaires.isFetching ||
    logvacants.isFetching ||
    monoparentales.isFetching ||
    personnesSeules.isFetching ||
    nouveauxArrivants.isFetching ||
    trend.isFetching ||
    potentiel.isFetching;

  // Couches interrogées (une seule active à la fois selon la coloration) : permet
  // de dériver l'état d'erreur et un « réessayer » ciblé sur les seules en échec.
  const layers = [
    winner, participation, abstention, blocMetric, revenu, pauvrete, inegalites, prestations,
    pensions, age65, chomage, cadres, diplome, proprietaires, ressecondaires,
    logvacants, monoparentales, personnesSeules, nouveauxArrivants,
    ouvriers, densite, jeunes, evopop, trend, potentiel,
  ];
  const isError = layers.some((q) => q.isError);
  const retryLayers = () => {
    for (const q of layers) if (q.isError) void q.refetch();
  };

  // Aperçu au survol (sans clic). L'état vit dans <HoverTooltip> et n'est écrit
  // que par une référence : sans ça, chaque frame de souris re-rendait TOUT
  // l'explorateur (panneau de contrôle, fiche, légende) à 60 fps.
  const choroByCode = useMemo(() => {
    const m = new Map<string, number | string>();
    if (choropleth) for (const d of choropleth.data) m.set(String(d.code), d.value);
    return m;
  }, [choropleth]);
  const hoverSetRef = useRef<((h: HoverInfo | null) => void) | null>(null);
  const hoverRaf = useRef<number | null>(null);
  const onFeatureHover = useCallback(
    (info: { maille: Maille; properties: Record<string, unknown>; point: { x: number; y: number } } | null) => {
      const set = hoverSetRef.current;
      if (!set) return;
      if (hoverRaf.current) cancelAnimationFrame(hoverRaf.current);
      if (!info) {
        set(null);
        return;
      }
      const c = pickCode(info.properties);
      const name = territoryName(info.maille, info.properties, c);
      const { x, y } = info.point;
      hoverRaf.current = requestAnimationFrame(() => set({ name, code: c, x, y }));
    },
    [],
  );

  const onFeatureClick = useCallback(
    ({ maille: m, properties }: { maille: Maille; properties: Record<string, unknown> }) => {
      const c = pickCode(properties);
      if (!c) return;
      setLastClicked({ code: c, name: territoryName(m, properties, c), maille: m });
      update({ code: c, maille: m });
    },
    [update],
  );
  const clearSelection = useCallback(() => update({ code: null }), [update]);

  // Panneau de contrôle : tiroir sur mobile, carte flottante repliable sur desktop.
  const [filtersMobileOpen, setFiltersMobileOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const closeFiltersMobile = useCallback(() => setFiltersMobileOpen(false), []);
  const openFilters = useCallback(() => {
    setFiltersMobileOpen(true);
    setFiltersOpen(true);
  }, []);

  return (
    <div className="relative h-[calc(100dvh-3.5rem-var(--bottom-nav))] w-full overflow-hidden bg-canvas">
      {/* La carte occupe tout le cadre ; les panneaux flottent au-dessus. */}
      <MapView
        className="absolute inset-0 h-full w-full"
        maille={maille}
        choropleth={choropleth}
        selectedCode={code}
        onFeatureHover={onFeatureHover}
        onFeatureClick={onFeatureClick}
      />

      {filtersMobileOpen && (
        <div
          className="absolute inset-0 z-20 bg-foreground/30 lg:hidden"
          onClick={closeFiltersMobile}
          aria-hidden
        />
      )}

      <MapTopBar
        scrutin={scrutin}
        filtersOpen={filtersOpen}
        onOpenSearch={openSearchPalette}
        onOpenFilters={openFilters}
      />

      {isLoading && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Mise à jour de la carte…
          </span>
        </div>
      )}
      {!isLoading && isError && (
        <div className="absolute left-1/2 top-3 z-20 -translate-x-1/2">
          <button
            type="button"
            onClick={retryLayers}
            className="inline-flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-1.5 text-[11px] font-medium text-destructive shadow-sm backdrop-blur transition-colors hover:bg-surface"
          >
            <RotateCw className="h-3.5 w-3.5" /> Données indisponibles — réessayer
          </button>
        </div>
      )}

      <ControlsPanel
        maille={maille}
        scrutin={scrutin}
        coloration={coloration}
        update={update}
        isLoading={isLoading}
        open={filtersOpen}
        mobileOpen={filtersMobileOpen}
        onCloseMobile={closeFiltersMobile}
        onCollapse={() => setFiltersOpen(false)}
      />

      <HoverTooltip setterRef={hoverSetRef} valueByCode={choroByCode} coloration={coloration} />

      <MapBottomLegend
        coloration={coloration}
        winnerRows={coloration === "vainqueur" ? winner.data : undefined}
        shiftedRight={filtersOpen}
        hiddenOnMobile={!!code}
      />

      {!code && !isLoading && <SelectionCoach />}

      {/* Fiche flottante : n'apparaît QUE lorsqu'un territoire est sélectionné. */}
      {code && (
        <aside
          className={cn(
            "anim-pop-in absolute z-30 flex flex-col overflow-hidden rounded-2xl border border-foreground/5 bg-surface/95 shadow-floating backdrop-blur-md",
            // Mobile : feuille basse — la carte reste visible au-dessus.
            "inset-x-2 bottom-2 max-h-[62%]",
            // Desktop : carte flottante à droite, sous la barre supérieure.
            "lg:inset-x-auto lg:right-3 lg:top-[3.25rem] lg:bottom-3 lg:w-[352px] lg:max-h-none",
          )}
        >
          <FicheTerritoire
            code={code}
            maille={maille}
            scrutin={scrutin}
            lastClicked={lastClicked}
            onClear={clearSelection}
          />
        </aside>
      )}
      {/* La CommandPalette est rendue globalement par le layout racine —
         un second rendu ici doublait les écouteurs clavier (⌘K, F). */}
    </div>
  );
}

// ─── Survol : état local isolé (piloté par référence, sans re-rendu parent) ────

type HoverInfo = { name: string; code: string | null; x: number; y: number };

const HoverTooltip = memo(function HoverTooltip({
  setterRef,
  valueByCode,
  coloration,
}: {
  setterRef: RefObject<((h: HoverInfo | null) => void) | null>;
  valueByCode: Map<string, number | string>;
  coloration: Coloration;
}) {
  const [hover, setHover] = useState<HoverInfo | null>(null);

  useEffect(() => {
    setterRef.current = setHover;
    return () => {
      setterRef.current = null;
    };
  }, [setterRef]);

  if (!hover) return null;
  const value = hover.code ? valueByCode.get(hover.code) : undefined;
  return (
    <div className="anim-pop-in pointer-events-none absolute z-30 max-w-[210px]" style={{ left: hover.x, top: hover.y }}>
      <div className="ml-3 mt-3 rounded-lg bg-surface/95 px-2.5 py-1.5 shadow-floating ring-1 ring-foreground/10 backdrop-blur">
        <p className="text-[11.5px] font-semibold leading-tight">{hover.name}</p>
        <p className="mt-0.5 text-[10.5px] text-muted-foreground">
          {value == null
            ? "Donnée indisponible"
            : coloration === "vainqueur"
              ? nuanceLabel(String(value))
              : `${COLORATION_LABELS[coloration]} : ${colorationValueFmt(coloration)(Number(value))}`}
        </p>
      </div>
    </div>
  );
});

// ─── Accompagnement des débutants ─────────────────────────────────────────────

const COACH_KEY = "mouvancia.explorer.coach.v1";

const subscribeNoop = () => () => {};
function readCoachDismissed(): boolean {
  try {
    return window.localStorage.getItem(COACH_KEY) === "1";
  } catch {
    return true; // stockage indisponible (mode privé) : ne pas insister
  }
}

/**
 * Aide au premier usage : rappelle les 3 gestes de base tant que rien n'est
 * sélectionné. Une fois écartée (localStorage), il ne reste qu'une pastille
 * discrète invitant à cliquer sur la carte.
 */
function SelectionCoach() {
  // Lecture du localStorage via useSyncExternalStore : le snapshot serveur vaut
  // `null` (rien n'est rendu au prérendu) → aucun écart d'hydratation, et pas de
  // setState en effet.
  const stored = useSyncExternalStore(subscribeNoop, readCoachDismissed, () => null);
  const [justDismissed, setJustDismissed] = useState(false);
  const dismissed = justDismissed || stored;
  if (dismissed === null) return null;

  if (dismissed) {
    return (
      <div className="pointer-events-none absolute left-1/2 top-14 z-20 -translate-x-1/2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/90 px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur">
          <MousePointerClick className="h-3.5 w-3.5" /> Cliquez sur un territoire pour voir sa fiche
        </span>
      </div>
    );
  }

  const steps = [
    "Choisissez un scrutin (ou une analyse) à gauche.",
    "Choisissez ce que la couleur représente.",
    "Cliquez sur un territoire : sa fiche s’ouvre à droite.",
  ];
  return (
    <div className="absolute left-1/2 top-14 z-20 w-[min(22rem,calc(100%-1.5rem))] -translate-x-1/2">
      <div className="anim-pop-in rounded-2xl border border-foreground/5 bg-surface/95 p-3.5 shadow-floating backdrop-blur-md">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[12px] font-semibold tracking-tight">Premiers pas sur la carte</p>
          <button
            type="button"
            aria-label="Masquer l’aide"
            onClick={() => {
              try {
                window.localStorage.setItem(COACH_KEY, "1");
              } catch {
                /* stockage indisponible : on masque pour la session */
              }
              setJustDismissed(true);
            }}
            className="-mr-1 -mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <ol className="mt-2 flex flex-col gap-1.5">
          {steps.map((s, i) => (
            <li key={s} className="flex items-start gap-2 text-[11.5px] leading-snug text-muted-foreground">
              <span className="mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full bg-warm/15 text-[9.5px] font-semibold text-foreground">
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// ─── Panneau de contrôle (gauche) ─────────────────────────────────────────────

const ControlsPanel = memo(function ControlsPanel({
  maille,
  scrutin,
  coloration,
  update,
  isLoading,
  open,
  mobileOpen,
  onCloseMobile,
  onCollapse,
}: {
  maille: Maille;
  scrutin: Scrutin;
  coloration: Coloration;
  update: (p: { maille?: Maille; scrutin?: Scrutin; coloration?: Coloration; code?: string | null }) => void;
  isLoading: boolean;
  open: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onCollapse: () => void;
}) {
  const mailles = maillesFor(scrutin);

  return (
    <div
      // `inert` quand replié : le panneau reste monté (pas de re-montage coûteux)
      // mais sort du flux de tabulation et des lecteurs d'écran.
      inert={!open && !mobileOpen}
      className={cn(
        "absolute z-30 flex flex-col gap-5 overflow-y-auto rounded-2xl border border-foreground/5 bg-surface/95 p-4 shadow-floating backdrop-blur-md transition-[transform,opacity] duration-300",
        "inset-y-3 left-3 w-[86%] max-w-[330px]",
        "lg:bottom-3 lg:top-[3.25rem] lg:w-[288px]",
        mobileOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-[calc(100%+1rem)] max-lg:opacity-0",
        open ? "lg:translate-x-0 lg:opacity-100" : "lg:-translate-x-[calc(100%+1rem)] lg:opacity-0",
      )}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold tracking-tight">Explorer</h2>
        <div className="flex items-center gap-2">
          {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Fermer les filtres"
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onCollapse}
            aria-label="Replier le panneau pour agrandir la carte"
            title="Replier le panneau"
            className="hidden h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground lg:grid"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>

      <ScrutinPicker scrutin={scrutin} update={update} />

      <div className="h-px bg-foreground/5" />

      {/* Ordre calqué sur le parcours d'un novice : quoi (scrutin) → quelle
          couleur (indicateur) → à quelle échelle. */}
      <Section title="Colorer par">
        <div className="flex flex-col gap-3">
          {colorationGroups(scrutin).map((g, i) => (
            <div key={g.title ?? i} className="flex flex-col gap-1.5">
              {g.title && (
                <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground/70">{g.title}</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {g.items.map((c) => (
                  <Pill key={c} active={coloration === c} onClick={() => update({ coloration: c })}>
                    {pillLabel(c)}
                  </Pill>
                ))}
              </div>
            </div>
          ))}
        </div>
        {colorationHelp(coloration) && (
          <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-foreground/[0.03] px-2.5 py-2 text-[11px] leading-snug text-muted-foreground">
            <Info className="mt-px h-3 w-3 shrink-0" />
            {colorationHelp(coloration)}
          </p>
        )}
      </Section>

      <Section title="Échelle géographique">
        <div className="flex flex-col gap-1">
          {mailles.map((m) => (
            <button
              key={m}
              onClick={() => update({ maille: m, code: null })}
              className={cn(
                "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[12px] transition-colors",
                maille === m ? "bg-primary text-primary-foreground" : "hover:bg-foreground/[0.04]",
              )}
            >
              <span>{MAILLE_LABELS[m]}</span>
              <span className={cn("text-[10px] tabular-nums", maille === m ? "text-primary-foreground/60" : "text-muted-foreground")}>
                {fmtInt(MAILLE_COUNTS[m])}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-1 text-[10.5px] leading-snug text-muted-foreground/80">
          Plus l’échelle est fine, plus le détail est précis — et plus l’affichage
          demande de zoom pour être lisible.
        </p>
      </Section>
    </div>
  );
});

// ─── Sélecteur de scrutin à deux niveaux (type → année → tour) ────────────────

function ScrutinPicker({
  scrutin,
  update,
}: {
  scrutin: Scrutin;
  update: (p: { scrutin?: Scrutin; code?: string | null }) => void;
}) {
  const { family, year, tour } = parseScrutin(scrutin);
  const electionScrutin = isElection(scrutin);
  const years = electionScrutin ? yearsFor(family) : [];
  const tours = year != null ? toursFor(family, year) : [];

  // Sépare les familles « élection » des couches d'analyse (dérivées).
  const electionFamilies = FAMILY_ORDER.filter((f) => isElection(defaultScrutinFor(f)));
  const analysisFamilies = FAMILY_ORDER.filter((f) => !isElection(defaultScrutinFor(f)));

  function pickFamily(f: ScrutinFamily) {
    if (f === family) return;
    update({ scrutin: defaultScrutinFor(f), code: null });
  }
  function pickYear(y: number) {
    const next = scrutinFor(family, y, tour ?? 1) ?? scrutinFor(family, y, 1);
    if (next) update({ scrutin: next, code: null });
  }
  function pickTour(t: 1 | 2) {
    if (year == null) return;
    const next = scrutinFor(family, year, t);
    if (next) update({ scrutin: next, code: null });
  }

  const familyButton = (f: ScrutinFamily) => (
    <button
      key={f}
      type="button"
      onClick={() => pickFamily(f)}
      aria-pressed={family === f}
      className={cn(
        "rounded-lg px-2.5 py-1.5 text-center text-[12px] font-medium transition-colors",
        family === f
          ? "bg-warm/15 text-foreground ring-1 ring-warm/40"
          : "bg-foreground/[0.04] text-muted-foreground hover:bg-foreground/[0.08]",
      )}
    >
      {FAMILY_LABELS[f]}
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <Section title="Type de scrutin">
        <div className="grid grid-cols-2 gap-1.5">{electionFamilies.map(familyButton)}</div>
      </Section>

      {electionScrutin && (
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Section title="Année">
            <div className="flex flex-wrap gap-1.5">
              {years.map((y) => (
                <Pill key={y} active={year === y} onClick={() => pickYear(y)}>
                  {y}
                </Pill>
              ))}
            </div>
          </Section>
          {/* Tour unique (européennes) : le segment n'apporte rien → masqué. */}
          {tours.length > 1 && (
            <Section title="Tour">
              <div className="inline-flex rounded-lg bg-foreground/[0.04] p-0.5">
                {tours.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => pickTour(t)}
                    aria-pressed={tour === t}
                    className={cn(
                      "rounded-md px-3 py-1 text-[11px] font-medium transition-colors",
                      tour === t
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    T{t}
                  </button>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      <Section title="Analyses">
        <div className="grid grid-cols-3 gap-1.5">{analysisFamilies.map(familyButton)}</div>
        <p className="text-[10.5px] leading-snug text-muted-foreground/80">
          Couches dérivées des données : profil socio-démographique, évolutions entre scrutins, potentiel par bloc.
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full px-3 py-1 text-[11px] font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "bg-foreground/[0.04] text-muted-foreground hover:bg-foreground/[0.08]",
      )}
    >
      {children}
    </button>
  );
}

// ─── Barre supérieure carte ────────────────────────────────────────────────────

const MapTopBar = memo(function MapTopBar({
  scrutin,
  filtersOpen,
  onOpenSearch,
  onOpenFilters,
}: {
  scrutin: Scrutin;
  filtersOpen: boolean;
  onOpenSearch: () => void;
  onOpenFilters: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-center justify-between gap-2 p-3">
      <div className="flex min-w-0 items-center gap-2">
        <button
          onClick={onOpenFilters}
          aria-label="Ouvrir les filtres de la carte"
          title="Filtres"
          className={cn(
            "pointer-events-auto flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-surface/90 px-2 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-surface",
            filtersOpen && "lg:hidden",
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden pr-1 text-[12px] font-medium lg:inline">Filtres</span>
        </button>
        <div className="pointer-events-auto truncate rounded-full bg-surface/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground shadow-sm backdrop-blur">
          <span className="lg:hidden">{SCRUTIN_META[scrutin].short}</span>
          <span className="hidden lg:inline">{SCRUTIN_META[scrutin].long}</span>
        </div>
      </div>
      <button
        onClick={onOpenSearch}
        aria-label="Rechercher un territoire"
        className="pointer-events-auto flex shrink-0 items-center gap-2 rounded-full bg-surface/90 px-2.5 py-1.5 text-[12px] text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground sm:px-3"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Rechercher un territoire</span>
        <kbd className="hidden rounded bg-foreground/[0.06] px-1.5 py-0.5 text-[10px] sm:inline">⌘K</kbd>
      </button>
    </div>
  );
});

// ─── Légende ───────────────────────────────────────────────────────────────────

const MapBottomLegend = memo(function MapBottomLegend({
  coloration,
  winnerRows,
  shiftedRight,
  hiddenOnMobile,
}: {
  coloration: Coloration;
  winnerRows?: WinningNuanceRow[];
  /** Décale la légende quand le panneau de contrôle est déplié (desktop). */
  shiftedRight: boolean;
  /** Masquée sur mobile quand la fiche occupe le bas de l'écran. */
  hiddenOnMobile: boolean;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute bottom-3 left-3 z-20 max-w-[300px] rounded-xl bg-surface/90 p-3 shadow-card backdrop-blur transition-[left] duration-300",
        shiftedRight ? "lg:left-[19.5rem]" : "lg:left-3",
        hiddenOnMobile && "max-lg:hidden",
      )}
    >
      <p className="mb-1.5 text-[10px] font-semibold uppercase leading-snug tracking-[0.07em] text-muted-foreground">
        {COLORATION_LABELS[coloration]}
      </p>
      {coloration === "vainqueur" ? (
        <NuanceMiniLegend rows={winnerRows ?? []} />
      ) : coloration === "participation" ? (
        <ContinuousMiniLegend stops={PARTICIPATION_STOPS} fmt={(v) => fmtPct(v, 0)} />
      ) : coloration === "abstention" ? (
        <ContinuousMiniLegend stops={ABSTENTION_STOPS} fmt={(v) => fmtPct(v, 0)} />
      ) : BLOC_DEF[coloration] ? (
        <ContinuousMiniLegend stops={BLOC_DEF[coloration].stops} fmt={(v) => fmtPct(v, 0)} />
      ) : coloration === "revenu" ? (
        <ContinuousMiniLegend stops={REVENU_STOPS} fmt={(v) => `${Math.round(v / 1000)}k`} />
      ) : coloration === "pauvrete" ? (
        <ContinuousMiniLegend stops={PAUVRETE_STOPS} fmt={(v) => `${v}%`} />
      ) : coloration === "inegalites" ? (
        <ContinuousMiniLegend stops={INEGALITES_STOPS} fmt={(v) => `${v}`} />
      ) : coloration === "prestations" ? (
        <ContinuousMiniLegend stops={PRESTATIONS_STOPS} fmt={(v) => `${v}%`} />
      ) : coloration === "pensions" ? (
        <ContinuousMiniLegend stops={PENSIONS_STOPS} fmt={(v) => `${v}%`} />
      ) : coloration === "age65" ? (
        <ContinuousMiniLegend stops={AGE65_STOPS} fmt={(v) => `${v}%`} />
      ) : coloration === "chomage" ? (
        <ContinuousMiniLegend stops={CHOMAGE_STOPS} fmt={(v) => `${v}%`} />
      ) : coloration === "cadres" ? (
        <ContinuousMiniLegend stops={CADRES_STOPS} fmt={(v) => `${v}%`} />
      ) : coloration === "diplome" ? (
        <ContinuousMiniLegend stops={DIPLOME_STOPS} fmt={(v) => `${v}%`} />
      ) : coloration === "proprietaires" ? (
        <ContinuousMiniLegend stops={PROPRIETAIRES_STOPS} fmt={(v) => `${v}%`} />
      ) : coloration === "ressecondaires" ? (
        <ContinuousMiniLegend stops={RESSEC_STOPS} fmt={(v) => `${v}%`} />
      ) : coloration === "logvacants" ? (
        <ContinuousMiniLegend stops={LOGVAC_STOPS} fmt={(v) => `${v}%`} />
      ) : coloration === "monoparentales" ? (
        <ContinuousMiniLegend stops={MONO_STOPS} fmt={(v) => `${v}%`} />
      ) : coloration === "personnes-seules" ? (
        <ContinuousMiniLegend stops={PSEUL_STOPS} fmt={(v) => `${v}%`} />
      ) : coloration === "nouveaux-arrivants" ? (
        <ContinuousMiniLegend stops={NOUVARR_STOPS} fmt={(v) => `${v}%`} />
      ) : coloration === "ouvriers" ? (
        <ContinuousMiniLegend stops={OUVRIERS_STOPS} fmt={(v) => `${v}%`} />
      ) : coloration === "densite" ? (
        <ContinuousMiniLegend stops={DENSITE_STOPS} fmt={(v) => (v >= 1000 ? `${v / 1000}k` : `${v}`)} />
      ) : coloration === "jeunes" ? (
        <ContinuousMiniLegend stops={JEUNES_STOPS} fmt={(v) => `${v}%`} />
      ) : coloration === "evopop" ? (
        <ContinuousMiniLegend stops={EVOPOP_STOPS} fmt={(v) => `${v > 0 ? "+" : ""}${v}%`} />
      ) : TREND_DEF[coloration] ? (
        <ContinuousMiniLegend stops={TREND_DEF[coloration]!.stops} fmt={fmtSignedPts} />
      ) : POT_DEF[coloration] ? (
        <ContinuousMiniLegend stops={POTENTIEL_STOPS} fmt={fmtSignedInt} />
      ) : null}
    </div>
  );
});

function NuanceMiniLegend({ rows }: { rows: WinningNuanceRow[] }) {
  const present = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.nuance, (counts.get(r.nuance) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [rows]);

  if (present.length === 0) {
    return <p className="text-[11px] text-muted-foreground">Sélectionnez un indicateur disponible.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
      {present.map(([nuance]) => (
        <div key={nuance} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: nuanceColor(nuance) }} />
          <span className="truncate text-[11px] text-foreground">{nuanceLabel(nuance)}</span>
        </div>
      ))}
    </div>
  );
}

function ContinuousMiniLegend({
  stops,
  fmt,
}: {
  stops: Array<[number, string]>;
  fmt: (v: number) => string;
}) {
  const gradient = `linear-gradient(90deg, ${stops.map((s) => s[1]).join(", ")})`;
  return (
    <div className="flex flex-col gap-1">
      <div className="h-2.5 w-full rounded-full" style={{ background: gradient }} />
      <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground">
        <span>{fmt(stops[0][0])}</span>
        <span>{fmt(stops[stops.length - 1][0])}</span>
      </div>
    </div>
  );
}

// ─── Fiche territoire (droite) ──────────────────────────────────────────────────

type FicheTab = "resultats" | "socio" | "france" | "tendances" | "potentiel";

const FicheTerritoire = memo(function FicheTerritoire({
  code,
  maille,
  scrutin,
  lastClicked,
  onClear,
}: {
  code: string | null;
  maille: Maille;
  scrutin: Scrutin;
  lastClicked: { code: string; name: string; maille: Maille } | null;
  onClear: () => void;
}) {
  const election = isElection(scrutin);
  const isCommune = maille === "communes";
  const isBureau = maille === "bureaux";
  const isTrends = scrutin === "tendances";
  const isPot = scrutin === "potentiel";
  const hasSocio = isCommune || isBureau;

  // Onglet par défaut selon le contexte (scrutin × maille).
  const defaultTab: FicheTab = election
    ? "resultats"
    : isTrends
      ? "tendances"
      : isPot
        ? "potentiel"
        : hasSocio
          ? "socio"
          : "france";
  const [tab, setTab] = useState<FicheTab>(defaultTab);

  // Réinitialise l'onglet quand on change de territoire ou de scrutin/maille —
  // ajusté pendant le rendu (pas d'effet, donc pas de rendu en cascade).
  const ctxKey = `${code}|${scrutin}|${maille}`;
  const [tabCtx, setTabCtx] = useState(ctxKey);
  if (ctxKey !== tabCtx) {
    setTabCtx(ctxKey);
    setTab(defaultTab);
  }

  const detail = useScrutinDetail(election ? scrutin : null, maille, code);
  const socio = useSociologieCommune(isCommune ? code : null);
  const bureauSocio = useSociologieBureau(isBureau ? code : null);
  const trendsPresid = useTrendsTerritoire("presid_2017_2022", isTrends ? maille : null, isTrends ? code : null);
  const trendsLegis = useTrendsTerritoire("legis_2022_2024", isTrends ? maille : null, isTrends ? code : null);
  const potentielTerr = usePotentielTerritoire(isPot ? code : null);
  const potMeta = usePotentielMeta();
  const nationalPart = useScrutinNationalParticipation(election ? scrutin : null);

  if (!code) return <FicheEmpty />;

  const cachedName = lastClicked?.code === code ? lastClicked.name : null;
  const displayName =
    maille === "circonscriptions"
      ? circoLabel(code)
      : (cachedName ?? detail.data?.libelle ?? `Code ${code}`);

  const tabs: { id: FicheTab; label: string; enabled: boolean }[] = [
    { id: "resultats", label: "Résultats", enabled: election },
    { id: "tendances", label: "Dynamiques", enabled: isTrends },
    { id: "potentiel", label: "Potentiel", enabled: isPot },
    { id: "socio", label: "Socio-démo", enabled: hasSocio },
    { id: "france", label: "vs France", enabled: election || hasSocio },
  ];
  const active = tabs.find((t) => t.id === tab && t.enabled) ?? tabs.find((t) => t.enabled);
  const tabId = active?.id ?? "resultats";

  const loading =
    (election && detail.isFetching && !detail.data) ||
    (isCommune && socio.isFetching && !socio.data) ||
    (isBureau && bureauSocio.isFetching && !bureauSocio.data) ||
    (isTrends && trendsPresid.isFetching && !trendsPresid.data) ||
    (isPot && potentielTerr.isFetching && !potentielTerr.data);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-2 border-b border-foreground/5 p-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {MAILLE_LABELS[maille]}
          </p>
          <h3 className="truncate text-[15px] font-semibold tracking-tight">{displayName}</h3>
          {(maille === "circonscriptions" || maille === "communes" || maille === "bureaux") && (
            <Link
              href={
                maille === "circonscriptions"
                  ? `/circo/${encodeURIComponent(code)}`
                  : maille === "communes"
                    ? `/commune/${encodeURIComponent(code)}`
                    : `/bureau/${encodeURIComponent(code)}`
              }
              className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-warm transition-opacity hover:opacity-80"
            >
              Fiche complète
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          )}
        </div>
        <button
          onClick={onClear}
          className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex gap-1 border-b border-foreground/5 px-3 pt-2">
        {tabs.filter((t) => t.enabled).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "relative px-2.5 pb-2 pt-1 text-[12px] font-medium transition-colors",
              tabId === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {tabId === t.id && <span className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-warm" />}
          </button>
        ))}
      </div>

      <div key={`${tabId}-${code}`} className="anim-fade-in min-h-0 flex-1 overflow-y-auto p-4">
        {loading ? (
          <FicheLoading />
        ) : tabId === "resultats" ? (
          detail.data ? <ResultsBlock detail={detail.data} /> : <FicheUnavailable />
        ) : tabId === "tendances" ? (
          <TrendsBlock presid={trendsPresid.data ?? null} legis={trendsLegis.data ?? null} />
        ) : tabId === "potentiel" ? (
          <PotentielBlock rows={potentielTerr.data ?? null} meta={potMeta.data ?? null} />
        ) : tabId === "socio" ? (
          isBureau ? (
            <BureauSocioBlock socio={bureauSocio.data ?? null} />
          ) : (
            <SocioBlock socio={socio.data ?? null} />
          )
        ) : (
          <FranceBlock
            detail={detail.data ?? null}
            socio={isBureau ? (bureauSocio.data ?? null) : (socio.data ?? null)}
            nationalPart={nationalPart.data ?? null}
          />
        )}
      </div>
    </div>
  );
});

function ResultsBlock({ detail }: { detail: ScrutinDetail }) {
  const top = detail.candidates.slice(0, 6);
  const winner = top[0];
  const maxPct = Math.max(...top.map((c) => c.pct), 0.0001);

  return (
    <div className="flex flex-col gap-5">
      {winner && (
        <div>
          <p className="text-[11px] text-muted-foreground">Arrive en tête</p>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="text-[26px] font-semibold leading-none tracking-tight">
              {fmtPct(winner.pct)}
            </span>
            <span className="truncate text-[13px] font-medium" style={{ color: nuanceColor(winner.nuance) }}>
              {winner.label || nuanceLabel(winner.nuance)}
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {top.map((c, i) => (
          <div key={`${c.label}-${i}`} className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2 text-[12px]">
              <span className="flex min-w-0 items-center gap-1.5">
                {c.elu && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />}
                <span className="truncate">{c.label || nuanceLabel(c.nuance)}</span>
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{fmtPct(c.pct)}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.05]">
              <div
                className="h-full rounded-full"
                style={{ width: `${(c.pct / maxPct) * 100}%`, background: nuanceColor(c.nuance) }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <KPICard label="Participation" value={fmtPct(detail.participation)} />
        <KPICard label="Inscrits" value={fmtInt(detail.inscrits)} />
        <KPICard label="Votants" value={fmtInt(detail.votants)} />
        <KPICard label="Exprimés" value={fmtInt(detail.exprimes)} />
      </div>
    </div>
  );
}

function SocioBlock({ socio }: { socio: CommuneSociologie | null }) {
  if (!socio || (socio.revenuMedian == null && socio.tauxPauvrete == null)) {
    return <p className="text-[12px] text-muted-foreground">Données INSEE indisponibles pour ce territoire.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {socio.revenuMedian != null && (
        <KPICard
          label="Revenu médian disponible"
          value={fmtEuro(socio.revenuMedian)}
          hint={`France : ${fmtEuro(FR.revenuMedian)}`}
        />
      )}
      {socio.tauxPauvrete != null && (
        <KPICard
          label="Taux de pauvreté"
          value={`${socio.tauxPauvrete.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`}
          hint={`France : ${FR.tauxPauvrete} %`}
        />
      )}
    </div>
  );
}

function BureauSocioBlock({ socio }: { socio: BureauSociologie | null }) {
  if (!socio || (socio.revenuMedian == null && socio.tauxPauvrete == null && socio.partCadres == null)) {
    return <p className="text-[12px] text-muted-foreground">Données INSEE indisponibles pour ce bureau.</p>;
  }
  const pct = (n: number | null) => (n != null ? `${n.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %` : "—");
  const profil: { label: string; value: number | null }[] = [
    { label: "Cadres", value: socio.partCadres },
    { label: "Ouvriers", value: socio.partOuvriers },
    { label: "65 ans +", value: socio.part65plus },
    { label: "Diplômés sup.", value: socio.partDiplomeSup },
    { label: "Chômage", value: socio.tauxChomage },
  ].filter((r) => r.value != null);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10.5px] leading-snug text-muted-foreground">
        Profil socio-démographique à l’échelle de la <strong className="font-medium text-foreground/80">commune</strong> du bureau (INSEE).
      </p>
      {socio.revenuMedian != null && (
        <KPICard label="Revenu médian disponible" value={fmtEuro(socio.revenuMedian)} hint={`France : ${fmtEuro(FR.revenuMedian)}`} />
      )}
      {socio.tauxPauvrete != null && (
        <KPICard
          label="Taux de pauvreté"
          value={`${socio.tauxPauvrete.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`}
          hint={`France : ${FR.tauxPauvrete} %`}
        />
      )}
      {profil.length > 0 && (
        <div className="mt-0.5 grid grid-cols-2 gap-1.5">
          {profil.map((r) => (
            <div key={r.label} className="rounded-lg border border-foreground/5 bg-surface/60 px-2.5 py-1.5">
              <p className="text-[10px] uppercase tracking-[0.04em] text-muted-foreground">{r.label}</p>
              <p className="text-[14px] font-semibold tabular-nums tracking-tight">{pct(r.value)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TrendComparison({ title, period, trends }: { title: string; period: string; trends: TerritoireTrends | null }) {
  if (!trends || (trends.dAbstention == null && trends.dRn == null && trends.dGauche == null)) return null;
  const rows: { label: string; delta: number | null; level: number | null }[] = [
    { label: "RN / extrême droite", delta: trends.dRn, level: trends.rnNow },
    { label: "Gauche / NFP", delta: trends.dGauche, level: trends.gaucheNow },
    { label: "Abstention", delta: trends.dAbstention, level: trends.abstNow },
  ];
  return (
    <div>
      <p className="text-[11px] font-semibold">{title}</p>
      <p className="mb-1.5 text-[10px] text-muted-foreground">{period}</p>
      <div className="flex flex-col gap-1.5">
        {rows.map((r) => {
          if (r.delta == null) return null;
          const up = r.delta >= 0;
          return (
            <div key={r.label} className="flex items-baseline justify-between gap-2 rounded-lg border border-foreground/5 bg-surface/60 px-2.5 py-1.5">
              <span className="text-[11.5px]">{r.label}</span>
              <span className="flex items-baseline gap-2">
                {r.level != null && <span className="text-[10px] text-muted-foreground tabular-nums">{fmtPct(r.level, 0)}</span>}
                <span className={cn("text-[12.5px] font-semibold tabular-nums", up ? "text-rose-600" : "text-emerald-600")}>
                  {fmtSignedPts(r.delta)} pts
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrendsBlock({ presid, legis }: { presid: TerritoireTrends | null; legis: TerritoireTrends | null }) {
  if (!presid && !legis) {
    return <p className="text-[12px] text-muted-foreground">Dynamique indisponible pour ce territoire.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[10.5px] leading-snug text-muted-foreground">
        Évolution des blocs (part des exprimés) et de l’abstention (part des inscrits). Hausse en rouge, recul en vert.
      </p>
      <TrendComparison title="Présidentielle" period="2017 → 2022 · 1ᵉ tour" trends={presid} />
      <TrendComparison title="Législatives" period="2022 → 2024 · 1ᵉ tour" trends={legis} />
    </div>
  );
}

const POT_BLOC_LABEL: Record<PotentielBloc, string> = {
  rn: "RN / extrême droite",
  gauche: "Gauche / NFP",
  ecolo: "Écologistes",
  centre: "Centre",
  droite: "Droite (LR)",
};

function PotentielBlock({ rows, meta }: { rows: PotentielRow[] | null; meta: PotentielMeta | null }) {
  if (!rows || rows.every((r) => r.potentiel == null)) {
    return <p className="text-[12px] text-muted-foreground">Indice de potentiel indisponible (commune sans données socio).</p>;
  }
  const sorted = [...rows].filter((r) => r.potentiel != null).sort((a, b) => (b.potentiel ?? 0) - (a.potentiel ?? 0));
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[10.5px] leading-snug text-muted-foreground">
        <strong className="font-medium text-foreground/80">Affinité</strong> = score attendu vu le profil socio (présid. 2022).
        <strong className="font-medium text-foreground/80"> Potentiel</strong> = attendu − réel : positif = terrain favorable sous-exploité, négatif = bastion qui sur-performe.
      </p>
      {sorted.map((r) => {
        const pos = (r.potentiel ?? 0) >= 0;
        const r2 = meta?.[r.bloc]?.r2;
        return (
          <div key={r.bloc} className="rounded-xl border border-foreground/5 bg-surface/60 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12.5px] font-medium">{POT_BLOC_LABEL[r.bloc]}</span>
              <span className={cn("text-[15px] font-semibold tabular-nums", pos ? "text-orange-600" : "text-teal-600")}>
                {fmtSignedInt(r.potentiel ?? 0)} pts
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 text-[10.5px] text-muted-foreground">
              <span className="tabular-nums">attendu {r.affinite?.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}% · réel {r.reel?.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}%</span>
              {r2 != null && (
                <span title="Qualité du modèle socio (part de variance expliquée)">
                  fiabilité {r2 >= 0.3 ? "bonne" : r2 >= 0.15 ? "moyenne" : "faible"}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FranceBlock({
  detail,
  socio,
  nationalPart,
}: {
  detail: ScrutinDetail | null;
  // Commune ou bureau : on ne lit que revenu/pauvreté → type structurel minimal.
  socio: Pick<CommuneSociologie, "revenuMedian" | "tauxPauvrete"> | null;
  nationalPart: number | null;
}) {
  const rows: { label: string; local: number; national: number; fmt: (n: number) => string; pts?: boolean }[] = [];
  if (detail && nationalPart != null) {
    rows.push({ label: "Participation", local: detail.participation, national: nationalPart, fmt: (n) => fmtPct(n, 1), pts: true });
  }
  if (socio?.revenuMedian != null) {
    rows.push({ label: "Revenu médian", local: socio.revenuMedian, national: FR.revenuMedian, fmt: fmtEuro });
  }
  if (socio?.tauxPauvrete != null) {
    rows.push({ label: "Taux de pauvreté", local: socio.tauxPauvrete, national: FR.tauxPauvrete, fmt: (n) => `${n.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`, pts: true });
  }

  if (rows.length === 0) {
    return <p className="text-[12px] text-muted-foreground">Comparaison indisponible pour ce territoire.</p>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r) => {
        const delta = r.local - r.national;
        const up = delta >= 0;
        const deltaStr = r.pts
          ? `${up ? "+" : ""}${(delta * (r.label === "Participation" ? 100 : 1)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} pts`
          : `${up ? "+" : ""}${((delta / r.national) * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
        return (
          <div key={r.label} className="rounded-xl border border-foreground/5 bg-surface/60 p-3">
            <p className="text-[11px] text-muted-foreground">{r.label}</p>
            <div className="mt-0.5 flex items-baseline justify-between gap-2">
              <span className="text-[16px] font-semibold tabular-nums">{r.fmt(r.local)}</span>
              <span className={cn("text-[11px] font-medium tabular-nums", up ? "text-emerald-600" : "text-rose-600")}>
                {deltaStr}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">France : {r.fmt(r.national)}</p>
          </div>
        );
      })}
    </div>
  );
}

function KPICard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-foreground/5 bg-surface/60 p-2.5">
      <p className="text-[10px] uppercase tracking-[0.05em] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[15px] font-semibold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function FicheEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        Aucune sélection
      </p>
      <p className="text-[13px] text-muted-foreground">Cliquez sur un territoire pour ouvrir sa fiche.</p>
    </div>
  );
}

function FicheUnavailable() {
  return <p className="text-[12px] text-muted-foreground">Résultats indisponibles à cette maille.</p>;
}

function FicheLoading() {
  return (
    <div className="flex flex-col gap-3">
      <div className="h-6 w-2/3 animate-pulse rounded bg-foreground/[0.06]" />
      <div className="h-2 w-full animate-pulse rounded bg-foreground/[0.06]" />
      <div className="h-2 w-5/6 animate-pulse rounded bg-foreground/[0.06]" />
      <div className="h-2 w-4/6 animate-pulse rounded bg-foreground/[0.06]" />
    </div>
  );
}

export default ExplorerView;
export { ExplorerView };
