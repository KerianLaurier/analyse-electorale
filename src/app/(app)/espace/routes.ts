/**
 * Plan de routes du QG — source unique des URL des 4 sections.
 *
 * Le QG tenait auparavant dans une seule route (`/espace?tab=…`) qui importait
 * statiquement ses 10 vues : le bénévole qui ouvrait le phoning téléchargeait
 * aussi la carte du porte-à-porte et le calendrier des permanences. Chaque
 * section est désormais un vrai segment de route, donc son propre lot de code.
 *
 * À l'intérieur d'une section, la vue courante reste un paramètre d'URL
 * (`?vue=`) : ces 3-4 écrans se consultent en alternance et partagent leurs
 * données, les séparer n'apporterait rien.
 */

export type PlanVue = "campagne" | "territoire" | "epingles";
export type TerrainVue = "actions" | "permanences" | "porte-a-porte" | "phoning";
export type EquipeVue = "membres" | "contacts" | "notes";

const withVue = (base: string, vue?: string) => (vue ? `${base}?vue=${vue}` : base);

export const ESPACE = {
  /** Tableau de bord — « aujourd'hui ». */
  today: "/espace",
  /** Le plan : cible, objectif de voix, secteurs, territoires suivis. */
  plan: (vue?: PlanVue) => withVue("/espace/plan", vue),
  /** Le terrain : porte-à-porte, phoning, permanences, actions. */
  terrain: (vue?: TerrainVue) => withVue("/espace/terrain", vue),
  /** L'équipe : membres et rôles, contacts, notes partagées. */
  equipe: (vue?: EquipeVue) => withVue("/espace/equipe", vue),
} as const;

/**
 * Anciens onglets (`/espace?tab=…`) → nouvelles adresses.
 *
 * Ces liens ont pu être partagés entre membres d'une équipe ou mis en favori ;
 * `/espace` les redirige au lieu de les laisser retomber silencieusement sur le
 * tableau de bord (cf. `src/app/(app)/espace/page.tsx`).
 */
export const LEGACY_TAB_REDIRECTS: Record<string, string> = {
  overview: ESPACE.today,
  campaign: ESPACE.plan("campagne"),
  territoire: ESPACE.plan("territoire"),
  pins: ESPACE.plan("epingles"),
  tasks: ESPACE.terrain("actions"),
  shifts: ESPACE.terrain("permanences"),
  canvass: ESPACE.terrain("porte-a-porte"),
  phoning: ESPACE.terrain("phoning"),
  contacts: ESPACE.equipe("contacts"),
  notes: ESPACE.equipe("notes"),
};

/** Vue courante d'une section, avec repli sur la première si l'URL est fantaisiste. */
export function pickVue<T extends string>(raw: string | null, allowed: readonly T[]): T {
  return allowed.includes(raw as T) ? (raw as T) : allowed[0];
}
