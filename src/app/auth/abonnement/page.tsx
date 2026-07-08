import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PLANS } from "@/lib/team";
import type { Cycle } from "@/lib/billing";
import { SubscriptionFlow, type FlowAccount } from "@/app/auth/abonnement/subscription-flow";

export const metadata: Metadata = { title: "Abonnement — MOUVANCIA" };

/**
 * Page unique du parcours d'abonnement :
 * - tarifs publics (visiteur non connecté) ;
 * - conversion de l'essai (en cours ou expiré — c'est ici que le middleware
 *   redirige un compte sans accès) ;
 * - gestion de l'abonnement actif : changement de formule/cycle, résiliation,
 *   reprise.
 */
export default async function AbonnementPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; cycle?: string }>;
}) {
  const { plan, cycle } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let account: FlowAccount | null = null;
  if (user) {
    // `*` à dessein (1 ligne, self) : tolère un déploiement où la migration
    // billing n'est pas encore appliquée (colonnes cycle/cancel_at absentes).
    const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    account = {
      email: user.email ?? "",
      fullName: (p?.full_name as string | null) ?? null,
      organisation: (p?.organisation as string | null) ?? null,
      status: (p?.subscription_status as FlowAccount["status"]) ?? "inactive",
      tier: (p?.subscription_tier as FlowAccount["tier"]) ?? "candidat",
      trialEndsAt: (p?.trial_ends_at as string | null) ?? null,
      cancelAt: (p?.cancel_at as string | null) ?? null,
      billingCycle: (p?.billing_cycle as FlowAccount["billingCycle"]) ?? null,
      startedAt: (p?.subscription_started_at as string | null) ?? null,
    };
  }

  const initialPlanId = PLANS.some((p) => p.id === plan) ? (plan as (typeof PLANS)[number]["id"]) : null;
  const initialCycle: Cycle | null = cycle === "monthly" || cycle === "yearly" ? cycle : null;

  return <SubscriptionFlow account={account} initialPlanId={initialPlanId} initialCycle={initialCycle} />;
}
