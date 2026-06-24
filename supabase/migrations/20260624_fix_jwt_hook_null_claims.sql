-- Hotfix : le Custom Access Token Hook retournait NULL → panne d'auth totale.
--
-- Symptôme (logs auth prod, 2026-06-24) : tout /token (login ET refresh_token)
-- en 500 « output claims do not conform to the expected schema: (root):
-- Invalid type. Expected: object, given: null ». Plus personne ne peut se
-- connecter ni rafraîchir sa session.
--
-- Cause : dans 20260623_jwt_subscription_claims.sql, le hook faisait
--   claims := jsonb_set(claims, '{app_metadata,trial_ends_at}',
--                       to_jsonb(prof.trial_ends_at));
-- Or `to_jsonb(NULL::timestamptz)` vaut SQL NULL (pas un JSON `null`), et
-- `jsonb_set` est STRICT : un argument SQL NULL rend TOUT le résultat NULL.
-- Comme `trial_ends_at` est NULL pour tout compte non-trial (le cas courant),
-- `claims` devenait NULL, puis la valeur de retour du hook aussi → GoTrue
-- rejette le token.
--
-- Correctif : construire `app_metadata` en un seul `jsonb_build_object` (qui
-- encode un NULL en JSON `null` sans devenir SQL NULL) fusionné avec `||`. On
-- ne passe plus jamais SQL NULL à `jsonb_set`.

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

  select subscription_status, trial_ends_at, is_super_admin
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
        'is_super_admin', coalesce(prof.is_super_admin, false)
      )
    );
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;
