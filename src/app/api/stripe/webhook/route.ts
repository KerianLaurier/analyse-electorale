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
  type ProfileBillingPatch,
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
 * retentera (la transaction SQL est annulée intégralement en cas d'erreur).
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

  let userId: string | null = null;
  let customerId: string | null = null;
  let subscriptionId: string | null = null;
  let patch: ProfileBillingPatch | null = null;
  let billingEvent: Record<string, unknown> | null = null;

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode !== "subscription") break;
        userId = session.metadata?.user_id ?? session.client_reference_id;
        customerId = customerIdOf(session);
        subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;
        if (!userId || !subscriptionId) break;

        const sub = (await getStripe().subscriptions.retrieve(subscriptionId)) as unknown as StripeSubscriptionLike;
        patch = subscriptionToPatch(sub);

        const plan = planFromSubscription(sub);
        billingEvent = {
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
        };
        break;
      }

      // `created` couvre les subscriptions nées HORS checkout (dashboard, API,
      // migration d'un compte facture) : sync silencieuse — le `subscribe` du
      // parcours normal reste tracé par checkout.session.completed.
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const delivered = event.data.object as unknown as StripeSubscriptionLike;
        // Stripe ne garantit pas l'ordre de livraison : relire l'état courant
        // évite de réactiver un abonnement avec un ancien snapshot « active ».
        const sub = event.type === "customer.subscription.deleted"
          ? { ...delivered, status: "canceled" }
          : await getStripe().subscriptions.retrieve(delivered.id) as unknown as StripeSubscriptionLike;
        subscriptionId = sub.id;
        customerId = customerIdOf(event.data.object);
        userId = await resolveUserId(admin, sub.metadata?.user_id, customerId);
        if (!userId) break; // customer inconnu de nos profils : rien à faire

        patch = subscriptionToPatch(sub);

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
          billingEvent = {
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
          };
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object;
        // Seuls les renouvellements : la première facture est déjà tracée par
        // checkout.session.completed (type `subscribe`).
        if (invoice.billing_reason !== "subscription_cycle") break;
        customerId = customerIdOf(invoice);
        userId = await resolveUserId(admin, invoice.metadata?.user_id ?? undefined, customerId);
        if (!userId) break;
        billingEvent = {
          type: "renewal",
          details: {
            source: "stripe",
            stripe_event_id: event.id,
            invoice: invoice.id,
            amount_eur: invoice.amount_paid != null ? invoice.amount_paid / 100 : null,
          },
        };
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        customerId = customerIdOf(invoice);
        userId = await resolveUserId(admin, invoice.metadata?.user_id ?? undefined, customerId);
        if (!userId) break;
        // Trace seulement : Stripe relance l'encaissement (Smart Retries) ; si
        // tout échoue, `customer.subscription.updated/deleted` coupera l'accès.
        billingEvent = {
          type: "payment_failed",
          details: {
            source: "stripe",
            stripe_event_id: event.id,
            invoice: invoice.id,
            amount_eur: invoice.amount_due != null ? invoice.amount_due / 100 : null,
          },
        };
        break;
      }

      default:
        break; // événement non suivi : dédupliqué mais sans effet
    }
    // Supabase renvoie { error } sans lever d'exception par défaut. La RPC
    // assure l'atomicité ; toute erreur doit produire un 5xx pour le retry.
    const { data: applied, error } = await admin.rpc("apply_stripe_event", {
      p_event_id: event.id,
      p_event_type: event.type,
      p_user_id: userId,
      p_customer_id: customerId,
      p_subscription_id: subscriptionId,
      p_patch: patch,
      p_billing_event: billingEvent,
    });
    if (error) throw error;
    return NextResponse.json({ received: true, ...(applied === false ? { duplicate: true } : {}) });
  } catch (err) {
    console.error("[stripe-webhook]", event.type, err);
    return NextResponse.json({ error: "Traitement échoué — à rejouer." }, { status: 500 });
  }
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
  const { data, error } = await admin.from("profiles").select("id").eq("stripe_customer_id", stripeCustomerId).maybeSingle();
  if (error) throw error;
  return (data?.id as string | undefined) ?? null;
}
