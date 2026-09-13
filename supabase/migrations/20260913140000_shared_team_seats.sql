-- La facturation reste attachée au compte payeur ; transférer la propriété
-- opérationnelle d'une équipe ne transfère jamais un mandat Stripe.
alter table public.teams add column billing_owner_id uuid references auth.users(id) on delete set null;
update public.teams set billing_owner_id=created_by;
create function public.initialize_team_billing_owner() returns trigger language plpgsql set search_path='' as $$
begin
 if new.billing_owner_id is null then new.billing_owner_id:=new.created_by; end if;
 return new;
end;
$$;
revoke all on function public.initialize_team_billing_owner() from public,anon,authenticated;
create trigger initialize_billing_owner before insert on public.teams for each row execute function public.initialize_team_billing_owner();
-- Toutes les mutations de structure passent par les RPC verrouillées.
revoke insert, update, delete on public.teams from anon, authenticated;

-- Essai : cinq sièges pour tester la collaboration ; Solo : un seul siège.
create function public.account_seat_limit(p_user uuid) returns integer
language sql stable security definer set search_path='' as $$
 select coalesce((select case
  when subscription_status='trial' and trial_ends_at>now() then 5
  when subscription_status='active' and (cancel_at is null or cancel_at>now()) then
   case subscription_tier when 'equipe' then 5 when 'parti' then 2147483647 else 1 end
  else 0 end from public.profiles where id=p_user),0)
$$;
revoke all on function public.account_seat_limit(uuid) from public,anon,authenticated;

create function public.team_seat_for(p_user uuid,p_team uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select ranked.position<=public.account_seat_limit(t.billing_owner_id)
 from public.teams t join (
  select p.id,p.team_id,row_number() over(order by (p.id=t2.billing_owner_id) desc,(p.id=t2.created_by) desc,p.created_at,p.id) position
  from public.profiles p join public.teams t2 on t2.id=p.team_id where p.team_id=p_team
 ) ranked on ranked.team_id=t.id and ranked.id=p_user
 where t.id=p_team and exists(select 1 from public.profiles payer where payer.id=t.billing_owner_id and payer.team_id=t.id)),false)
$$;
revoke all on function public.team_seat_for(uuid,uuid) from public,anon,authenticated;

create function public.entitled_team_id() returns uuid
language sql stable security definer set search_path='' as $$
 select team_id from public.profiles where id=auth.uid() and public.team_seat_for(id,team_id)
$$;
revoke all on function public.entitled_team_id() from public,anon;
grant execute on function public.entitled_team_id() to authenticated;

create or replace function public.has_workspace_access() returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select is_super_admin or public.account_seat_limit(id)>0 or public.team_seat_for(id,team_id)
 from public.profiles where id=auth.uid()),false)
$$;

-- Le paiement personnel permet les données personnelles ; le partage exige
-- un siège de l'équipe. Après un déclassement, aucune ligne n'est supprimée.
do $$ declare t text; begin
 foreach t in array array['tasks','contacts','shifts','shift_signups','canvass_reports','notes','pins','campaigns','campaign_sectors','phone_lists','phone_contacts','team_roles','member_roles','watch_keywords'] loop
  execute format('create policy team_seat on public.%I as restrictive for all to authenticated using (team_id is null or team_id=(select public.entitled_team_id())) with check (team_id is null or team_id=(select public.entitled_team_id()))',t);
 end loop;
end; $$;

create function public.workspace_entitlement() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.profiles; payer public.profiles; t public.teams; covered boolean; sub public.profiles;
begin
 select * into p from public.profiles where id=auth.uid();
 if not found then raise exception 'Authentification requise' using errcode='42501'; end if;
 select * into t from public.teams where id=p.team_id;
 select * into payer from public.profiles where id=t.billing_owner_id;
 covered:=coalesce(p.id<>t.billing_owner_id and public.team_seat_for(p.id,p.team_id),false);
 if covered then sub:=payer; else sub:=p; end if;
 return jsonb_build_object('has_access',public.has_workspace_access(),'team_access',public.team_seat_for(p.id,p.team_id),'covered_by_team',covered,
  'billing_owner_id',t.billing_owner_id,'team_name',t.name,'seat_limit',public.account_seat_limit(t.billing_owner_id),
  'seats_used',(select count(*) from public.profiles where team_id=t.id),
  'subscription',jsonb_build_object('status',sub.subscription_status,'tier',sub.subscription_tier,
   'trialEndsAt',sub.trial_ends_at,'cancelAt',sub.cancel_at,'billingCycle',sub.billing_cycle,'startedAt',sub.subscription_started_at));
