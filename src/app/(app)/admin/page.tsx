import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminView, type AdminAccount } from "@/app/(app)/admin/admin-view";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const status = ["trial", "active", "inactive"].includes(params.status ?? "")
    ? params.status!
    : "all";
  const page = Math.min(
    20000,
    Math.max(0, Math.floor(Number(params.page) || 0)),
  );
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/admin");

  // Double garde (le proxy gate déjà, mais on revérifie côté page).
  const { data: me } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();
  if (!me?.is_super_admin) redirect("/explorer");

  const { data, error } = await supabase.rpc("admin_accounts_page", {
    p_query: query,
    p_status: status,
    p_offset: page * 50,
  });
  if (error || !data)
    throw new Error("Impossible de charger les comptes administrateur");
  type ProfileRow = {
    id: string;
    email: string;
    full_name: string | null;
    organisation: string | null;
    role: string;
    subscription_status: AdminAccount["status"];
    subscription_tier: string;
    trial_ends_at: string | null;
    billing_cycle: AdminAccount["billingCycle"];
    cancel_at: string | null;
    is_super_admin: boolean;
    team_name: string | null;
    created_at: string | null;
  };
  const result = data as {
    accounts: ProfileRow[];
    matched: number;
    stats: {
      total: number;
      active: number;
      trial: number;
      inactive: number;
      admins: number;
    };
  };
  const rows = result.accounts;

  const accounts: AdminAccount[] = (rows ?? []).map((r) => ({
    id: r.id,
    email: r.email ?? "",
    fullName: r.full_name ?? null,
    organisation: r.organisation ?? null,
    role: r.role ?? "member",
    status: (r.subscription_status ?? "inactive") as AdminAccount["status"],
    tier: r.subscription_tier ?? "candidat",
    trialEndsAt: r.trial_ends_at ?? null,
    billingCycle: (r.billing_cycle as AdminAccount["billingCycle"]) ?? null,
    cancelAt: (r.cancel_at as string | null) ?? null,
    isSuperAdmin: r.is_super_admin === true,
    teamName: r.team_name,
    createdAt: r.created_at ?? null,
  }));

  return (
    <AdminView
      key={`${query}:${status}:${page}`}
      accounts={accounts}
      meId={user.id}
      pagination={{
        page,
        query,
        status,
        matched: result.matched,
        stats: result.stats,
      }}
    />
  );
}
