import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, serviceRoleConfigured } from "@/lib/supabase/admin";
import { getStripe, resolvePriceId, stripeEnabled, SELF_SERVICE_TIERS } from "@/lib/stripe";
import type { Cycle, Tier } from "@/lib/billing";
import { env } from "@/lib/env";

/**
 * Démarre un paiement par carte : crée une session Stripe Checkout (hébergée)
 * pour la formule+cycle demandés et renvoie son URL. L'activation du compte se
 * fait au retour du webhook `checkout.session.completed` — jamais ici.
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

  let body: { tier?: string; cycle?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const tier = body.tier as Tier;
  const cycle = body.cycle as Cycle;
  if (!SELF_SERVICE_TIERS.includes(tier) || (cycle !== "monthly" && cycle !== "yearly")) {
    return NextResponse.json({ error: "Formule ou cycle invalide." }, { status: 400 });
  }

  const admin = createServiceClient();
  const { data: prof } = await admin
    .from("profiles")
    .select("subscription_status, stripe_customer_id, stripe_subscription_id, full_name, organisation")
    .eq("id", user.id)
    .single();
  if (!prof) {
    return NextResponse.json({ error: "Profil introuvable." }, { status: 404 });
  }

  // Déjà abonné via Stripe : le changement de formule passe par le portail
  // (sinon Checkout créerait une SECONDE subscription facturée en parallèle).
  if (prof.subscription_status === "active" && prof.stripe_subscription_id) {
    return NextResponse.json(
      { error: "Abonnement déjà actif — gérez votre formule depuis le portail de facturation.", portal: true },
      { status: 409 },
    );
  }

  const stripe = getStripe();
  const priceId = await resolvePriceId(tier, cycle);

  let customerId = (prof.stripe_customer_id as string | null) ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: (prof.organisation as string | null) || (prof.full_name as string | null) || undefined,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
    await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
  }

  // Origine de confiance : l'URL app configurée (prod) prime sur l'en-tête
  // `Origin` (contrôlable par le client) → pas de redirection Stripe forgée.
  // Repli sur l'en-tête puis l'origine de la requête en local/preview (APP_URL absente).
  const origin = env.APP_URL ?? request.headers.get("origin") ?? new URL(request.url).origin;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/auth/abonnement?checkout=success`,
    cancel_url: `${origin}/auth/abonnement?checkout=cancelled`,
    client_reference_id: user.id,
    metadata: { user_id: user.id, tier, cycle },
    // La subscription porte le user_id à vie : réconciliation des webhooks
    // même si le customer était créé hors de ce flux.
    subscription_data: { metadata: { user_id: user.id, tier, cycle } },
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    locale: "fr",
  });

  return NextResponse.json({ url: session.url });
}
