-- Claims d'abonnement dans le JWT (Custom Access Token Hook).
--
-- Objectif : supprimer le round-trip DB du middleware. Aujourd'hui `src/proxy.ts`
-- exécute un SELECT sur `profiles` à CHAQUE navigation pour vérifier
-- l'abonnement / le statut super-admin. En injectant ces champs comme claims du
-- JWT, le middleware les lit localement (signature vérifiée) sans toucher la base.
--
-- ⚠️ Application MANUELLE (migration prod soumise à validation — cf. règle repo).
-- Deux étapes, dans l'ordre :
--   1. Appliquer ce SQL (crée la fonction hook + droits + policy de lecture).
--   2. Dashboard Supabase → Authentication → Hooks → « Customize Access Token
--      (JWT) Claims » → sélectionner `public.custom_access_token_hook`.
--      (équivalent CLI : [auth.hook.custom_access_token] dans config.toml)
--
-- Tant que l'étape 2 n'est pas faite, les tokens ne portent pas les claims :
-- le middleware retombe automatiquement sur la requête `profiles` (fallback sûr,
-- comportement actuel inchangé). Voir src/proxy.ts.
--
-- Latence de propagation : les claims sont figés dans le token à son émission.
-- Un changement d'abonnement (admin_set_subscription) ne se reflète qu'au
-- prochain rafraîchissement de token (≈ 1 h, ou re-connexion). Acceptable pour
-- un gating d'accès ; les opérations sensibles restent gardées par la RLS.

-- Hook appelé par Supabase Auth à l'émission de chaque access token.
-- `event` contient `user_id` et les `claims` courants ; on renvoie l'event enrichi.
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

  -- app_metadata est l'emplacement conventionnel des claims applicatifs.
  if not (claims ? 'app_metadata') then
    claims := jsonb_set(claims, '{app_metadata}', '{}'::jsonb);
  end if;

  select subscription_status, trial_ends_at, is_super_admin
    into prof
  from public.profiles
  where id = (event ->> 'user_id')::uuid;

  if found then
    claims := jsonb_set(claims, '{app_metadata,subscription_status}', to_jsonb(prof.subscription_status));
    claims := jsonb_set(claims, '{app_metadata,trial_ends_at}', to_jsonb(prof.trial_ends_at));
    claims := jsonb_set(claims, '{app_metadata,is_super_admin}', to_jsonb(coalesce(prof.is_super_admin, false)));
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- Seul le rôle d'auth de Supabase peut exécuter le hook ; personne d'autre.
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

-- Le hook s'exécute sous `supabase_auth_admin` : il lui faut lire `profiles`.
grant usage on schema public to supabase_auth_admin;
grant select on public.profiles to supabase_auth_admin;

-- `profiles` est sous RLS → policy explicite autorisant ce rôle à lire (uniquement).
drop policy if exists "profiles_auth_admin_read" on public.profiles;
create policy "profiles_auth_admin_read" on public.profiles
  as permissive for select to supabase_auth_admin
  using (true);
