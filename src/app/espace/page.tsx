import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EspaceView } from "@/app/espace/espace-view";
import type { WsContext, WsMember } from "@/app/espace/types";

export default async function EspacePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/espace");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, team_id")
    .eq("id", user.id)
    .single();

  const meName = profile?.full_name?.trim() || user.email || "Moi";
  const teamId = (profile?.team_id as string | null) ?? null;

  let teamName: string | null = null;
  let members: WsMember[] = [{ id: user.id, name: meName, email: user.email ?? "", roles: [] }];

  if (teamId) {
    const [{ data: t }, { data: m }, { data: roles }, { data: assigns }] = await Promise.all([
      supabase.from("teams").select("name").eq("id", teamId).single(),
      supabase.from("profiles").select("id, full_name, email").eq("team_id", teamId),
      supabase.from("team_roles").select("id, name, color").eq("team_id", teamId).order("created_at", { ascending: true }),
      supabase.from("member_roles").select("member_id, role_id").eq("team_id", teamId),
    ]);
    teamName = t?.name ?? null;

    const roleById = new Map<string, { id: string; name: string; color: string }>();
    for (const r of roles ?? []) roleById.set(r.id as string, { id: r.id as string, name: r.name as string, color: r.color as string });
    const rolesByMember = new Map<string, { id: string; name: string; color: string }[]>();
    for (const a of assigns ?? []) {
      const role = roleById.get(a.role_id as string);
      if (!role) continue;
      const arr = rolesByMember.get(a.member_id as string) ?? [];
      arr.push(role);
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

  const ctx: WsContext = { meId: user.id, meName, teamId, teamName, members };

  return <EspaceView ctx={ctx} initialTab={tab} />;
}
