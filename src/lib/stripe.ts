import "server-only";
import { priceLookupKey, validateCatalogPrice } from "@/lib/stripe-catalog";
export { SELF_SERVICE_TIERS } from "@/lib/stripe-catalog";
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
    throw new Error(
      "STRIPE_SECRET_KEY manquante — paiement carte non configuré sur cet environnement.",
    );
  }
  if (!client) client = new Stripe(key);
  return client;
}

// Cache par isolat : les price IDs ne changent pas pendant la vie du process.
const priceIdCache = new Map<string, { id: string; expiresAt: number }>();

/** Price Stripe actif pour une formule+cycle, résolu par lookup key. */
export async function resolvePriceId(
  tier: Tier,
  cycle: Cycle,
): Promise<string> {
  const key = priceLookupKey(tier, cycle);
  const cachedId = priceIdCache.get(key);
  if (cachedId && cachedId.expiresAt > Date.now()) return cachedId.id;

  const { data } = await getStripe().prices.list({
    lookup_keys: [key],
    active: true,
    limit: 1,
  });
  const price = data[0];
  if (!price) {
    throw new Error(
      `Prix Stripe introuvable pour « ${key} » — créer les produits avec scripts/stripe/bootstrap-products.mjs.`,
    );
  }
  validateCatalogPrice(price, tier, cycle);
  priceIdCache.set(key, { id: price.id, expiresAt: Date.now() + 5 * 60_000 });
  return price.id;
}
