-- Paiement par carte via Stripe (Checkout + webhooks + Billing Portal).
--
-- ⚠️ APPLIQUÉE EN PROD le 2026-07-12 (via MCP apply_migration sur
-- fdfghtrxczauvrbmdxlq, sur accord explicite de Kerian). Ce fichier versionne
-- le SQL. Vérifié post-application : colonnes stripe_*, index unique, RLS
-- stripe_events, CHECK billing_events à 8 types. Le hook JWT n'est pas touché.
--
-- Complète 20260708_self_service_billing.sql : la vérité de l'abonnement d'un
-- client Stripe vit chez Stripe et est SYNCHRONISÉE dans `profiles` par le
-- webhook (/api/stripe/webhook, service role) — le gating (claims JWT,
-- computeAccess) et l'UI ne changent pas. Le mode « facture à réception »
-- (RPC self_*) reste le repli quand STRIPE_SECRET_KEY n'est pas configurée.

-- ── 1. Rattachement Stripe des profils ───────────────────────────────────────

alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

comment on column public.profiles.stripe_customer_id is
  'Customer Stripe du compte (créé au premier checkout). Clé de réconciliation des webhooks.';
comment on column public.profiles.stripe_subscription_id is
  'Subscription Stripe active. NULL si jamais abonné via Stripe ou abonnement supprimé.';

-- Un customer Stripe ↔ un profil (l'index partiel ignore les NULL).
create unique index if not exists profiles_stripe_customer_uidx
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

-- Écriture réservée au service role (webhook / routes serveur) : comme les
-- colonnes billing, PAS de grant UPDATE à `authenticated`.

-- ── 2. Idempotence des webhooks ──────────────────────────────────────────────
-- Stripe rejoue les événements (retries, incidents) : chaque event.id n'est
-- traité qu'une fois — l'INSERT en conflit signale « déjà traité ».

create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  created_at timestamptz not null default now()
);

comment on table public.stripe_events is
  'Événements webhook Stripe déjà traités (dédup par event.id). Accès service role uniquement.';

alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from anon, authenticated, public;
-- Aucune policy : seul le service role (bypass RLS) y accède.

-- ── 3. Types d'événements de facturation étendus ─────────────────────────────
-- + renewal (renouvellement encaissé, invoice.paid subscription_cycle)
-- + payment_failed (échec d'encaissement — trace ; la coupure d'accès passe
--   par subscription.updated/deleted une fois les relances Stripe épuisées).

alter table public.billing_events drop constraint if exists billing_events_type_check;
alter table public.billing_events add constraint billing_events_type_check
  check (type in ('subscribe', 'change_plan', 'change_cycle', 'resume', 'cancel', 'admin_set', 'renewal', 'payment_failed'));
