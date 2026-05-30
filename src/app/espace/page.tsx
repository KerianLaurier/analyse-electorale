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
  let members: WsMember[] = [{ id: user.id, name: meName, email: user.email ?? "" }];

  if (teamId) {
    const [{ data: t }, { data: m }] = await Promise.all([
      supabase.from("teams").select("name").eq("id", teamId).single(),
      supabase.from("profiles").select("id, full_name, email").eq("team_id", teamId),
    ]);
    teamName = t?.name ?? null;
    if (m && m.length > 0) {
      members = m.map((row) => ({
        id: row.id,
        name: (row.full_name as string | null)?.trim() || (row.email as string | null) || "Membre",
        email: (row.email as string | null) ?? "",
      }));
    }
  }

  const ctx: WsContext = { meId: user.id, meName, teamId, teamName, members };

  return <EspaceView ctx={ctx} initialTab={tab} />;
}
