import { describe, expect, it } from "vitest";
import Stripe from "stripe";
import { subscriptionToPatch, type StripeSubscriptionLike } from "@/lib/stripe-sync";

/**
 * Intégration RÉELLE contre l'API Stripe en MODE TEST : vérifie que les objets
 * renvoyés par l'API (post-Basil : période portée par les items) correspondent
 * bien au mapping `stripe-sync`. Fixtures jetables, nettoyées en fin de test.
 *
 * Ne tourne que si STRIPE_SECRET_KEY est une clé de TEST (skippé en CI et
 * refusé sur une clé live). Prérequis : bootstrap-products.mjs déjà lancé.
 */
const KEY = process.env.STRIPE_SECRET_KEY;
const isTestKey = !!KEY?.startsWith("sk_test_");

describe.skipIf(!isTestKey)("intégration Stripe (mode test)", () => {
  it("mappe une subscription réelle : souscription puis résiliation à l'échéance", async () => {
    const stripe = new Stripe(KEY!);
    const customer = await stripe.customers.create({
      email: "integration-test@mouvancia.fr",
      description: "Fixture de test d'intégration MOUVANCIA — supprimée en fin de test",
    });

    try {
      // Moyen de paiement de TEST fourni par Stripe (aucune carte saisie).
      const pm = await stripe.paymentMethods.attach("pm_card_visa", { customer: customer.id });
      await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: pm.id } });

      const { data: prices } = await stripe.prices.list({ lookup_keys: ["equipe_yearly"], active: true, limit: 1 });
      expect(prices, "lancer scripts/stripe/bootstrap-products.mjs d'abord").toHaveLength(1);

      const created = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: prices[0].id }],
        metadata: { user_id: "00000000-0000-0000-0000-000000000000", tier: "equipe", cycle: "yearly" },
      });

      // Souscription active : le mapping lit la vraie forme de l'API.
      const patch = subscriptionToPatch(created as unknown as StripeSubscriptionLike);
      expect(patch.subscription_status).toBe("active");
      expect(patch.subscription_tier).toBe("equipe");
      expect(patch.billing_cycle).toBe("yearly");
      expect(patch.cancel_at).toBeNull();
      expect(patch.trial_ends_at).toBeNull();
      expect(patch.stripe_subscription_id).toBe(created.id);
      expect(patch.subscription_started_at).toBeTruthy();

      // Résiliation à l'échéance : cancel_at = fin de période RÉELLE (~1 an),
      // lue sur les items (elle n'existe plus au niveau racine de l'objet).
      const updated = await stripe.subscriptions.update(created.id, { cancel_at_period_end: true });
      const canceling = subscriptionToPatch(updated as unknown as StripeSubscriptionLike);
      expect(canceling.subscription_status).toBe("active");
      expect(canceling.cancel_at).toBeTruthy();
      const cancelMs = new Date(canceling.cancel_at as string).getTime();
      expect(cancelMs).toBeGreaterThan(Date.now() + 300 * 86_400_000); // ≳ 10 mois
      expect(cancelMs).toBeLessThan(Date.now() + 400 * 86_400_000); // ≲ 13 mois

      // Fin de vie : suppression → le compte doit être détaché et désactivé.
      const deleted = await stripe.subscriptions.cancel(created.id);
      const ended = subscriptionToPatch(deleted as unknown as StripeSubscriptionLike);
      expect(ended.subscription_status).toBe("inactive");
      expect(ended.stripe_subscription_id).toBeNull();
    } finally {
      await stripe.customers.del(customer.id); // annule aussi toute subscription restante
    }
  }, 60_000);
});
