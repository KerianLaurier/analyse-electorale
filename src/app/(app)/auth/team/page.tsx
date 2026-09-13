import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  TeamView,
  type Account,
  type Team,
  type Member,
  type MemberRole,
} from "@/app/(app)/auth/team/team-view";
import { parseWorkspaceEntitlement } from "@/lib/workspace-entitlement";
import type { TeamRole } from "@/lib/team";

export default async function TeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/auth/team");

  // Profil personnel ; la RPC ci-dessous résout les droits effectifs.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError) throw profileError;
  if (!profile) throw new Error("Profil indisponible");

  const { data: rights, error: rightsError } = await supabase.rpc(
    "workspace_entitlement",
  );
  if (rightsError) throw rightsError;
  const entitlement = parseWorkspaceEntitlement(rights);

  const account: Account = {
    id: user.id,
    email: user.email ?? "",
    fullName: profile?.full_name ?? null,
    organisation: profile?.organisation ?? null,
    role: profile?.role ?? "member",
    status: (profile?.subscription_status ?? "inactive") as Account["status"],
    tier: profile?.subscription_tier ?? "candidat",
    trialEndsAt: profile?.trial_ends_at ?? null,
    cancelAt: (profile?.cancel_at as string | null) ?? null,
    billingCycle: (profile?.billing_cycle as Account["billingCycle"]) ?? null,
    startedAt: (profile?.subscription_started_at as string | null) ?? null,
    teamId: (profile?.team_id as string | null) ?? null,
    coveredByTeam: entitlement.covered_by_team,
    personalBilling: !!profile?.stripe_customer_id,
    billingOwnerActive:
      entitlement.billing_owner_id === user.id &&
      profile?.subscription_status === "active" &&
      entitlement.seat_limit > 0,
  };

  if (entitlement.covered_by_team)
    Object.assign(account, entitlement.subscription);

  let team: Team | null = null;
  let members: Member[] = [];
  let teamRoles: TeamRole[] = [];
  let memberRoles: MemberRole[] = [];

  if (account.teamId) {
    const [{ data: t }, { data: m }, { data: roles }, { data: assigns }] =
      await Promise.all([
        supabase
          .from("teams")
          .select("id, name, join_code, created_by")
          .eq("id", account.teamId)
          .single(),
        supabase
          .from("profiles")
          .select("id, full_name, email, role")
          .eq("team_id", account.teamId)
          .order("role", { ascending: true }),
        supabase
          .from("team_roles")
          .select("id, name, color")
          .eq("team_id", account.teamId)
          .order("created_at", { ascending: true }),
        supabase
          .from("member_roles")
          .select("member_id, role_id")
          .eq("team_id", account.teamId),
      ]);
    if (t)
      team = {
        id: t.id,
        name: t.name,
        joinCode: t.join_code,
        createdBy: (t.created_by as string | null) ?? null,
        billingOwnerId: entitlement.billing_owner_id,
        seatLimit: entitlement.seat_limit,
        seatsUsed: entitlement.seats_used,
      };
    members = (m ?? []).map((row) => ({
      id: row.id,
      fullName: row.full_name ?? null,
      email: row.email ?? "",
      role: row.role ?? "member",
    }));
    teamRoles = (roles ?? []).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      color: r.color as string,
    }));
    memberRoles = (assigns ?? []).map((a) => ({
      memberId: a.member_id as string,
      roleId: a.role_id as string,
    }));
  }

  return (
    <TeamView
      account={account}
      team={team}
      members={members}
      teamRoles={teamRoles}
      memberRoles={memberRoles}
    />
  );
}
