-- Parcours d'abonnement self-service (essai → souscription → changement → résiliation).
--
-- ⚠️ APPLIQUÉE EN PROD le 2026-07-09 (via MCP apply_migration sur
-- fdfghtrxczauvrbmdxlq, sur accord explicite de Kerian ; + patch
-- billing_price_eur_search_path le même jour). Ce fichier versionne le SQL.
-- Hook JWT vérifié post-application : sortie non-NULL, cancel_at en JSON null.
--
-- Modèle de facturation (pré-Stripe) : « activation immédiate, facture à
-- réception ». La cible (candidats, partis, cabinets) paie par virement sur
-- facture ; le checkout self-service active l'accès tout de suite et trace la
-- commande dans `billing_events` (montant figé au prix de la grille du moment).
-- L'équipe émet la facture depuis le back-office ; l'admin peut suspendre un
-- mauvais payeur (`admin_set_subscription`). Le jour où Stripe est branché,
-- seules les RPC `self_*` changent d'implémentation — l'UI et le gating restent.
--
-- Résiliation : `self_cancel()` programme la fin d'accès à la PROCHAINE
-- échéance (roulement mensuel/annuel depuis `subscription_started_at`) dans
-- `profiles.cancel_at`. L'accès reste ouvert jusque-là (`computeAccess` côté
-- middleware : active ⇒ cancel_at NULL ou futur) ; `self_resume()` se rétracte
-- tant que l'échéance n'est pas passée. Pas de cron : le gating compare à now().
--
-- Le hook JWT est mis à jour pour embarquer `cancel_at` dans les claims.
-- ⚠️ PIÈGE CONNU (panne login du 2026-06-24, cf. 20260624_fix_jwt_hook_null_claims.sql) :
-- ne JAMAIS passer un SQL NULL à `jsonb_set` (STRICT). On reste sur le pattern
-- sûr `jsonb_build_object` (encode NULL en JSON `null`) fusionné par `||`.

-- ── 1. Colonnes de facturation ────────────────────────────────────────────────

alter table public.profiles
  add column if not exists billing_cycle text
    check (billing_cycle in ('monthly', 'yearly')),
  add column if not exists subscription_started_at timestamptz,
  add column if not exists cancel_at timestamptz;

comment on column public.profiles.billing_cycle is
  'Cycle de facturation choisi au checkout (monthly/yearly). NULL tant que jamais souscrit.';
comment on column public.profiles.subscription_started_at is
  'Début de l''abonnement courant — origine du roulement des échéances.';
comment on column public.profiles.cancel_at is
  'Fin d''accès programmée après résiliation (prochaine échéance). NULL = reconduction tacite.';

-- Lecture par l'utilisateur : SELECT est déjà accordé au niveau table.
-- Écriture : PAS de grant UPDATE sur ces colonnes (l'UPDATE de `authenticated`
-- reste limité à full_name/organisation) — tout passe par les RPC ci-dessous.

-- ── 2. Journal des événements de facturation ─────────────────────────────────

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('subscribe', 'change_plan', 'change_cycle', 'resume', 'cancel', 'admin_set')),
  tier text,
  cycle text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.billing_events is
  'Audit des souscriptions/changements/résiliations. Insertion via RPC SECURITY DEFINER uniquement — sert de « boîte de réception » facturation au back-office.';

create index if not exists billing_events_user_idx on public.billing_events (user_id, created_at desc);
create index if not exists billing_events_created_idx on public.billing_events (created_at desc);

alter table public.billing_events enable row level security;

revoke all on public.billing_events from anon, authenticated, public;
grant select on public.billing_events to authenticated;

drop policy if exists "billing_events_self_or_admin_select" on public.billing_events;
create policy "billing_events_self_or_admin_select" on public.billing_events
  as permissive for select to authenticated
  using (user_id = (select auth.uid()) or public.is_super_admin());

-- ── 3. Grille tarifaire figée (source de vérité des montants facturés) ──────
-- Tenue en phase avec l'affichage front : src/lib/team.ts (PLANS).

