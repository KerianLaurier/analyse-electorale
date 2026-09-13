-- Le serveur produit la révision : un client ne peut figer updated_at.
create or replace function public.bump_task_revision()
returns trigger language plpgsql set search_path='' as $$
begin
 new.updated_at := greatest(clock_timestamp(),old.updated_at + interval '1 microsecond');
 return new;
end;
$$;
revoke all on function public.bump_task_revision() from public,anon,authenticated;
create trigger task_revision before update on public.tasks for each row execute function public.bump_task_revision();
