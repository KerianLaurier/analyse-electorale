import Link from "next/link";
import { PersonalBillingPortal } from "@/components/personal-billing-portal";
import { parseWorkspaceEntitlement } from "@/lib/workspace-entitlement";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PLANS } from "@/lib/team";
import type { Cycle } from "@/lib/billing";
import { SignOutButton } from "@/components/sign-out-button";
import {
  SubscriptionFlow,
  type BillingProvider,
  type CheckoutResult,
  type FlowAccount,
} from "@/app/(app)/auth/abonnement/subscription-flow";

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
    // Le déploiement de cette page nécessite les RPC de droits partagés.
    const { data: p, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    if (profileError) throw profileError;
    if (!p) throw new Error("Profil indisponible");
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
      stripeSubscriptionId:
        (p?.stripe_subscription_id as string | null) ?? null,
    };
  }

  if (user) {
    const { data, error } = await supabase.rpc("workspace_entitlement");
    if (error) throw error;
    const entitlement = parseWorkspaceEntitlement(data);
    // Un ancien abonnement personnel existant reste gérable ; il n'est jamais
    // résilié automatiquement par le fait de rejoindre une équipe.
    if (entitlement.covered_by_team) {
      return (
        <main className="mx-auto max-w-xl space-y-4 px-6 py-16">
          <h1 className="text-2xl font-semibold">
            Votre accès est couvert par l’équipe
          </h1>
          <p>
            L’abonnement de {entitlement.team_name ?? "votre équipe"} inclut
            votre siège. Aucun paiement personnel n’est nécessaire.
          </p>
          {account?.stripeCustomerId && <PersonalBillingPortal />}
          <Link href="/explorer" className="underline">
            Ouvrir l’application
          </Link>
          <Link href="/auth/team" className="block underline">
            Voir l’équipe et les sièges
          </Link>
        </main>
      );
    }
  }

  const stripeReady = !!(
    process.env.STRIPE_SECRET_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.STRIPE_WEBHOOK_SECRET
  );
  const { data: invoiceAllowed } =
    !stripeReady && user
      ? await supabase.rpc("can_use_invoice_billing")
      : { data: false };
  // Une configuration incomplète ne doit jamais autoriser un accès gratuit.
  if (!stripeReady && invoiceAllowed !== true) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16 space-y-4">
        <h1 className="text-2xl font-semibold">Abonnement</h1>
        <p>
          La souscription est indisponible pour le moment. Contactez{" "}
          <a href="mailto:contact@mouvancia.fr" className="underline">
            contact@mouvancia.fr
          </a>{" "}
          pour gérer votre abonnement.
        </p>
        <SignOutButton />
      </main>
    );
  }
  const provider: BillingProvider = stripeReady ? "stripe" : "invoice";

  const initialPlanId = PLANS.some((p) => p.id === plan)
    ? (plan as (typeof PLANS)[number]["id"])
    : null;
  const initialCycle: Cycle | null =
    cycle === "monthly" || cycle === "yearly" ? cycle : null;
  const checkoutResult: CheckoutResult =
    checkout === "success" || checkout === "cancelled" ? checkout : null;

  return (
    <>
      {user && (
        <p className="mx-auto max-w-3xl px-6 pt-6 text-sm">
          Vous avez reçu un code d’équipe ?{" "}
          <Link href="/auth/team" className="underline">
            Rejoignez-la pour utiliser un siège disponible.
          </Link>
        </p>
      )}
      <SubscriptionFlow
        account={account}
        provider={provider}
        initialPlanId={initialPlanId}
        initialCycle={initialCycle}
        checkoutResult={checkoutResult}
      />
    </>
  );
}
