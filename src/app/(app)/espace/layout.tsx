import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EspaceShell } from "@/app/(app)/espace/espace-shell";
import type { WsContext, WsMember, WsRole } from "@/app/(app)/espace/types";

export const metadata: Metadata = { title: "Quartier général" };

/**
 * Layout du QG : charge une seule fois le contexte d'équipe (membres, rôles de
 * campagne) et le rôle de la personne connectée, puis le partage aux 4 sections
 * via `EspaceShell`.
 *
 * Le faire ici plutôt que dans chaque page évite de refaire ces cinq requêtes à
 * chaque changement de section : un layout n'est pas re-rendu quand on navigue
 * entre ses segments enfants.
 */
export default async function EspaceLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/espace");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, team_id, role")
    .eq("id", user.id)
    .single();

  const meName = profile?.full_name?.trim() || user.email || "Moi";
  const teamId = (profile?.team_id as string | null) ?? null;

  let teamName: string | null = null;
  let members: WsMember[] = [{ id: user.id, name: meName, email: user.email ?? "", roles: [] }];
  // Espace personnel : personne d'autre, donc responsable de fait.
  let role: WsRole = "owner";

  if (teamId) {
    const [{ data: t }, { data: m }, { data: roles }, { data: assigns }] = await Promise.all([
      supabase.from("teams").select("name, created_by").eq("id", teamId).single(),
      supabase.from("profiles").select("id, full_name, email").eq("team_id", teamId),
      supabase.from("team_roles").select("id, name, color").eq("team_id", teamId).order("created_at", { ascending: true }),
      supabase.from("member_roles").select("member_id, role_id").eq("team_id", teamId),
    ]);
    teamName = t?.name ?? null;

    // Deux sources concordantes, aucune migration nécessaire : la colonne
    // `profiles.role` ('owner' / 'member') et le créateur de l'équipe. On
    // retient la plus permissive — une équipe importée peut avoir l'une sans
    // l'autre, et priver son créateur de l'édition du plan serait un blocage.
    const createdBy = (t?.created_by as string | null) ?? null;
    role = profile?.role === "owner" || createdBy === user.id ? "owner" : "member";

    const roleById = new Map<string, { id: string; name: string; color: string }>();
    for (const r of roles ?? []) roleById.set(r.id as string, { id: r.id as string, name: r.name as string, color: r.color as string });
    const rolesByMember = new Map<string, { id: string; name: string; color: string }[]>();
    for (const a of assigns ?? []) {
      const assigned = roleById.get(a.role_id as string);
      if (!assigned) continue;
      const arr = rolesByMember.get(a.member_id as string) ?? [];
      arr.push(assigned);
      rolesByMember.set(a.member_id as string, arr);
    }

    if (m && m.length > 0) {
      members = m.map((row) => ({
        id: row.id,
        name: (row.full_name as string | null)?.trim() || (row.email as string | null) || "Membre",
        email: (row.email as string | null) ?? "",
        roles: rolesByMember.get(row.id as string) ?? [],
      }));
    }
  }

  const ctx: WsContext = {
    meId: user.id,
    meName,
    teamId,
    teamName,
    members,
    role,
    isSolo: teamId === null,
  };

  return <EspaceShell ctx={ctx}>{children}</EspaceShell>;
}
