import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PLANS } from "@/lib/team";
import type { Cycle } from "@/lib/billing";
import {
  SubscriptionFlow,
  type BillingProvider,
  type CheckoutResult,
  type FlowAccount,
} from "@/app/auth/abonnement/subscription-flow";

export const metadata: Metadata = { title: "Abonnement — MOUVANCIA" };

/**
 * Page unique du parcours d'abonnement :
 * - tarifs publics (visiteur non connecté) ;
 * - conversion de l'essai (en cours ou expiré — c'est ici que le middleware
 *   redirige un compte sans accès) ;
 * - gestion de l'abonnement actif : changement de formule/cycle, résiliation,
 *   reprise.
 *
 * Deux moteurs de paiement : Stripe (carte, si configuré côté serveur) ou le
 * repli « facture à réception » (RPC self_*) — même UI, wording adapté.
 */
export default async function AbonnementPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; cycle?: string; checkout?: string }>;
}) {
  const { plan, cycle, checkout } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let account: FlowAccount | null = null;
  if (user) {
    // `*` à dessein (1 ligne, self) : tolère un déploiement où les migrations
    // billing/stripe ne sont pas encore appliquées (colonnes absentes).
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
      stripeCustomerId: (p?.stripe_customer_id as string | null) ?? null,
      stripeSubscriptionId: (p?.stripe_subscription_id as string | null) ?? null,
    };
  }

  // Paiement carte actif seulement si la chaîne serveur est complète (clé
  // Stripe + service role pour la synchro webhook) — sinon repli facture.
  const provider: BillingProvider =
    process.env.STRIPE_SECRET_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY ? "stripe" : "invoice";

  const initialPlanId = PLANS.some((p) => p.id === plan) ? (plan as (typeof PLANS)[number]["id"]) : null;
  const initialCycle: Cycle | null = cycle === "monthly" || cycle === "yearly" ? cycle : null;
  const checkoutResult: CheckoutResult = checkout === "success" || checkout === "cancelled" ? checkout : null;

  return (
    <SubscriptionFlow
      account={account}
      provider={provider}
      initialPlanId={initialPlanId}
      initialCycle={initialCycle}
      checkoutResult={checkoutResult}
    />
  );
}
