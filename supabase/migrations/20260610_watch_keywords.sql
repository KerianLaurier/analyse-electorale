-- Mots-clés de veille presse (briefing « Suivre ») : noms d'adversaires,
-- thèmes locaux… Personnels ou partagés avec l'équipe (même modèle que notes).
-- À appliquer sur le projet Supabase MOUVANCIA (non appliqué automatiquement :
-- migration prod soumise à validation manuelle).

create table public.watch_keywords (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  keyword text not null check (char_length(trim(keyword)) between 2 and 80),
  created_at timestamptz not null default now()
);

create index watch_keywords_user_idx on public.watch_keywords (user_id);
create index watch_keywords_team_idx on public.watch_keywords (team_id);

alter table public.watch_keywords enable row level security;

-- Lecture : mes mots-clés + ceux partagés avec mon équipe.
create policy "watch_keywords_select" on public.watch_keywords
  for select using (
    user_id = (select auth.uid())
    or (team_id is not null and team_id = current_team_id())
  );

-- Insertion : pour soi, éventuellement rattaché à sa propre équipe.
create policy "watch_keywords_insert" on public.watch_keywords
  for insert with check (
    user_id = (select auth.uid())
    and (team_id is null or team_id = current_team_id())
  );

-- Suppression : par l'auteur ou tout membre de l'équipe (liste partagée).
create policy "watch_keywords_delete" on public.watch_keywords
  for delete using (
    user_id = (select auth.uid())
    or (team_id is not null and team_id = current_team_id())
  );
