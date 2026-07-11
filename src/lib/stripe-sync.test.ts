import { describe, expect, it } from "vitest";
import {
  planFromSubscription,
  subscriptionToPatch,
  subscriptionUpdateEventType,
  type StripeSubscriptionLike,
} from "@/lib/stripe-sync";

const PERIOD_END = 1_790_000_000; // 2026-09-21T…Z
const PERIOD_END_ISO = new Date(PERIOD_END * 1000).toISOString();

function sub(overrides: Partial<StripeSubscriptionLike> = {}): StripeSubscriptionLike {
  return {
    id: "sub_123",
    status: "active",
    cancel_at_period_end: false,
    start_date: 1_780_000_000,
    metadata: {},
    items: { data: [{ current_period_end: PERIOD_END, price: { lookup_key: "equipe_yearly" } }] },
    ...overrides,
  };
}

describe("planFromSubscription", () => {
  it("lit la formule depuis la lookup key du prix", () => {
    expect(planFromSubscription(sub())).toEqual({ tier: "equipe", cycle: "yearly" });
  });
  it("retombe sur la metadata posée au checkout", () => {
    const s = sub({ items: { data: [{ price: { lookup_key: null } }] }, metadata: { tier: "candidat", cycle: "monthly" } });
    expect(planFromSubscription(s)).toEqual({ tier: "candidat", cycle: "monthly" });
  });
  it("null si rien d'exploitable", () => {
    expect(planFromSubscription(sub({ items: { data: [] }, metadata: { tier: "premium" } }))).toBeNull();
  });
});

describe("subscriptionToPatch", () => {
  it("abonnement actif → profil actif, reconduction tacite", () => {
    expect(subscriptionToPatch(sub())).toEqual({
      subscription_status: "active",
      subscription_tier: "equipe",
      billing_cycle: "yearly",
      subscription_started_at: new Date(1_780_000_000 * 1000).toISOString(),
      trial_ends_at: null,
      cancel_at: null,
      stripe_subscription_id: "sub_123",
    });
  });
  it("résiliation à l'échéance → cancel_at = fin de période (portée par l'item, API Basil)", () => {
    const patch = subscriptionToPatch(sub({ cancel_at_period_end: true }));
    expect(patch.subscription_status).toBe("active");
    expect(patch.cancel_at).toBe(PERIOD_END_ISO);
  });
  it("past_due garde l'accès (relances Stripe en cours)", () => {
    expect(subscriptionToPatch(sub({ status: "past_due" })).subscription_status).toBe("active");
  });
  it("canceled / unpaid → inactif, détaché de la subscription", () => {
    for (const status of ["canceled", "unpaid", "incomplete_expired"]) {
      expect(subscriptionToPatch(sub({ status }))).toEqual({
        subscription_status: "inactive",
        trial_ends_at: null,
        cancel_at: null,
        stripe_subscription_id: null,
      });
    }
  });
  it("l'essai maison est toujours soldé (trial_ends_at effacé)", () => {
    expect(subscriptionToPatch(sub()).trial_ends_at).toBeNull();
  });
});

describe("subscriptionUpdateEventType", () => {
  it("cancel_at_period_end false→true = résiliation", () => {
    expect(subscriptionUpdateEventType({ cancel_at_period_end: false }, sub({ cancel_at_period_end: true }))).toBe("cancel");
  });
  it("cancel_at_period_end true→false = reprise", () => {
    expect(subscriptionUpdateEventType({ cancel_at_period_end: true }, sub({ cancel_at_period_end: false }))).toBe("resume");
  });
  it("changement de prix : formule ou cycle", () => {
    const prevSolo = { items: { data: [{ price: { lookup_key: "candidat_yearly" } }] } };
    expect(subscriptionUpdateEventType(prevSolo, sub())).toBe("change_plan");
    const prevMonthly = { items: { data: [{ price: { lookup_key: "equipe_monthly" } }] } };
    expect(subscriptionUpdateEventType(prevMonthly, sub())).toBe("change_cycle");
  });
  it("null pour une resynchronisation sans signification produit", () => {
    expect(subscriptionUpdateEventType(undefined, sub())).toBeNull();
    expect(subscriptionUpdateEventType({ metadata: {} }, sub())).toBeNull();
  });
});
