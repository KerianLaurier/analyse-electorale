import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TeamView, type Account, type Team, type Member } from "@/app/auth/team/team-view";

export default async function TeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/auth/team");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, organisation, role, subscription_status, subscription_tier, trial_ends_at, team_id")
    .eq("id", user.id)
    .single();

  const account: Account = {
    id: user.id,
    email: user.email ?? "",
    fullName: profile?.full_name ?? null,
    organisation: profile?.organisation ?? null,
    role: profile?.role ?? "member",
    status: (profile?.subscription_status ?? "inactive") as Account["status"],
    tier: profile?.subscription_tier ?? "candidat",
    trialEndsAt: profile?.trial_ends_at ?? null,
    teamId: (profile?.team_id as string | null) ?? null,
  };

  let team: Team | null = null;
  let members: Member[] = [];

  if (account.teamId) {
    const [{ data: t }, { data: m }] = await Promise.all([
      supabase.from("teams").select("id, name, join_code").eq("id", account.teamId).single(),
      supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .eq("team_id", account.teamId)
        .order("role", { ascending: true }),
    ]);
    if (t) team = { id: t.id, name: t.name, joinCode: t.join_code };
    members = (m ?? []).map((row) => ({
      id: row.id,
      fullName: row.full_name ?? null,
      email: row.email ?? "",
      role: row.role ?? "member",
    }));
  }

  return <TeamView account={account} team={team} members={members} />;
}
