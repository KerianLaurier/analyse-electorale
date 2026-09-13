-- À appliquer avant le nouveau webhook. Aucun appel à Stripe depuis SQL.
-- Déduplication, profil et journal sont validés dans UNE transaction : une
-- erreur ou un arrêt avant COMMIT laisse l'événement intégralement rejouable.
create or replace function public.apply_stripe_event(
  p_event_id text,
  p_event_type text,
  p_user_id uuid,
  p_customer_id text,
  p_subscription_id text,
  p_patch jsonb,
  p_billing_event jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subscription_id text;
begin
  insert into public.stripe_events (id, type)
  values (p_event_id, p_event_type)
  on conflict (id) do nothing;
  if not found then return false; end if;

  if p_user_id is null then return true; end if;

  select stripe_subscription_id into v_subscription_id
    from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'Profil Stripe introuvable' using errcode = 'P0002';
  end if;

  -- Une suppression tardive d'un ANCIEN abonnement ne doit pas couper le
  -- nouvel abonnement du compte. Le journal conserve néanmoins l'événement.
  if p_patch is not null and not (
    p_patch ->> 'subscription_status' = 'inactive'
    and v_subscription_id is not null
    and v_subscription_id is distinct from p_subscription_id
  ) then
    update public.profiles set
      subscription_status = p_patch ->> 'subscription_status',
      subscription_tier = coalesce(p_patch ->> 'subscription_tier', subscription_tier),
      billing_cycle = coalesce(p_patch ->> 'billing_cycle', billing_cycle),
      subscription_started_at = coalesce((p_patch ->> 'subscription_started_at')::timestamptz, subscription_started_at),
      trial_ends_at = (p_patch ->> 'trial_ends_at')::timestamptz,
      cancel_at = (p_patch ->> 'cancel_at')::timestamptz,
      stripe_subscription_id = p_patch ->> 'stripe_subscription_id',
      stripe_customer_id = coalesce(p_customer_id, stripe_customer_id)
    where id = p_user_id;
  end if;

  if p_billing_event is not null then
    insert into public.billing_events (user_id, type, tier, cycle, details)
    values (
      p_user_id, p_billing_event ->> 'type', p_billing_event ->> 'tier',
      p_billing_event ->> 'cycle',
      coalesce(p_billing_event -> 'details', '{}'::jsonb)
        || jsonb_build_object('source', 'stripe', 'stripe_event_id', p_event_id)
    );
  end if;
  return true;
end;
$$;

-- Le rôle utilisateur ne peut jamais fabriquer un paiement ou un profil.
revoke all on function public.apply_stripe_event(text, text, uuid, text, text, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_stripe_event(text, text, uuid, text, text, jsonb, jsonb)
  to service_role;