end;
$$;
revoke all on function public.workspace_entitlement() from public,anon;
grant execute on function public.workspace_entitlement() to authenticated;

create or replace function public.join_team(p_code text) returns public.teams
language plpgsql security definer set search_path='' as $$
declare t public.teams; p public.profiles; capacity integer;
begin
 select * into p from public.profiles where id=auth.uid() for update;
 if not found then raise exception 'Authentification requise' using errcode='42501'; end if;
 select * into t from public.teams where join_code=upper(trim(p_code)) for update;
 if t.id is null then raise exception 'Code d’équipe invalide'; end if;
 if p.team_id=t.id then return t; end if;
 if p.team_id is not null then raise exception 'Quittez votre équipe avant d’en rejoindre une autre'; end if;
 capacity:=public.account_seat_limit(t.billing_owner_id);
 if capacity=0 then raise exception 'L’abonnement de cette équipe est inactif' using errcode='P0005'; end if;
 if (select count(*) from public.profiles where team_id=t.id)>=capacity then
  raise exception 'Tous les sièges de cette équipe sont occupés' using errcode='P0003';
 end if;
 if p.subscription_status<>'active' and exists(select 1 from public.checkout_reservations where user_id=p.id) then
  raise exception 'Un paiement personnel est en cours. Vérifiez sa clôture avant de rejoindre une équipe' using errcode='P0006';
 end if;
 update public.profiles set team_id=t.id,role='member' where id=p.id;
 return t;
end;
$$;

create or replace function public.leave_team() returns void
language plpgsql security definer set search_path='' as $$
declare p public.profiles; t public.teams;
begin
 select * into p from public.profiles where id=auth.uid() for update;
 if not found then raise exception 'Authentification requise' using errcode='42501'; end if;
 select * into t from public.teams where id=p.team_id for update;
 if t.created_by=p.id then raise exception 'Le propriétaire doit transférer son équipe avant de la quitter'; end if;
 if t.billing_owner_id=p.id then
  if p.subscription_status='active' and public.account_seat_limit(p.id)>0 then
   raise exception 'Ce compte porte la facturation de l’équipe. Régularisez son abonnement avant de partir';
  end if;
  update public.teams set billing_owner_id=t.created_by where id=t.id;
 end if;
 delete from public.member_roles where member_id=p.id and team_id=p.team_id;
 update public.profiles set team_id=null,role='member' where id=p.id;
end;
$$;

-- Même verrou de profil que join_team : un changement d'équipe ne peut
-- contourner le contrôle et ouvrir un second paiement en concurrence.
create or replace function public.reserve_checkout(p_user_id uuid,p_parameters jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.profiles; reservation public.checkout_reservations;
begin
 select * into p from public.profiles where id=p_user_id for update;
 if not found then raise exception 'Profil introuvable' using errcode='P0002'; end if;
 if p.subscription_status='active' and p.stripe_subscription_id is not null then
  raise exception 'Abonnement déjà actif' using errcode='23505';
 end if;
 if exists(select 1 from public.teams where id=p.team_id and billing_owner_id<>p.id) and public.team_seat_for(p.id,p.team_id) then
  raise exception 'Votre accès est couvert par votre équipe' using errcode='P0004';
 end if;
 if p_parameters is null or jsonb_typeof(p_parameters)<>'object' then raise exception 'Paramètres invalides' using errcode='22023'; end if;
 insert into public.checkout_reservations(user_id,parameters) values(p.id,p_parameters) on conflict(user_id) do nothing;
 select * into reservation from public.checkout_reservations where user_id=p.id;
 return to_jsonb(reservation);
end;
$$;

-- La résiliation personnelle reste autorisée ; une nouvelle activation est refusée.
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

  if exists(select 1 from public.teams t join public.profiles p on p.team_id=t.id
    where p.id=v_user and t.billing_owner_id<>v_user and public.team_seat_for(v_user,t.id)) then
    raise exception 'Votre accès est couvert par votre équipe' using errcode='P0004';
  end if;

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

-- La résiliation personnelle reste autorisée ; une nouvelle activation est refusée.
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

  if exists(select 1 from public.teams t join public.profiles p on p.team_id=t.id
    where p.id=v_user and t.billing_owner_id<>v_user and public.team_seat_for(v_user,t.id)) then
    raise exception 'Votre accès est couvert par votre équipe' using errcode='P0004';
  end if;

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
