import type { Cycle, Tier } from "@/lib/billing";
import { PLANS } from "@/lib/team";
/** Formules vendables en ligne (la formule « parti » reste sur devis). */
export const SELF_SERVICE_TIERS: readonly Tier[] = [
  "candidat",
  "equipe",
] as const;

export function priceLookupKey(tier: Tier, cycle: Cycle): string {
  return `${tier}_${cycle}`;
}

/** `candidat_monthly` → { tier, cycle } — null si la clé n'est pas la nôtre. */
export function parseLookupKey(
  lookupKey: string | null | undefined,
): { tier: Tier; cycle: Cycle } | null {
  if (!lookupKey) return null;
  const m = /^(candidat|equipe|parti)_(monthly|yearly)$/.exec(lookupKey);
  if (!m) return null;
  return { tier: m[1] as Tier, cycle: m[2] as Cycle };
}

export function validateCatalogPrice(
  price: {
    currency: string;
    unit_amount: number | null;
    recurring?: { interval: string; interval_count: number } | null;
  },
  tier: Tier,
  cycle: Cycle,
) {
  const plan = PLANS.find((entry) => entry.tier === tier);
  const amount = cycle === "monthly" ? plan?.monthly : plan?.yearly;
  if (
    amount == null ||
    price.currency !== "eur" ||
    price.unit_amount !== amount * 100 ||
    price.recurring?.interval !== (cycle === "monthly" ? "month" : "year") ||
    price.recurring.interval_count !== 1
  ) {
    throw new Error(
      "Le catalogue Stripe ne correspond pas au prix affiché ; paiement suspendu.",
    );
  }
}
