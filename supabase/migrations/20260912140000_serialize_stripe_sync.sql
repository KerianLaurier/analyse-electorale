create table public.stripe_sync_leases (
  customer_id text primary key, token uuid not null, expires_at timestamptz not null
);
alter table public.stripe_sync_leases enable row level security;
revoke all on public.stripe_sync_leases from public,anon,authenticated;
grant all on public.stripe_sync_leases to service_role;
create or replace function public.acquire_stripe_sync(p_customer_id text)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if p_customer_id is null or length(p_customer_id)>255 then raise exception 'Client invalide'; end if;
 insert into public.stripe_sync_leases(customer_id,token,expires_at) values(p_customer_id,gen_random_uuid(),clock_timestamp()+interval '60 seconds')
 on conflict(customer_id) do update set token=excluded.token,expires_at=excluded.expires_at where public.stripe_sync_leases.expires_at<clock_timestamp()
 returning token into result;
 return result;
end;
$$;
create or replace function public.release_stripe_sync(p_customer_id text,p_token uuid)
returns void language sql security definer set search_path='' as $$
 delete from public.stripe_sync_leases where customer_id=p_customer_id and token=p_token
$$;
create or replace function public.apply_stripe_event_serialized(
 p_event_id text,p_event_type text,p_user_id uuid,p_customer_id text,p_subscription_id text,p_patch jsonb,p_billing_event jsonb,p_lease_token uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_customer_id is not null then
  perform 1 from public.stripe_sync_leases where customer_id=p_customer_id and token=p_lease_token and expires_at>clock_timestamp() for update;
  if not found then raise exception 'Réconciliation obsolète : relire Stripe' using errcode='40001'; end if;
 end if;
 return public.apply_stripe_event(p_event_id,p_event_type,p_user_id,p_customer_id,p_subscription_id,p_patch,p_billing_event);
end;
$$;
revoke all on function public.acquire_stripe_sync(text), public.release_stripe_sync(text,uuid), public.apply_stripe_event_serialized(text,text,uuid,text,text,jsonb,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.acquire_stripe_sync(text), public.release_stripe_sync(text,uuid), public.apply_stripe_event_serialized(text,text,uuid,text,text,jsonb,jsonb,uuid) to service_role;
