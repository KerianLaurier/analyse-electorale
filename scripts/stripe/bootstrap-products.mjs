// Crée (idempotent) les produits et prix Stripe de la grille MOUVANCIA.
//
//   STRIPE_SECRET_KEY=sk_test_… node scripts/stripe/bootstrap-products.mjs
//
// À lancer une fois par environnement Stripe (mode test PUIS mode live).
// Les prix portent des LOOKUP KEYS (`candidat_monthly`, `equipe_yearly`…) :
// c'est par elles que l'app les résout (src/lib/stripe.ts) — aucun price_id
// à copier dans la configuration.
//
// ⚠️ Grille à tenir en phase avec src/lib/team.ts (PLANS) et la fonction SQL
// `billing_price_eur` (supabase/migrations/20260708_self_service_billing.sql).
// Montants HT (tax_behavior: exclusive) — la TVA est gérée sur facture Stripe.
//
// Relancer après un changement de grille : le script détache la lookup key de
// l'ancien prix (transfer_lookup_key) et en crée un nouveau — les abonnements
// en cours conservent leur ancien prix, les nouveaux checkouts prennent le
// nouveau. (Les prix Stripe sont immuables : on n'édite jamais un montant.)

import Stripe from "stripe";

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY) {
  console.error("STRIPE_SECRET_KEY manquante.");
  process.exit(1);
}
const stripe = new Stripe(KEY);

const GRID = [
  {
    tier: "candidat",
    productName: "MOUVANCIA Solo",
    description: "Analyse électorale 2027 — 1 siège.",
    prices: [
      { lookupKey: "candidat_monthly", unitAmount: 4900, interval: "month" },
      { lookupKey: "candidat_yearly", unitAmount: 49000, interval: "year" },
    ],
  },
  {
    tier: "equipe",
    productName: "MOUVANCIA Équipe",
    description: "Analyse électorale et pilotage de campagne 2027 — 5 sièges.",
    prices: [
      { lookupKey: "equipe_monthly", unitAmount: 19900, interval: "month" },
      { lookupKey: "equipe_yearly", unitAmount: 199000, interval: "year" },
    ],
  },
];

async function findProduct(tier) {
  const { data } = await stripe.products.search({ query: `metadata['tier']:'${tier}' AND active:'true'`, limit: 1 });
  return data[0] ?? null;
}

async function findPriceByLookupKey(lookupKey) {
  const { data } = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  return data[0] ?? null;
}

for (const plan of GRID) {
  let product = await findProduct(plan.tier);
  if (!product) {
    product = await stripe.products.create({
      name: plan.productName,
      description: plan.description,
      metadata: { tier: plan.tier },
    });
    console.log(`✚ produit créé      ${product.id}  ${plan.productName}`);
  } else {
    console.log(`= produit existant  ${product.id}  ${plan.productName}`);
  }

  for (const p of plan.prices) {
    const existing = await findPriceByLookupKey(p.lookupKey);
    if (existing && existing.unit_amount === p.unitAmount && existing.active) {
      console.log(`  = prix existant   ${existing.id}  ${p.lookupKey}  ${p.unitAmount / 100} €/${p.interval}`);
      continue;
    }
    const price = await stripe.prices.create({
      product: product.id,
      currency: "eur",
      unit_amount: p.unitAmount,
      recurring: { interval: p.interval },
      lookup_key: p.lookupKey,
      transfer_lookup_key: true, // détache la clé d'un éventuel ancien prix
      tax_behavior: "exclusive",
      metadata: { tier: plan.tier },
    });
    console.log(`  ✚ prix créé       ${price.id}  ${p.lookupKey}  ${p.unitAmount / 100} €/${p.interval}`);
  }
}

console.log("\nGrille Stripe prête. L'app résout ces prix par lookup key — rien d'autre à configurer.");
