// Déclare (idempotent) l'endpoint webhook de l'app auprès de Stripe et
// affiche son signing secret — à mettre dans STRIPE_WEBHOOK_SECRET (Netlify).
//
//   STRIPE_SECRET_KEY=sk_test_… node scripts/stripe/bootstrap-webhook.mjs https://app.mouvancia.fr
//
// ⚠️ Le secret n'est renvoyé par Stripe qu'À LA CRÉATION. Si l'endpoint existe
// déjà, supprimez-le au dashboard (ou passez --recreate) pour en obtenir un
// nouveau. Un endpoint créé avec une clé TEST ne reçoit que les événements du
// mode test : refaire l'opération avec la clé LIVE au moment de la bascule.
//
// En développement local, ne pas utiliser ce script : `stripe listen
// --forward-to localhost:3000/api/stripe/webhook` fournit un secret de session.

import Stripe from "stripe";

const KEY = process.env.STRIPE_SECRET_KEY;
const baseUrl = process.argv[2]?.replace(/\/$/, "");
const recreate = process.argv.includes("--recreate");
if (!KEY || !baseUrl?.startsWith("https://")) {
  console.error("Usage : STRIPE_SECRET_KEY=sk_… node scripts/stripe/bootstrap-webhook.mjs https://app.mouvancia.fr [--recreate]");
  process.exit(1);
}
const stripe = new Stripe(KEY);

const url = `${baseUrl}/api/stripe/webhook`;
const ENABLED_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
];

const { data: endpoints } = await stripe.webhookEndpoints.list({ limit: 100 });
const existing = endpoints.find((e) => e.url === url);

if (existing && !recreate) {
  console.log(`= endpoint existant  ${existing.id}  ${url}`);
  console.log("  (secret non récupérable après création — --recreate pour le régénérer)");
  process.exit(0);
}
if (existing && recreate) {
  await stripe.webhookEndpoints.del(existing.id);
  console.log(`✕ endpoint supprimé  ${existing.id}`);
}

const endpoint = await stripe.webhookEndpoints.create({
  url,
  enabled_events: ENABLED_EVENTS,
  description: "MOUVANCIA — synchronisation abonnements (profiles/billing_events)",
});

console.log(`✚ endpoint créé      ${endpoint.id}  ${url}`);
console.log(`\nSTRIPE_WEBHOOK_SECRET=${endpoint.secret}`);
console.log("\n→ à copier dans l'environnement de déploiement (Netlify), avec STRIPE_SECRET_KEY et SUPABASE_SERVICE_ROLE_KEY.");
