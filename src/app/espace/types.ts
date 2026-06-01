import type { TeamRole } from "@/lib/team";

export type WsMember = { id: string; name: string; email: string; roles: TeamRole[] };

export type WsContext = {
  meId: string;
  meName: string;
  teamId: string | null;
  teamName: string | null;
  members: WsMember[];
};

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
