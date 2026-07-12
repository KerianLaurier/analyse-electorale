// Configure (idempotent) le Customer Portal Stripe : résiliation à l'échéance,
// changement de formule entre nos 4 prix (proration), factures, moyen de
// paiement. Évite toute configuration manuelle au dashboard.
//
//   STRIPE_SECRET_KEY=sk_test_… node scripts/stripe/bootstrap-portal.mjs
//
// À lancer APRÈS bootstrap-products.mjs (il retrouve les prix par lookup key),
// une fois par environnement Stripe (test puis live).

import Stripe from "stripe";

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY) {
  console.error("STRIPE_SECRET_KEY manquante.");
  process.exit(1);
}
const stripe = new Stripe(KEY);

const LOOKUP_KEYS = ["candidat_monthly", "candidat_yearly", "equipe_monthly", "equipe_yearly"];

const { data: prices } = await stripe.prices.list({ lookup_keys: LOOKUP_KEYS, active: true, limit: 10 });
if (prices.length < LOOKUP_KEYS.length) {
  console.error(
    `Prix manquants (${prices.length}/${LOOKUP_KEYS.length}) — lancer d'abord scripts/stripe/bootstrap-products.mjs.`,
  );
  process.exit(1);
}

// Regroupe les prix par produit pour la section « changer de formule ».
const byProduct = new Map();
for (const p of prices) {
  const productId = typeof p.product === "string" ? p.product : p.product.id;
  const arr = byProduct.get(productId) ?? [];
  arr.push(p.id);
  byProduct.set(productId, arr);
}

const features = {
  customer_update: { enabled: true, allowed_updates: ["email", "name", "address"] },
  invoice_history: { enabled: true },
  payment_method_update: { enabled: true },
  subscription_cancel: { enabled: true, mode: "at_period_end" },
  subscription_update: {
    enabled: true,
    default_allowed_updates: ["price"],
    proration_behavior: "create_prorations",
    products: [...byProduct.entries()].map(([product, priceIds]) => ({ product, prices: priceIds })),
  },
};

// Idempotence : réutilise la configuration par défaut si elle existe déjà.
const { data: configs } = await stripe.billingPortal.configurations.list({ is_default: true, limit: 1 });
const existing = configs[0];

const config = existing
  ? await stripe.billingPortal.configurations.update(existing.id, { features })
  : await stripe.billingPortal.configurations.create({
      business_profile: { headline: "MOUVANCIA — analyse électorale et pilotage de campagne 2027" },
      features,
    });

console.log(`${existing ? "= configuration mise à jour" : "✚ configuration créée"}  ${config.id}  (default: ${config.is_default})`);
console.log("Portal prêt : résiliation à l'échéance, changement de formule (4 prix), factures, moyen de paiement.");
