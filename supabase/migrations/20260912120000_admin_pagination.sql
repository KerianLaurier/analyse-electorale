create or replace function public.admin_accounts_page(p_query text default '', p_status text default 'all', p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_super_admin() then raise exception 'Accès refusé' using errcode='42501'; end if;
  if p_offset is null or p_offset<0 or p_offset>1000000 or length(p_query)>100 or p_status is null or p_status not in ('all','trial','active','inactive') then raise exception 'Filtres invalides'; end if;
  with matching as (
    select p.*,t.name as team_name from public.profiles p left join public.teams t on t.id=p.team_id
    where (p_status='all' or p.subscription_status=p_status)
      and (coalesce(p_query,'')='' or position(lower(p_query) in lower(concat_ws(' ',p.email,p.full_name,p.organisation,t.name)))>0)
  ), page as (select * from matching order by created_at desc,id desc limit 50 offset p_offset)
  select jsonb_build_object('accounts',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb),
    'matched',(select count(*) from matching),
    'stats',(select jsonb_build_object('total',count(*),'active',count(*) filter(where subscription_status='active'),
      'trial',count(*) filter(where subscription_status='trial'),'inactive',count(*) filter(where subscription_status='inactive'),
      'admins',count(*) filter(where is_super_admin)) from public.profiles)) into result;
  return result;
end;
$$;
revoke all on function public.admin_accounts_page(text,text,integer) from public,anon;
grant execute on function public.admin_accounts_page(text,text,integer) to authenticated;
