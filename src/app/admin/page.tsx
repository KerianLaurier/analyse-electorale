import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminView, type AdminAccount } from "@/app/admin/admin-view";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/admin");

  // Double garde (le proxy gate déjà, mais on revérifie côté page).
  const { data: me } = await supabase.from("profiles").select("is_super_admin").eq("id", user.id).single();
  if (!me?.is_super_admin) redirect("/explorer");

  // `*` à dessein : tolère un déploiement où la migration billing n'est pas
  // encore appliquée (colonnes cycle/cancel_at absentes).
  const [{ data: rows }, { data: teams }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("teams").select("id, name"),
  ]);

  const teamNames = new Map((teams ?? []).map((t) => [t.id as string, t.name as string]));

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
    teamName: r.team_id ? teamNames.get(r.team_id as string) ?? null : null,
    createdAt: r.created_at ?? null,
  }));

  return <AdminView accounts={accounts} meId={user.id} />;
}
