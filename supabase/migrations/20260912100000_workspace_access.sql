-- Complément vérifié contre le catalogue du projet, relevé le 12 septembre.
-- Les propriétaires conservent le partage ; un collaborateur ne peut s'approprier une ligne.
create or replace function public.guard_workspace_ownership()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.id is distinct from old.id or new.user_id is distinct from old.user_id then
      raise exception 'Propriétaire immuable' using errcode = '42501';
    end if;
    if new.team_id is distinct from old.team_id and old.user_id is distinct from auth.uid() then
      raise exception 'Seul le propriétaire peut modifier le partage' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_workspace_ownership() from public, anon, authenticated;
do $$
declare t text;
begin
  foreach t in array array['tasks','contacts','shifts','canvass_reports','notes','pins'] loop
    execute format('create trigger protect_ownership before update on public.%I for each row execute function public.guard_workspace_ownership()', t);
  end loop;
  for t in select tablename from pg_tables where schemaname='public' loop
    execute format('revoke truncate, references, trigger on public.%I from anon, authenticated',t);
  end loop;
end;
$$;

-- Contrôles des liens : connaître l'UUID d'un parent ne donne aucun accès.
create or replace function public.guard_workspace_links()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user not in ('authenticated','anon') then return new; end if;
  if tg_table_name = 'shift_signups' then
    if not exists (select 1 from public.shifts s where s.id=new.shift_id and s.team_id is not distinct from new.team_id) then
      raise exception 'Créneau inaccessible ou équipe incohérente' using errcode='42501';
    end if;
  elsif tg_table_name = 'phone_contacts' then
    if not exists (select 1 from public.phone_lists l where l.id=new.list_id and l.team_id=new.team_id) then
      raise exception 'Liste inaccessible ou équipe incohérente' using errcode='42501';
    end if;
  elsif tg_table_name = 'member_roles' then
    if not exists (select 1 from public.team_roles r where r.id=new.role_id and r.team_id=new.team_id)
      or not exists (select 1 from public.profiles p where p.id=new.member_id and p.team_id=new.team_id) then
      raise exception 'Membre ou rôle hors équipe' using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_workspace_links() from public, anon, authenticated;
create trigger check_workspace_links before insert or update on public.shift_signups for each row execute function public.guard_workspace_links();
create trigger check_workspace_links before insert or update on public.phone_contacts for each row execute function public.guard_workspace_links();
create trigger check_workspace_links before insert or update on public.member_roles for each row execute function public.guard_workspace_links();

-- Une révocation d'abonnement est effective sur l'API sans attendre le prochain JWT.
create or replace function public.has_workspace_access()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select is_super_admin or
    (subscription_status='active' and (cancel_at is null or cancel_at>now())) or
    (subscription_status='trial' and trial_ends_at>now())
    from public.profiles where id=auth.uid()), false)
$$;
revoke all on function public.has_workspace_access() from public, anon;
grant execute on function public.has_workspace_access() to authenticated, service_role;
do $$
declare t text;
begin
  foreach t in array array['tasks','contacts','shifts','shift_signups','canvass_reports','notes','pins','campaigns','campaign_sectors','phone_lists','phone_contacts','team_roles','member_roles','watch_keywords'] loop
    execute format('create policy workspace_subscription on public.%I as restrictive for all to authenticated using ((select public.has_workspace_access())) with check ((select public.has_workspace_access()))',t);
  end loop;
end;
$$;

-- Sérialise les changements d'équipe, refuse les bascules silencieuses.
create or replace function public.create_team(p_name text)
returns public.teams language plpgsql security definer set search_path = '' as $$
declare t public.teams; p public.profiles;
begin
  select * into p from public.profiles where id=auth.uid() for update;
  if not found or not public.has_workspace_access() then raise exception 'Accès refusé' using errcode='42501'; end if;
  if p.team_id is not null then raise exception 'Quittez votre équipe avant d’en créer une'; end if;
  if length(trim(p_name))>120 then raise exception 'Nom trop long'; end if;
  insert into public.teams(name,created_by) values(coalesce(nullif(trim(p_name),''),'Mon équipe'),p.id) returning * into t;
  update public.profiles set team_id=t.id,role='owner' where id=p.id;
  return t;
end;
$$;
create or replace function public.join_team(p_code text)
returns public.teams language plpgsql security definer set search_path = '' as $$
declare t public.teams; p public.profiles;
begin
  select * into p from public.profiles where id=auth.uid() for update;
  if not found or not public.has_workspace_access() then raise exception 'Accès refusé' using errcode='42501'; end if;
  select * into t from public.teams where join_code=upper(trim(p_code));
  if t.id is null then raise exception 'Code d’équipe invalide'; end if;
  if p.team_id=t.id then return t; end if;
  if p.team_id is not null then raise exception 'Quittez votre équipe avant d’en rejoindre une autre'; end if;
  update public.profiles set team_id=t.id,role='member' where id=p.id;
  return t;
end;
$$;
create or replace function public.leave_team()
returns void language plpgsql security definer set search_path = '' as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id=auth.uid() for update;
  if not found then raise exception 'Authentification requise' using errcode='42501'; end if;
  if exists(select 1 from public.teams where id=p.team_id and created_by=p.id) then
    raise exception 'Le propriétaire doit transférer son équipe avant de la quitter';
  end if;
  delete from public.member_roles where member_id=p.id and team_id=p.team_id;
  update public.profiles set team_id=null,role='member' where id=p.id;
end;
$$;

create or replace function public.transfer_team(p_member uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.profiles; t public.teams;
begin
  if auth.uid() is null or p_member is null or p_member=auth.uid() then raise exception 'Membre invalide'; end if;
  perform 1 from public.profiles where id in (auth.uid(),p_member) order by id for update;
  select * into p from public.profiles where id=auth.uid();
  select * into t from public.teams where id=p.team_id for update;
  if t.created_by is distinct from auth.uid() then raise exception 'Accès refusé' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=p_member and team_id=t.id) then raise exception 'Membre hors équipe'; end if;
  update public.teams set created_by=p_member where id=t.id;
  update public.profiles set role=case when id=p_member then 'owner' else 'member' end where id in (p_member,auth.uid());
end;
$$;
revoke all on function public.transfer_team(uuid) from public,anon;
grant execute on function public.transfer_team(uuid) to authenticated;

-- L'interface réserve le plan au responsable ; la même règle s'applique à l'API.
create or replace function public.owns_current_team()
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.teams t join public.profiles p on p.team_id=t.id where p.id=auth.uid() and t.created_by=auth.uid())
$$;
revoke all on function public.owns_current_team() from public,anon;
grant execute on function public.owns_current_team() to authenticated;
do $$
declare t text;
begin
 foreach t in array array['campaigns','campaign_sectors'] loop
  execute format('create policy owner_insert on public.%I as restrictive for insert to authenticated with check ((select public.owns_current_team()))',t);
  execute format('create policy owner_update on public.%I as restrictive for update to authenticated using ((select public.owns_current_team())) with check ((select public.owns_current_team()))',t);
  execute format('create policy owner_delete on public.%I as restrictive for delete to authenticated using ((select public.owns_current_team()))',t);
 end loop;
end;
$$;
