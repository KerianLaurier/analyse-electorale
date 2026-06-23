-- Claims d'abonnement dans le JWT (Custom Access Token Hook).
--
-- Objectif : supprimer le round-trip DB du middleware. `src/proxy.ts` lit
-- subscription_status / trial_ends_at / is_super_admin depuis les claims du JWT
-- (vérifiés localement), au lieu d'interroger `profiles`.
--
-- ⚠️ APPLIQUÉE EN PROD le 2026-06-23 (via MCP apply_migration sur
-- fdfghtrxczauvrbmdxlq) ET hook activé au dashboard. Ce fichier versionne le SQL.
--
-- Latence de propagation : les claims sont figés à l'émission du token ; un
-- changement d'abonnement ne se reflète qu'au prochain rafraîchissement (~1 h)
-- ou à la reconnexion. Acceptable pour un gating d'accès.

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
    claims := jsonb_set(claims, '{app_metadata,subscription_status}', to_jsonb(prof.subscription_status));
    claims := jsonb_set(claims, '{app_metadata,trial_ends_at}', to_jsonb(prof.trial_ends_at));
    claims := jsonb_set(claims, '{app_metadata,is_super_admin}', to_jsonb(coalesce(prof.is_super_admin, false)));
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

grant usage on schema public to supabase_auth_admin;
grant select on public.profiles to supabase_auth_admin;

drop policy if exists "profiles_auth_admin_read" on public.profiles;
create policy "profiles_auth_admin_read" on public.profiles
  as permissive for select to supabase_auth_admin
  using (true);
