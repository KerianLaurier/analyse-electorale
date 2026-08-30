import type { TeamRole } from "@/lib/team";

export type WsMember = { id: string; name: string; email: string; roles: TeamRole[] };

/**
 * Rôle structurel dans le QG. Distinct des **rôles de campagne**
 * (`TeamRole` : « Logistique », « Responsable terrain »…), qui sont des
 * étiquettes libres définies par l'équipe et n'ouvrent aucun droit.
 *
 * - `owner` : a créé l'équipe (ou travaille seul dans son espace personnel).
 *   Définit le plan — cible, objectif de voix, découpage en secteurs.
 * - `member` : a rejoint une équipe. Exécute et rend compte du terrain, mais ne
 *   redéfinit pas le plan.
 *
 * Dérivé de `profiles.role` et de `teams.created_by` (aucune migration) —
 * cf. `src/app/(app)/espace/layout.tsx`.
 */
export type WsRole = "owner" | "member";

export type WsContext = {
  meId: string;
  meName: string;
  teamId: string | null;
  teamName: string | null;
  members: WsMember[];
  role: WsRole;
  /** Espace personnel : pas d'équipe, donc pas de partage ni de rôles. */
  isSolo: boolean;
};

/**
 * Droit de modifier le PLAN de campagne (cible, objectif chiffré, création et
 * suppression de secteurs). Réservé au responsable.
 *
 * Le compte rendu de terrain — statut d'un secteur, personnes contactées,
 * favorables — reste ouvert à tous les membres : c'est précisément leur travail.
 *
 * ⚠ Garde-fou d'INTERFACE uniquement. Les politiques RLS de `campaigns` et
 * `sectors` sont aujourd'hui à l'échelle de l'équipe : un membre déterminé peut
 * encore écrire via l'API. Restreindre côté base demande une migration
 * (cf. la note dans le README).
 */
export function canEditPlan(ctx: WsContext): boolean {
  return ctx.role === "owner";
}

/** Nom lisible d'un membre par son id (fallback : « — »). */
export function memberName(members: WsMember[], id: string | null): string {
  if (!id) return "—";
  return members.find((m) => m.id === id)?.name ?? "Membre";
}

/** Rôles de campagne d'un membre par son id. */
export function memberRolesOf(members: WsMember[], id: string | null): TeamRole[] {
  if (!id) return [];
  return members.find((m) => m.id === id)?.roles ?? [];
}

export function memberInitials(name: string): string {
  const parts = name.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}
