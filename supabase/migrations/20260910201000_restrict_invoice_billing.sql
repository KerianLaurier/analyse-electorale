-- Activation sur facture : autorisation explicite en base, jamais déterminée
-- par l'absence d'une clé Stripe dans l'environnement du serveur web.
-- Liste vide par défaut. Un administrateur doit y inscrire, via SQL/service
-- role, les seuls comptes commerciaux autorisés à payer sur facture.
create table public.invoice_billing_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.invoice_billing_accounts enable row level security;
revoke all on public.invoice_billing_accounts from public, anon, authenticated;
grant all on public.invoice_billing_accounts to service_role;

create or replace function public.can_use_invoice_billing()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.invoice_billing_accounts a
    join public.profiles p on p.id = a.user_id
    where a.user_id = (select auth.uid())
      and p.stripe_customer_id is null and p.stripe_subscription_id is null
  );
$$;
revoke all on function public.can_use_invoice_billing() from public, anon;
grant execute on function public.can_use_invoice_billing() to authenticated;

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
  if p_tier is null or p_tier not in ('candidat', 'equipe') then
    raise exception 'Formule invalide (self-service : candidat ou equipe)';
  end if;
  if p_cycle is null or p_cycle not in ('monthly', 'yearly') then
    raise exception 'Cycle invalide (monthly ou yearly)';
  end if;

  select subscription_status, subscription_tier, billing_cycle, cancel_at
    into prof
  from public.profiles
  where id = v_user
  for update;

  if not public.can_use_invoice_billing() then
    raise exception 'Facturation sur facture non autorisée — contactez le support ou utilisez Stripe'
      using errcode = '42501';
  end if;

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

  if not public.can_use_invoice_billing() then
    raise exception 'Facturation sur facture non autorisée — contactez le support ou utilisez Stripe'
      using errcode = '42501';
  end if;

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

  if not public.can_use_invoice_billing() then
    raise exception 'Facturation sur facture non autorisée — contactez le support ou utilisez Stripe'
      using errcode = '42501';
  end if;

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
