# Paiement par carte — mise en service Stripe

L'app fonctionne avec **deux moteurs de facturation**, choisis automatiquement :

| | Actif quand | Souscription | Gestion (formule, résiliation, factures) |
|---|---|---|---|
| **Stripe** (carte) | `STRIPE_SECRET_KEY` **et** `SUPABASE_SERVICE_ROLE_KEY` configurées | Stripe Checkout (page hébergée) | Billing Portal Stripe |
| **Facture à réception** (repli) | sinon (dev, preview) | RPC `self_set_plan` | RPC `self_cancel` / `self_resume` |

La **vérité** d'un abonnement carte vit chez Stripe : le webhook la synchronise
dans `profiles` (statut, formule, cycle, fin programmée) — le gating (claims
JWT) et l'UI ne changent pas. Les comptes activés avant Stripe (mode facture)
continuent de fonctionner tels quels.

## Mise en service (une fois en mode test, une fois en live)

### 0. Prérequis

- La migration `supabase/migrations/20260709_stripe_billing.sql` est appliquée
  (colonnes `stripe_customer_id`/`stripe_subscription_id`, table
  `stripe_events`, types d'événements étendus).
- Un compte Stripe (https://dashboard.stripe.com) — activer le **mode test**
  d'abord.

### 1. Créer la grille produits/prix

```bash
STRIPE_SECRET_KEY=sk_test_… node scripts/stripe/bootstrap-products.mjs
```

Crée `MOUVANCIA Solo` (49 €/mois, 490 €/an) et `MOUVANCIA Équipe` (199 €/mois,
1 990 €/an) avec les lookup keys `candidat_monthly`… — l'app les résout par ces
clés, **aucun price_id à configurer**. Montants HT.

### 2. Webhook

Dashboard → Developers → Webhooks → **Add endpoint** :

- URL : `https://app.mouvancia.fr/api/stripe/webhook`
- Événements : `checkout.session.completed`,
  `customer.subscription.updated`, `customer.subscription.deleted`,
  `invoice.paid`, `invoice.payment_failed`
- Copier le **signing secret** (`whsec_…`).

En local : `stripe listen --forward-to localhost:3000/api/stripe/webhook`
(affiche un `whsec_…` de session à mettre dans `.env.local`).

### 3. Billing Portal

Dashboard → Settings → **Billing → Customer portal** :

- Activer **Cancel subscriptions** (« at end of billing period »).
- Activer **Update subscriptions** et cocher les produits Solo & Équipe
  (les 4 prix) — c'est ce qui permet le changement de formule/cycle avec
  proration.
- Activer l'historique des factures et la mise à jour du moyen de paiement.

### 4. Variables d'environnement (Netlify → Environment)

```
STRIPE_SECRET_KEY=sk_live_…            # ou sk_test_… en preview
STRIPE_WEBHOOK_SECRET=whsec_…          # celui de l'endpoint créé en 2
SUPABASE_SERVICE_ROLE_KEY=…            # Supabase → Settings → API (⚠️ jamais NEXT_PUBLIC)
```

Sans ces trois variables, l'app reste en mode « facture à réception » — rien ne
casse.

### 5. Test de bout en bout (mode test)

1. Se connecter avec un compte d'essai → `/auth/abonnement` → choisir une
   formule → « Continuer vers le paiement ».
2. Payer avec la carte de test `4242 4242 4242 4242` (date future, CVC
   quelconque).
3. Retour sur `/auth/abonnement?checkout=success` → « Paiement confirmé » puis
   « Bienvenue à bord ! » (le webhook active le compte, en général < 5 s).
4. Vérifier : bandeau d'essai disparu, `/auth/team` affiche la formule, un
   événement `subscribe` (source `stripe`) dans `billing_events`.
5. « Gérer mon abonnement » → portail : changer de formule (événement
   `change_plan`), résilier (« prend fin le … »), reprendre.
6. Rejouer l'événement depuis le dashboard Stripe (Resend) → la réponse est
   `duplicate: true` (idempotence `stripe_events`).

## Comportements à connaître

- **Échec de paiement au renouvellement** : trace `payment_failed` dans
  `billing_events`, l'accès reste ouvert pendant les relances Stripe (Smart
  Retries) ; si tout échoue, `customer.subscription.deleted` repasse le compte
  `inactive` (le gating coupe).
- **Abonné carte qui re-souscrit** : la route checkout renvoie vers le portail
  (jamais deux subscriptions en parallèle).
- **Changement de grille tarifaire** : modifier ensemble `src/lib/team.ts`,
  `billing_price_eur()` (SQL) et relancer le bootstrap (les abonnements en
  cours gardent leur ancien prix).
- **Comptes « facture »** (activés manuellement ou avant Stripe) : gérés par
  les RPC `self_*` et le back-office, sans interaction avec Stripe tant qu'ils
  ne passent pas par un checkout.
