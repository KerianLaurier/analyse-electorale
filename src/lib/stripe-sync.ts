import type { Cycle, Tier } from "@/lib/billing";
import { parseLookupKey } from "@/lib/stripe-catalog";

/**
 * Synchronisation Stripe → `profiles` : logique PURE (testée par Vitest),
 * appelée par le webhook (/api/stripe/webhook) avec le service role.
 *
 * Types structurels (duck typing) plutôt que Stripe.Subscription : le webhook
 * reste correct quelle que soit la version d'API du SDK, et la logique se
 * teste sans réseau. NB API 2025+ (« Basil ») : `current_period_end` vit sur
 * les ITEMS de la subscription, plus au niveau racine.
 */

export type StripeSubscriptionLike = {
  id: string;
  status: string;
  cancel_at_period_end?: boolean | null;
  start_date?: number | null;
  metadata?: Record<string, string> | null;
  items?: {
    data?: Array<{
      current_period_end?: number | null;
      price?: { lookup_key?: string | null } | null;
    } | null> | null;
  } | null;
};

/** Statuts Stripe pendant lesquels l'accès reste ouvert (past_due : Stripe relance l'encaissement). */
const OPEN_ACCESS_STATUSES = new Set(["active", "trialing", "past_due"]);

export type ProfileBillingPatch = {
  subscription_status: "active" | "inactive";
  subscription_tier?: Tier;
  billing_cycle?: Cycle;
  subscription_started_at?: string;
  trial_ends_at: null;
  cancel_at: string | null;
  stripe_subscription_id: string | null;
};

const toIso = (epochSeconds: number): string =>
  new Date(epochSeconds * 1000).toISOString();

/** Formule+cycle d'une subscription : lookup key du prix, sinon metadata posée au checkout. */
export function planFromSubscription(
  sub: StripeSubscriptionLike,
): { tier: Tier; cycle: Cycle } | null {
  const fromPrice = parseLookupKey(sub.items?.data?.[0]?.price?.lookup_key);
  if (fromPrice) return fromPrice;
  const tier = sub.metadata?.tier;
  const cycle = sub.metadata?.cycle;
  if (
    (tier === "candidat" || tier === "equipe" || tier === "parti") &&
    (cycle === "monthly" || cycle === "yearly")
  ) {
    return { tier, cycle };
  }
  return null;
}

/**
 * État `profiles` correspondant à une subscription Stripe. La sémantique du
 * gating existant est conservée : `cancel_at` = fin d'accès programmée
 * (résiliation à l'échéance), NULL = reconduction ; un abonnement terminé chez
 * Stripe (canceled/unpaid/…) redevient `inactive`, détaché de la subscription.
 */
export function subscriptionToPatch(
  sub: StripeSubscriptionLike,
): ProfileBillingPatch {
  if (!OPEN_ACCESS_STATUSES.has(sub.status)) {
    return {
      subscription_status: "inactive",
      trial_ends_at: null,
      cancel_at: null,
      stripe_subscription_id: null,
    };
  }

  const plan = planFromSubscription(sub);
  const periodEnd = sub.items?.data?.[0]?.current_period_end;
  const patch: ProfileBillingPatch = {
    subscription_status: "active",
    trial_ends_at: null,
    cancel_at: sub.cancel_at_period_end && periodEnd ? toIso(periodEnd) : null,
    stripe_subscription_id: sub.id,
  };
  if (plan) {
    patch.subscription_tier = plan.tier;
    patch.billing_cycle = plan.cycle;
  }
  if (sub.start_date) patch.subscription_started_at = toIso(sub.start_date);
  return patch;
}

export type BillingEventType =
  | "subscribe"
  | "change_plan"
  | "change_cycle"
  | "resume"
  | "cancel"
  | "renewal"
  | "payment_failed";

/**
 * Type d'événement `billing_events` pour un `customer.subscription.updated`,
 * déduit du diff `previous_attributes` fourni par Stripe. `null` = simple
 * resynchronisation silencieuse (les renouvellements sont tracés à part, sur
 * `invoice.paid`).
 */
export function subscriptionUpdateEventType(
  previous: Partial<StripeSubscriptionLike> | undefined,
  sub: StripeSubscriptionLike,
): BillingEventType | null {
  if (!previous) return null;

  if (typeof previous.cancel_at_period_end === "boolean") {
    if (!previous.cancel_at_period_end && sub.cancel_at_period_end)
      return "cancel";
    if (previous.cancel_at_period_end && !sub.cancel_at_period_end)
      return "resume";
  }

  if (previous.items) {
    const before = parseLookupKey(previous.items?.data?.[0]?.price?.lookup_key);
    const after = planFromSubscription(sub);
    if (before && after) {
      if (before.tier !== after.tier) return "change_plan";
      if (before.cycle !== after.cycle) return "change_cycle";
    }
  }

  return null;
}
