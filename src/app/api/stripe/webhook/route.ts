import { NextResponse } from "next/server";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient, serviceRoleConfigured } from "@/lib/supabase/admin";
import { getStripe, stripeEnabled } from "@/lib/stripe";
import {
  planFromSubscription,
  subscriptionToPatch,
  subscriptionUpdateEventType,
  type StripeSubscriptionLike,
} from "@/lib/stripe-sync";

/**
 * Webhook Stripe — LA source de vérité de l'abonnement carte. Chaque événement
 * signé est traité UNE fois (dédup `stripe_events`), synchronise `profiles`
 * (service role : ces colonnes ne sont pas modifiables par `authenticated`)
 * et alimente `billing_events` pour le back-office.
 *
 * Route publique (exemptée du gating dans src/proxy.ts) : Stripe n'a pas de
 * session — l'authenticité est garantie par la signature `stripe-signature`.
 * Réponses : 2xx = traité (Stripe n'insiste pas), 4xx = rejeté, 5xx = Stripe
 * retentera (l'event est retiré de la dédup pour permettre ce rejeu).
 */
export async function POST(request: Request) {
  if (!stripeEnabled() || !serviceRoleConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook Stripe non configuré." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Signature manquante." }, { status: 400 });
  }

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Signature invalide." }, { status: 400 });
  }

  const admin = createServiceClient();

  // Idempotence : Stripe rejoue les événements (retries, incidents réseau).
  const { error: dedupError } = await admin.from("stripe_events").insert({ id: event.id, type: event.type });
  if (dedupError) {
    if (dedupError.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    return NextResponse.json({ error: "Dédup indisponible." }, { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode !== "subscription") break;
        const userId = session.metadata?.user_id ?? session.client_reference_id;
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        if (!userId || !subscriptionId) break;

        const sub = (await getStripe().subscriptions.retrieve(subscriptionId)) as unknown as StripeSubscriptionLike;
        const patch = subscriptionToPatch(sub);
        await admin.from("profiles").update(patch).eq("id", userId);

        const plan = planFromSubscription(sub);
        await admin.from("billing_events").insert({
          user_id: userId,
          type: "subscribe",
          tier: plan?.tier ?? null,
          cycle: plan?.cycle ?? null,
          details: {
            source: "stripe",
            stripe_event_id: event.id,
            checkout_session: session.id,
            subscription: subscriptionId,
            amount_eur: session.amount_total != null ? session.amount_total / 100 : null,
          },
        });
        break;
      }

      // `created` couvre les subscriptions nées HORS checkout (dashboard, API,
      // migration d'un compte facture) : sync silencieuse — le `subscribe` du
      // parcours normal reste tracé par checkout.session.completed.
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as unknown as StripeSubscriptionLike;
        const stripeCustomerId = customerIdOf(event.data.object);
        const userId = await resolveUserId(admin, sub.metadata?.user_id, stripeCustomerId);
        if (!userId) break; // customer inconnu de nos profils : rien à faire

        const patch = subscriptionToPatch(
          event.type === "customer.subscription.deleted" ? { ...sub, status: "canceled" } : sub,
        );
        // Auto-réparation : rattache aussi le customer (normalement posé par la
        // route checkout, absent si la subscription est née hors checkout). On
        // le garde après suppression : le portail (factures) reste accessible.
        await admin
          .from("profiles")
          .update({ ...patch, ...(stripeCustomerId ? { stripe_customer_id: stripeCustomerId } : {}) })
          .eq("id", userId);

        const plan = planFromSubscription(sub);
        const eventType =
          event.type === "customer.subscription.deleted"
            ? "cancel"
            : event.type === "customer.subscription.created"
              ? null
              : subscriptionUpdateEventType(
                  event.data.previous_attributes as Partial<StripeSubscriptionLike> | undefined,
                  sub,
                );
        if (eventType) {
          await admin.from("billing_events").insert({
            user_id: userId,
            type: eventType,
            tier: plan?.tier ?? null,
            cycle: plan?.cycle ?? null,
            details: {
              source: "stripe",
              stripe_event_id: event.id,
              subscription: sub.id,
              ...(event.type === "customer.subscription.deleted"
                ? { effective: true }
                : { cancel_at: patch.cancel_at }),
            },
          });
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object;
        // Seuls les renouvellements : la première facture est déjà tracée par
        // checkout.session.completed (type `subscribe`).
        if (invoice.billing_reason !== "subscription_cycle") break;
        const userId = await resolveUserId(admin, invoice.metadata?.user_id ?? undefined, customerIdOf(invoice));
        if (!userId) break;
        await admin.from("billing_events").insert({
          user_id: userId,
          type: "renewal",
          details: {
            source: "stripe",
            stripe_event_id: event.id,
            invoice: invoice.id,
            amount_eur: invoice.amount_paid != null ? invoice.amount_paid / 100 : null,
          },
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const userId = await resolveUserId(admin, invoice.metadata?.user_id ?? undefined, customerIdOf(invoice));
        if (!userId) break;
        // Trace seulement : Stripe relance l'encaissement (Smart Retries) ; si
        // tout échoue, `customer.subscription.updated/deleted` coupera l'accès.
        await admin.from("billing_events").insert({
          user_id: userId,
          type: "payment_failed",
          details: {
            source: "stripe",
            stripe_event_id: event.id,
            invoice: invoice.id,
            amount_eur: invoice.amount_due != null ? invoice.amount_due / 100 : null,
          },
        });
        break;
      }

      default:
        break; // événement non suivi : dédupliqué mais sans effet
    }
  } catch (err) {
    // Échec de traitement : on libère la dédup pour que le retry Stripe rejoue.
    await admin.from("stripe_events").delete().eq("id", event.id);
    console.error("[stripe-webhook]", event.type, err);
    return NextResponse.json({ error: "Traitement échoué — à rejouer." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

/** Customer id d'un objet Stripe (string ou objet expandé). */
function customerIdOf(obj: { customer?: string | { id: string } | null }): string | null {
  const c = obj.customer;
  return typeof c === "string" ? c : (c?.id ?? null);
}

/** user_id : metadata posée au checkout, sinon réconciliation par customer. */
async function resolveUserId(
  admin: SupabaseClient,
  metadataUserId: string | undefined | null,
  stripeCustomerId: string | null,
): Promise<string | null> {
  if (metadataUserId) return metadataUserId;
  if (!stripeCustomerId) return null;
  const { data } = await admin.from("profiles").select("id").eq("stripe_customer_id", stripeCustomerId).single();
  return (data?.id as string | undefined) ?? null;
}
