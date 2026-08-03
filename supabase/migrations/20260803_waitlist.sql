-- Liste d'attente de pré-lancement.
--
-- ⚠️ NON ENCORE APPLIQUÉE EN PROD au moment du commit. À appliquer sur
-- fdfghtrxczauvrbmdxlq sur accord explicite de Kerian (cf. convention des
-- migrations précédentes). Tant qu'elle ne l'est pas, POST /api/waitlist
-- répondra 500 — le formulaire de la landing affiche alors un repli e-mail.
--
-- Contexte : la landing passe en mode « bientôt disponible » (les tarifs sont
-- retirés) et collecte des adresses e-mail en attendant l'ouverture.
--
-- RGPD — la table est volontairement minimale : e-mail, horodatage, origine.
-- Aucune donnée d'opinion politique, aucun nom, aucune IP, aucun user-agent.
-- La base légale est le consentement, recueilli explicitement dans le
-- formulaire (case à cocher) et tracé par `consent_at`.

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
