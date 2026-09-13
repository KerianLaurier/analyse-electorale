-- Une réservation durable par compte. Seul le backend peut la fermer après
-- vérification de l'état Stripe ; une expiration locale ne suffit jamais.
create table public.checkout_reservations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  attempt_id uuid not null default gen_random_uuid(),
  parameters jsonb not null,
  expires_at timestamptz not null default (now() + interval '1 hour'),
  session_id text,
  created_at timestamptz not null default now()
);
alter table public.checkout_reservations enable row level security;
revoke all on public.checkout_reservations from public, anon, authenticated;
grant all on public.checkout_reservations to service_role;

create or replace function public.reserve_checkout(p_user_id uuid, p_parameters jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_profile record; v_reservation public.checkout_reservations;
begin
  select subscription_status, stripe_subscription_id into v_profile
    from public.profiles where id = p_user_id for update;
  if not found then raise exception 'Profil introuvable' using errcode = 'P0002'; end if;
  if v_profile.subscription_status = 'active' and v_profile.stripe_subscription_id is not null then
    raise exception 'Abonnement déjà actif' using errcode = '23505';
  end if;
  if p_parameters is null or jsonb_typeof(p_parameters) <> 'object' then
    raise exception 'Paramètres de paiement invalides' using errcode = '22023';
  end if;
  insert into public.checkout_reservations(user_id, parameters) values (p_user_id, p_parameters)
    on conflict (user_id) do nothing;
  select * into v_reservation from public.checkout_reservations where user_id = p_user_id;
  return to_jsonb(v_reservation);
end;
$$;

create or replace function public.attach_checkout(p_user_id uuid, p_attempt_id uuid, p_session_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.checkout_reservations set session_id = p_session_id
    where user_id = p_user_id and attempt_id = p_attempt_id
      and (session_id is null or session_id = p_session_id);
  if not found then raise exception 'Réservation obsolète' using errcode = '40001'; end if;
end;
$$;

create or replace function public.release_expired_checkout(p_user_id uuid, p_attempt_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- Le service appelant doit avoir confirmé status=expired chez Stripe.
  -- Verrou partagé avec reserve_checkout et les changements de profil.
  perform 1 from public.profiles where id = p_user_id for update;
  delete from public.checkout_reservations where user_id = p_user_id and attempt_id = p_attempt_id;
end;
$$;

revoke all on function public.reserve_checkout(uuid,jsonb), public.attach_checkout(uuid,uuid,text), public.release_expired_checkout(uuid,uuid) from public, anon, authenticated;
grant execute on function public.reserve_checkout(uuid,jsonb), public.attach_checkout(uuid,uuid,text), public.release_expired_checkout(uuid,uuid) to service_role;
