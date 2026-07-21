import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, serviceRoleConfigured } from "@/lib/supabase/admin";
import { getStripe, stripeEnabled } from "@/lib/stripe";
import { env } from "@/lib/env";

/**
 * Ouvre le Billing Portal Stripe du compte : moyens de paiement, factures,
 * changement de formule et résiliation/reprise y sont gérés par Stripe (l'état
 * revient dans `profiles` par le webhook). `flow: "subscription_update"`
 * ouvre directement l'écran de changement de formule.
 */
export async function POST(request: Request) {
  if (!stripeEnabled() || !serviceRoleConfigured()) {
    return NextResponse.json(
      { error: "Le paiement par carte n'est pas configuré sur cet environnement." },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  }

  let flow: string | null = null;
  try {
    flow = ((await request.json()) as { flow?: string }).flow ?? null;
  } catch {
    // corps vide accepté
  }

  const admin = createServiceClient();
  const { data: prof } = await admin
    .from("profiles")
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("id", user.id)
    .single();
  const customerId = (prof?.stripe_customer_id as string | null) ?? null;
  if (!customerId) {
    return NextResponse.json(
      { error: "Aucun compte de facturation Stripe associé — souscrivez d'abord une formule." },
      { status: 404 },
    );
  }

  // Origine de confiance : l'URL app configurée (prod) prime sur l'en-tête
  // `Origin` (contrôlable par le client) → pas de retour de portail forgé.
  const origin = env.APP_URL ?? request.headers.get("origin") ?? new URL(request.url).origin;
  const subscriptionId = (prof?.stripe_subscription_id as string | null) ?? null;
  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/auth/abonnement`,
    ...(flow === "subscription_update" && subscriptionId
      ? { flow_data: { type: "subscription_update", subscription_update: { subscription: subscriptionId } } }
      : {}),
  });

  return NextResponse.json({ url: session.url });
}