create or replace function public.billing_price_eur(p_tier text, p_cycle text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_tier = 'candidat' and p_cycle = 'monthly' then 49
    when p_tier = 'candidat' and p_cycle = 'yearly'  then 490
    when p_tier = 'equipe'   and p_cycle = 'monthly' then 199
    when p_tier = 'equipe'   and p_cycle = 'yearly'  then 1990
  end;
$$;

revoke execute on function public.billing_price_eur(text, text) from anon, public;

-- ── 4. RPC self-service ──────────────────────────────────────────────────────

-- Souscrire / changer de formule ou de cycle / se réactiver — en un appel.
-- La formule « parti » (sur devis) n'est volontairement PAS self-service.
create or replace function public.self_set_plan(p_tier text, p_cycle text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user uuid := (select auth.uid());
  prof record;
  v_type text;
  v_amount integer;
begin
  if v_user is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;
  if p_tier not in ('candidat', 'equipe') then
    raise exception 'Formule invalide (self-service : candidat ou equipe)';
  end if;
  if p_cycle not in ('monthly', 'yearly') then
    raise exception 'Cycle invalide (monthly ou yearly)';
  end if;

  select subscription_status, subscription_tier, billing_cycle, cancel_at
    into prof
  from public.profiles
  where id = v_user
  for update;

  if not found then
    raise exception 'Profil introuvable';
  end if;

  -- No-op : déjà actif sur la même formule/cycle, sans résiliation en cours.
  if prof.subscription_status = 'active'
     and prof.subscription_tier = p_tier
     and prof.billing_cycle is not distinct from p_cycle
     and prof.cancel_at is null then
    return;
  end if;

  v_type := case
    when prof.subscription_status <> 'active' then 'subscribe'
    when prof.subscription_tier <> p_tier then 'change_plan'
    when prof.billing_cycle is distinct from p_cycle then 'change_cycle'
    else 'resume'
  end;
  v_amount := public.billing_price_eur(p_tier, p_cycle);

  update public.profiles
     set subscription_status = 'active',
         subscription_tier = p_tier,
         billing_cycle = p_cycle,
         -- Nouvelle période uniquement à la (ré)activation ; un simple
         -- changement de formule/cycle conserve l'origine des échéances.
         subscription_started_at = case
           when prof.subscription_status <> 'active'
             or (prof.cancel_at is not null and prof.cancel_at <= now())
           then now()
           else coalesce(subscription_started_at, now())
         end,
         trial_ends_at = null,
         cancel_at = null
   where id = v_user;

  insert into public.billing_events (user_id, type, tier, cycle, details)
  values (
    v_user, v_type, p_tier, p_cycle,
    jsonb_build_object(
      'old_status', prof.subscription_status,
      'old_tier', prof.subscription_tier,
      'old_cycle', prof.billing_cycle,
      'amount_eur', v_amount
    )
  );
end;
$$;

-- Résilier : l'accès court jusqu'à la prochaine échéance (roulement depuis le
-- début d'abonnement), puis le gating coupe — aucune tâche planifiée requise.
create or replace function public.self_cancel()
returns timestamptz
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user uuid := (select auth.uid());
  prof record;
  v_step interval;
  v_next timestamptz;
begin
  if v_user is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;

  select subscription_status, subscription_tier, billing_cycle, subscription_started_at, cancel_at
    into prof
  from public.profiles
  where id = v_user
  for update;

  if not found or prof.subscription_status <> 'active' then
    raise exception 'Aucun abonnement actif à résilier';
  end if;
  if prof.cancel_at is not null then
    return prof.cancel_at; -- déjà résilié : idempotent
  end if;

  v_step := case when prof.billing_cycle = 'yearly' then interval '1 year' else interval '1 month' end;
  v_next := coalesce(prof.subscription_started_at, now());
  while v_next <= now() loop
    v_next := v_next + v_step;
  end loop;

  update public.profiles set cancel_at = v_next where id = v_user;

  insert into public.billing_events (user_id, type, tier, cycle, details)
  values (v_user, 'cancel', prof.subscription_tier, prof.billing_cycle,
          jsonb_build_object('cancel_at', v_next));

  return v_next;
end;
$$;

-- Se rétracter d'une résiliation tant que l'échéance n'est pas passée.
create or replace function public.self_resume()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user uuid := (select auth.uid());
  prof record;
begin
  if v_user is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;

  select subscription_status, subscription_tier, billing_cycle, cancel_at
    into prof
  from public.profiles
  where id = v_user
  for update;

  if not found or prof.subscription_status <> 'active' or prof.cancel_at is null then
    raise exception 'Aucune résiliation en cours';
  end if;
  if prof.cancel_at <= now() then
    raise exception 'Abonnement expiré — souscrivez à nouveau';
  end if;

  update public.profiles set cancel_at = null where id = v_user;

  insert into public.billing_events (user_id, type, tier, cycle, details)
  values (v_user, 'resume', prof.subscription_tier, prof.billing_cycle,
          jsonb_build_object('was_cancel_at', prof.cancel_at));
end;
$$;

grant execute on function public.self_set_plan(text, text) to authenticated;
grant execute on function public.self_cancel() to authenticated;
grant execute on function public.self_resume() to authenticated;
revoke execute on function public.self_set_plan(text, text) from anon, public;
revoke execute on function public.self_cancel() from anon, public;
revoke execute on function public.self_resume() from anon, public;

-- ── 5. RPC admin étendue (cycle + fin programmée + audit) ────────────────────
-- DROP puis CREATE : ajouter des paramètres DEFAULT crée sinon une SECONDE
-- surcharge, ambiguë pour PostgREST (l'appel 4 clés matcherait les deux).
-- Le back-office actuel (4 arguments) reste compatible grâce aux DEFAULT.

drop function if exists public.admin_set_subscription(uuid, text, text, timestamptz);

create or replace function public.admin_set_subscription(
  p_user uuid,
  p_status text,
  p_tier text,
  p_trial_ends_at timestamptz,
  p_billing_cycle text default null,
  p_cancel_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_super_admin() then raise exception 'Acces refuse' using errcode = '42501'; end if;
  if p_status not in ('trial', 'active', 'inactive') then raise exception 'Statut invalide'; end if;
  if p_tier not in ('candidat', 'equipe', 'parti') then raise exception 'Formule invalide'; end if;
  if p_billing_cycle is not null and p_billing_cycle not in ('monthly', 'yearly') then
    raise exception 'Cycle invalide';
  end if;

  update public.profiles
     set subscription_status = p_status,
         subscription_tier = p_tier,
         trial_ends_at = p_trial_ends_at,
         billing_cycle = coalesce(p_billing_cycle, billing_cycle),
         cancel_at = p_cancel_at,
         subscription_started_at = case
           when p_status = 'active' then coalesce(subscription_started_at, now())
           else subscription_started_at
         end
   where id = p_user;

  insert into public.billing_events (user_id, type, tier, cycle, details)
  values (
    p_user, 'admin_set', p_tier, p_billing_cycle,
    jsonb_build_object(
      'status', p_status,
      'trial_ends_at', p_trial_ends_at,
      'cancel_at', p_cancel_at,
      'by', (select auth.uid())
    )
  );
end;
$$;

grant execute on function public.admin_set_subscription(uuid, text, text, timestamptz, text, timestamptz) to authenticated;
revoke execute on function public.admin_set_subscription(uuid, text, text, timestamptz, text, timestamptz) from anon, public;

-- ── 6. Hook JWT : + cancel_at dans les claims ────────────────────────────────
-- Toujours via jsonb_build_object (JAMAIS to_jsonb(NULL) dans jsonb_set — cf.
-- en-tête). Les tokens émis avant cette migration n'ont pas la clé cancel_at :
-- le middleware traite l'absence comme NULL (accès inchangé).

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path to 'public'
as $$
declare
  claims jsonb;
  prof record;
begin
  claims := coalesce(event -> 'claims', '{}'::jsonb);

  if not (claims ? 'app_metadata') then
    claims := jsonb_set(claims, '{app_metadata}', '{}'::jsonb);
  end if;

  select subscription_status, trial_ends_at, cancel_at, is_super_admin
    into prof
  from public.profiles
  where id = (event ->> 'user_id')::uuid;

  if found then
    -- jsonb_build_object encode un NULL en JSON `null` (jamais SQL NULL),
    -- contrairement à to_jsonb(NULL) + jsonb_set (strict).
    claims := jsonb_set(
      claims,
      '{app_metadata}',
      coalesce(claims -> 'app_metadata', '{}'::jsonb) || jsonb_build_object(
        'subscription_status', prof.subscription_status,
        'trial_ends_at', prof.trial_ends_at,
        'cancel_at', prof.cancel_at,
        'is_super_admin', coalesce(prof.is_super_admin, false)
      )
    );
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;
