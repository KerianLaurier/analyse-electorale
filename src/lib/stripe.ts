import Stripe from "stripe";
import type { Cycle, Tier } from "@/lib/billing";

/**
 * Accès Stripe — serveur uniquement (routes API). Le front ne voit jamais de
 * clé : le checkout passe par une session hébergée (redirection URL).
 *
 * Les prix sont résolus par LOOKUP KEY (`candidat_monthly`, `equipe_yearly`…),
 * créés par `scripts/stripe/bootstrap-products.mjs` : aucun price_id à
 * configurer en environnement, et la grille reste gouvernée par Stripe
 * (elle-même alignée sur `PLANS` de src/lib/team.ts et `billing_price_eur()`
 * côté SQL — les trois à modifier ensemble).
 */

/** Le paiement carte est actif dès que la clé secrète est configurée. */
export function stripeEnabled(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

let client: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY manquante — paiement carte non configuré sur cet environnement.");
  }
  if (!client) client = new Stripe(key);
  return client;
}

/** Formules vendables en ligne (la formule « parti » reste sur devis). */
export const SELF_SERVICE_TIERS: readonly Tier[] = ["candidat", "equipe"] as const;

export function priceLookupKey(tier: Tier, cycle: Cycle): string {
  return `${tier}_${cycle}`;
}

/** `candidat_monthly` → { tier, cycle } — null si la clé n'est pas la nôtre. */
export function parseLookupKey(lookupKey: string | null | undefined): { tier: Tier; cycle: Cycle } | null {
  if (!lookupKey) return null;
  const m = /^(candidat|equipe|parti)_(monthly|yearly)$/.exec(lookupKey);
  if (!m) return null;
  return { tier: m[1] as Tier, cycle: m[2] as Cycle };
}

// Cache par isolat : les price IDs ne changent pas pendant la vie du process.
const priceIdCache = new Map<string, string>();

/** Price Stripe actif pour une formule+cycle, résolu par lookup key. */
export async function resolvePriceId(tier: Tier, cycle: Cycle): Promise<string> {
  const key = priceLookupKey(tier, cycle);
  const cachedId = priceIdCache.get(key);
  if (cachedId) return cachedId;

  const { data } = await getStripe().prices.list({ lookup_keys: [key], active: true, limit: 1 });
  const price = data[0];
  if (!price) {
    throw new Error(
      `Prix Stripe introuvable pour « ${key} » — créer les produits avec scripts/stripe/bootstrap-products.mjs.`,
    );
  }
  priceIdCache.set(key, price.id);
  return price.id;
}
