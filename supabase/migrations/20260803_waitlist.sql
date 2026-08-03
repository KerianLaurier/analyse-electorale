-- Liste d'attente de pré-lancement.
--
-- ⚠️ APPLIQUÉE EN PROD le 2026-08-03 (via MCP apply_migration sur
-- fdfghtrxczauvrbmdxlq, sur accord explicite de Kerian). Ce fichier versionne
-- le SQL. Vérifié après application : 5 colonnes, RLS active, 0 policy,
-- contrainte unique et CHECK minuscules présents ; lecture ET écriture avec la
-- clé `anon` refusées en 401 (42501 permission denied) ; upsert idempotent et
-- rejet de la casse mixte confirmés par insertion de test, puis table vidée.
--
-- Contexte : la landing passe en mode « bientôt disponible » (les tarifs sont
-- retirés) et collecte des adresses e-mail en attendant l'ouverture.
--
-- RGPD — la table est volontairement minimale : e-mail, horodatage, origine.
-- Aucune donnée d'opinion politique, aucun nom, aucune IP, aucun user-agent.
-- La base légale est le consentement, recueilli explicitement dans le
-- formulaire de la landing (mention sous le champ) et tracé par `consent_at`.
--
-- Le linter Supabase signale `rls_enabled_no_policy` (niveau INFO) sur cette
-- table : c'est le comportement VOULU, identique à `public.stripe_events`.
-- Ne pas « corriger » en ajoutant une policy — ce serait ouvrir la liste.

create table if not exists public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  -- Contrainte unique portée par la COLONNE (et non par un index d'expression
  -- sur lower(email)) : PostgREST exige une contrainte de colonne pour
  -- `on_conflict`, dont dépend l'upsert idempotent de /api/waitlist.
  --
  -- L'insensibilité à la casse est alors garantie par l'invariant ci-dessous :
  -- la route normalise en minuscules, et la contrainte CHECK interdit qu'une
  -- écriture directe (back-office, SQL manuel) introduise une casse mixte qui
  -- créerait un doublon logique.
  email       text        not null unique
                          constraint waitlist_email_lowercase
                          check (email = lower(email)),
  source      text        not null default 'landing',
  consent_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index if not exists waitlist_created_at_idx
  on public.waitlist (created_at desc);

-- RLS activée SANS aucune policy : ni `anon` ni `authenticated` ne peuvent
-- lire ou écrire. Seul le service_role (route API serveur, back-office)
-- accède à la table — il contourne la RLS par conception.
--
-- C'est délibéré : une liste d'e-mails de sympathisants politiques ne doit
-- jamais être lisible depuis le navigateur, même par un compte connecté.
alter table public.waitlist enable row level security;

comment on table public.waitlist is
  'Liste d''attente de pré-lancement. Accès service_role uniquement (RLS sans policy).';
