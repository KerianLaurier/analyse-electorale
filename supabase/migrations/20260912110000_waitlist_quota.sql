-- Quota partagé entre toutes les instances, aucune adresse/IP stockée ici.
create table public.request_quotas (
  bucket text primary key, hits integer not null, expires_at timestamptz not null
);
alter table public.request_quotas enable row level security;
revoke all on public.request_quotas from public,anon,authenticated;
grant all on public.request_quotas to service_role;
create or replace function public.consume_waitlist_quota()
returns boolean language plpgsql security definer set search_path = '' as $$
declare n integer; window_start timestamptz := date_trunc('minute',clock_timestamp());
begin
  -- Faible volume attendu avant lancement ; plafond global de 60 requêtes/minute.
  insert into public.request_quotas(bucket,hits,expires_at)
    values ('waitlist:'||window_start::text,1,window_start+interval '2 minutes')
    on conflict (bucket) do update set hits=public.request_quotas.hits+1
    where public.request_quotas.hits<60 returning hits into n;
  delete from public.request_quotas where bucket in
    (select bucket from public.request_quotas where expires_at<now() limit 100);
  return n is not null;
end;
$$;
revoke all on function public.consume_waitlist_quota() from public,anon,authenticated;
grant execute on function public.consume_waitlist_quota() to service_role;
