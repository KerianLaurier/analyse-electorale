-- Relevé du catalogue public de MOUVANCIA, 2026-09-12. Aucune donnée utilisateur.

-- Schéma de référence avant correctifs ; ne pas appliquer sur une base existante.

-- Les schémas gérés auth/extensions doivent être provisionnés par Supabase.

create table public."pins" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "type" text not null,
  "item_id" text not null,
  "label" text not null,
  "sublabel" text,
  "href" text not null,
  "created_at" timestamptz default now() not null,
  "team_id" uuid
);

create table public."teams" (
  "id" uuid default gen_random_uuid() not null,
  "name" text not null,
  "join_code" text default upper(substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 8)) not null,
  "created_by" uuid,
  "created_at" timestamptz default now() not null
);

create table public."team_roles" (
  "id" uuid default gen_random_uuid() not null,
  "team_id" uuid not null,
  "name" text not null,
  "color" text default '#f59e0b'::text not null,
  "created_by" uuid default auth.uid() not null,
  "created_at" timestamptz default now() not null
);

create table public."member_roles" (
  "id" uuid default gen_random_uuid() not null,
  "member_id" uuid not null,
  "role_id" uuid not null,
  "team_id" uuid not null,
  "created_at" timestamptz default now() not null
);

create table public."tasks" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "team_id" uuid,
  "title" text not null,
  "details" text,
  "status" text default 'todo'::text not null,
  "priority" text default 'med'::text not null,
  "kind" text default 'autre'::text not null,
  "due_date" date,
  "assignee" uuid,
  "context_type" text,
  "context_id" text,
  "context_label" text,
  "context_href" text,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  "done_at" timestamptz
);

create table public."watch_keywords" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "team_id" uuid,
  "keyword" text not null,
  "created_at" timestamptz default now() not null
);

create table public."notes" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "team_id" uuid,
  "title" text,
  "body" text default ''::text not null,
  "context_type" text,
  "context_id" text,
  "context_label" text,
  "context_href" text,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null
);

create table public."billing_events" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "type" text not null,
  "tier" text,
  "cycle" text,
  "details" jsonb default '{}'::jsonb not null,
  "created_at" timestamptz default now() not null
);

create table public."campaigns" (
  "id" uuid default gen_random_uuid() not null,
  "team_id" uuid not null,
  "target_type" text,
  "target_id" text,
  "target_label" text,
  "target_href" text,
  "election" text,
  "registered" int4,
  "turnout_target" numeric,
  "score_target" numeric,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null
);

create table public."campaign_sectors" (
  "id" uuid default gen_random_uuid() not null,
  "team_id" uuid not null,
  "name" text not null,
  "registered" int4,
  "status" text default 'todo'::text not null,
  "contacted" int4 default 0 not null,
  "favorable" int4 default 0 not null,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  "bureau_code" text,
  "priority" int4,
  "address" text
);

create table public."stripe_events" (
  "id" text not null,
  "type" text not null,
  "created_at" timestamptz default now() not null
);

create table public."waitlist" (
  "id" uuid default gen_random_uuid() not null,
  "email" text not null,
  "source" text default 'landing'::text not null,
  "consent_at" timestamptz default now() not null,
  "created_at" timestamptz default now() not null
);

create table public."contacts" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "team_id" uuid,
  "name" text not null,
  "kind" text default 'soutien'::text not null,
  "role" text,
  "phone" text,
  "email" text,
  "support" text default 'inconnu'::text not null,
  "locality" text,
  "notes" text,
  "context_type" text,
  "context_id" text,
  "context_label" text,
  "context_href" text,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null
);

create table public."shifts" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "team_id" uuid,
  "title" text not null,
  "kind" text default 'porte'::text not null,
  "date" date not null,
  "start_time" time,
  "end_time" time,
  "location" text,
  "capacity" int4,
  "notes" text,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null
);

create table public."shift_signups" (
  "id" uuid default gen_random_uuid() not null,
  "shift_id" uuid not null,
  "user_id" uuid not null,
  "team_id" uuid,
  "created_at" timestamptz default now() not null
);

create table public."canvass_reports" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "team_id" uuid,
  "sector_id" uuid,
  "zone" text,
  "date" date default CURRENT_DATE not null,
  "volunteers" int4 default 1 not null,
  "doors" int4 default 0 not null,
  "met" int4 default 0 not null,
  "favorable" int4 default 0 not null,
  "neutral" int4 default 0 not null,
  "unfavorable" int4 default 0 not null,
  "notes" text,
  "created_at" timestamptz default now() not null,
  "channel" text default 'porte'::text not null
);

create table public."profiles" (
  "id" uuid not null,
  "email" text,
  "full_name" text,
  "organisation" text,
  "role" text default 'member'::text not null,
  "subscription_status" text default 'trial'::text not null,
  "subscription_tier" text default 'candidat'::text not null,
  "trial_ends_at" timestamptz default (now() + '14 days'::interval),
  "created_at" timestamptz default now() not null,
  "team_id" uuid,
  "is_super_admin" bool default false not null,
  "billing_cycle" text,
  "subscription_started_at" timestamptz,
  "cancel_at" timestamptz,
  "stripe_customer_id" text,
  "stripe_subscription_id" text
);

create table public."phone_lists" (
  "id" uuid default gen_random_uuid() not null,
  "team_id" uuid not null,
  "created_by" uuid default auth.uid() not null,
  "name" text not null,
  "description" text,
  "created_at" timestamptz default now() not null
);

create table public."phone_contacts" (
  "id" uuid default gen_random_uuid() not null,
  "list_id" uuid not null,
  "team_id" uuid not null,
  "name" text,
  "phone" text not null,
  "status" text default 'todo'::text not null,
  "opinion" text,
  "notes" text,
  "called_by" uuid,
  "called_at" timestamptz,
  "created_at" timestamptz default now() not null
);

alter table public."profiles" add constraint "profiles_pkey" PRIMARY KEY (id);

alter table public."pins" add constraint "pins_pkey" PRIMARY KEY (id);

alter table public."pins" add constraint "pins_user_id_type_item_id_key" UNIQUE (user_id, type, item_id);

alter table public."teams" add constraint "teams_pkey" PRIMARY KEY (id);

alter table public."teams" add constraint "teams_join_code_key" UNIQUE (join_code);

alter table public."tasks" add constraint "tasks_status_check" CHECK ((status = ANY (ARRAY['todo'::text, 'doing'::text, 'done'::text])));

alter table public."tasks" add constraint "tasks_priority_check" CHECK ((priority = ANY (ARRAY['low'::text, 'med'::text, 'high'::text])));

alter table public."tasks" add constraint "tasks_pkey" PRIMARY KEY (id);

alter table public."notes" add constraint "notes_pkey" PRIMARY KEY (id);

alter table public."campaigns" add constraint "campaigns_pkey" PRIMARY KEY (id);

alter table public."campaigns" add constraint "campaigns_team_id_key" UNIQUE (team_id);

alter table public."campaign_sectors" add constraint "campaign_sectors_status_check" CHECK ((status = ANY (ARRAY['todo'::text, 'doing'::text, 'done'::text])));

alter table public."campaign_sectors" add constraint "campaign_sectors_pkey" PRIMARY KEY (id);

alter table public."contacts" add constraint "contacts_kind_check" CHECK ((kind = ANY (ARRAY['benevole'::text, 'soutien'::text, 'electeur'::text, 'presse'::text, 'elu'::text, 'partenaire'::text, 'autre'::text])));

alter table public."contacts" add constraint "contacts_support_check" CHECK ((support = ANY (ARRAY['favorable'::text, 'indecis'::text, 'oppose'::text, 'inconnu'::text])));

alter table public."contacts" add constraint "contacts_pkey" PRIMARY KEY (id);

alter table public."shifts" add constraint "shifts_kind_check" CHECK ((kind = ANY (ARRAY['porte'::text, 'boitage'::text, 'collage'::text, 'tractage'::text, 'permanence'::text, 'reunion'::text, 'autre'::text])));

alter table public."shifts" add constraint "shifts_pkey" PRIMARY KEY (id);

alter table public."shift_signups" add constraint "shift_signups_pkey" PRIMARY KEY (id);

alter table public."shift_signups" add constraint "shift_signups_shift_id_user_id_key" UNIQUE (shift_id, user_id);

alter table public."tasks" add constraint "tasks_kind_check" CHECK ((kind = ANY (ARRAY['communication'::text, 'logistique'::text, 'demarche'::text, 'mobilisation'::text, 'autre'::text])));

alter table public."canvass_reports" add constraint "canvass_reports_pkey" PRIMARY KEY (id);

alter table public."phone_lists" add constraint "phone_lists_pkey" PRIMARY KEY (id);

alter table public."phone_contacts" add constraint "phone_contacts_status_check" CHECK ((status = ANY (ARRAY['todo'::text, 'joint'::text, 'repondeur'::text, 'occupe'::text, 'faux'::text, 'refus'::text, 'rappeler'::text])));

alter table public."phone_contacts" add constraint "phone_contacts_opinion_check" CHECK ((opinion = ANY (ARRAY['favorable'::text, 'neutre'::text, 'defavorable'::text])));

alter table public."phone_contacts" add constraint "phone_contacts_pkey" PRIMARY KEY (id);

alter table public."team_roles" add constraint "team_roles_pkey" PRIMARY KEY (id);

alter table public."member_roles" add constraint "member_roles_pkey" PRIMARY KEY (id);

alter table public."member_roles" add constraint "member_roles_member_id_role_id_key" UNIQUE (member_id, role_id);

alter table public."watch_keywords" add constraint "watch_keywords_keyword_check" CHECK (((char_length(TRIM(BOTH FROM keyword)) >= 2) AND (char_length(TRIM(BOTH FROM keyword)) <= 80)));

alter table public."watch_keywords" add constraint "watch_keywords_pkey" PRIMARY KEY (id);

alter table public."profiles" add constraint "profiles_billing_cycle_check" CHECK ((billing_cycle = ANY (ARRAY['monthly'::text, 'yearly'::text])));

alter table public."billing_events" add constraint "billing_events_pkey" PRIMARY KEY (id);

alter table public."stripe_events" add constraint "stripe_events_pkey" PRIMARY KEY (id);

alter table public."billing_events" add constraint "billing_events_type_check" CHECK ((type = ANY (ARRAY['subscribe'::text, 'change_plan'::text, 'change_cycle'::text, 'resume'::text, 'cancel'::text, 'admin_set'::text, 'renewal'::text, 'payment_failed'::text])));

alter table public."canvass_reports" add constraint "canvass_reports_channel_check" CHECK ((channel = ANY (ARRAY['porte'::text, 'phone'::text, 'affiche'::text])));

alter table public."waitlist" add constraint "waitlist_email_lowercase" CHECK ((email = lower(email)));

alter table public."waitlist" add constraint "waitlist_pkey" PRIMARY KEY (id);

alter table public."waitlist" add constraint "waitlist_email_key" UNIQUE (email);

alter table public."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public."pins" add constraint "pins_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public."teams" add constraint "teams_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table public."profiles" add constraint "profiles_team_id_fkey" FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;

alter table public."pins" add constraint "pins_team_id_fkey" FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;

alter table public."tasks" add constraint "tasks_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public."tasks" add constraint "tasks_team_id_fkey" FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;

alter table public."tasks" add constraint "tasks_assignee_fkey" FOREIGN KEY (assignee) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table public."notes" add constraint "notes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public."notes" add constraint "notes_team_id_fkey" FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;

alter table public."campaigns" add constraint "campaigns_team_id_fkey" FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;

alter table public."campaign_sectors" add constraint "campaign_sectors_team_id_fkey" FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;

alter table public."contacts" add constraint "contacts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public."contacts" add constraint "contacts_team_id_fkey" FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;

alter table public."shifts" add constraint "shifts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public."shifts" add constraint "shifts_team_id_fkey" FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;

alter table public."shift_signups" add constraint "shift_signups_shift_id_fkey" FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE;

alter table public."shift_signups" add constraint "shift_signups_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public."shift_signups" add constraint "shift_signups_team_id_fkey" FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;

alter table public."canvass_reports" add constraint "canvass_reports_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public."canvass_reports" add constraint "canvass_reports_team_id_fkey" FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;

alter table public."canvass_reports" add constraint "canvass_reports_sector_id_fkey" FOREIGN KEY (sector_id) REFERENCES campaign_sectors(id) ON DELETE SET NULL;

alter table public."phone_lists" add constraint "phone_lists_team_id_fkey" FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;

alter table public."phone_contacts" add constraint "phone_contacts_list_id_fkey" FOREIGN KEY (list_id) REFERENCES phone_lists(id) ON DELETE CASCADE;

alter table public."phone_contacts" add constraint "phone_contacts_team_id_fkey" FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;

alter table public."team_roles" add constraint "team_roles_team_id_fkey" FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;

alter table public."member_roles" add constraint "member_roles_member_id_fkey" FOREIGN KEY (member_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table public."member_roles" add constraint "member_roles_role_id_fkey" FOREIGN KEY (role_id) REFERENCES team_roles(id) ON DELETE CASCADE;

alter table public."member_roles" add constraint "member_roles_team_id_fkey" FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;

alter table public."watch_keywords" add constraint "watch_keywords_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public."watch_keywords" add constraint "watch_keywords_team_id_fkey" FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;

alter table public."billing_events" add constraint "billing_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

CREATE INDEX pins_user_created_idx ON public.pins USING btree (user_id, created_at DESC);

CREATE INDEX pins_team_idx ON public.pins USING btree (team_id);

CREATE INDEX team_roles_team_idx ON public.team_roles USING btree (team_id);

CREATE INDEX member_roles_team_idx ON public.member_roles USING btree (team_id);

CREATE INDEX member_roles_member_idx ON public.member_roles USING btree (member_id);

CREATE INDEX tasks_team_idx ON public.tasks USING btree (team_id);

CREATE INDEX tasks_user_idx ON public.tasks USING btree (user_id);

CREATE INDEX tasks_assignee_idx ON public.tasks USING btree (assignee);

CREATE INDEX watch_keywords_user_idx ON public.watch_keywords USING btree (user_id);

CREATE INDEX watch_keywords_team_idx ON public.watch_keywords USING btree (team_id);

CREATE INDEX notes_team_idx ON public.notes USING btree (team_id);

CREATE INDEX notes_user_idx ON public.notes USING btree (user_id);

CREATE INDEX billing_events_user_idx ON public.billing_events USING btree (user_id, created_at DESC);

CREATE INDEX billing_events_created_idx ON public.billing_events USING btree (created_at DESC);

CREATE INDEX campaign_sectors_team_idx ON public.campaign_sectors USING btree (team_id);

CREATE INDEX waitlist_created_at_idx ON public.waitlist USING btree (created_at DESC);

CREATE INDEX contacts_team_idx ON public.contacts USING btree (team_id);

CREATE INDEX contacts_user_idx ON public.contacts USING btree (user_id);

CREATE INDEX shifts_team_idx ON public.shifts USING btree (team_id);

CREATE INDEX shifts_date_idx ON public.shifts USING btree (date);

CREATE INDEX shift_signups_shift_idx ON public.shift_signups USING btree (shift_id);

CREATE INDEX canvass_team_idx ON public.canvass_reports USING btree (team_id);

CREATE INDEX canvass_sector_idx ON public.canvass_reports USING btree (sector_id);

CREATE INDEX profiles_team_idx ON public.profiles USING btree (team_id);

CREATE UNIQUE INDEX profiles_stripe_customer_uidx ON public.profiles USING btree (stripe_customer_id) WHERE (stripe_customer_id IS NOT NULL);

CREATE INDEX phone_contacts_list_idx ON public.phone_contacts USING btree (list_id);

CREATE INDEX phone_contacts_team_idx ON public.phone_contacts USING btree (team_id);

CREATE OR REPLACE FUNCTION public.is_super_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select is_super_admin from public.profiles where id = auth.uid()), false);
$function$
;

CREATE OR REPLACE FUNCTION public.admin_set_super_admin(p_user uuid, p_value boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_super_admin() then raise exception 'Acces refuse' using errcode = '42501'; end if;
  if p_user = auth.uid() and p_value = false then
    raise exception 'Vous ne pouvez pas retirer votre propre acces super-admin';
  end if;
  update public.profiles set is_super_admin = p_value where id = p_user;
end; $function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, email, full_name, organisation)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'organisation', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.current_team_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select team_id from public.profiles where id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.create_team(p_name text)
 RETURNS teams
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare t public.teams;
begin
  insert into public.teams(name, created_by)
  values (coalesce(nullif(trim(p_name), ''), 'Mon équipe'), auth.uid())
  returning * into t;
  update public.profiles set team_id = t.id, role = 'owner' where id = auth.uid();
  return t;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.join_team(p_code text)
 RETURNS teams
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare t public.teams;
begin
  select * into t from public.teams where join_code = upper(trim(p_code));
  if t.id is null then
    raise exception 'Code d''équipe invalide' using errcode = 'no_data_found';
  end if;
  update public.profiles set team_id = t.id, role = 'member' where id = auth.uid();
  return t;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.leave_team()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.profiles set team_id = null, role = 'member' where id = auth.uid();
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_create_account(p_email text, p_password text, p_full_name text, p_organisation text, p_status text, p_tier text, p_trial_ends_at timestamp with time zone, p_super boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  new_id uuid := gen_random_uuid();
  norm_email text := lower(trim(p_email));
begin
  if not public.is_super_admin() then raise exception 'Acces refuse' using errcode = '42501'; end if;
  if norm_email is null or position('@' in norm_email) = 0 then raise exception 'E-mail invalide'; end if;
  if p_password is null or length(p_password) < 8 then raise exception 'Mot de passe trop court (8 caracteres min)'; end if;
  if p_status not in ('trial', 'active', 'inactive') then raise exception 'Statut invalide'; end if;
  if p_tier not in ('candidat', 'equipe', 'parti') then raise exception 'Formule invalide'; end if;
  if exists (select 1 from auth.users where email = norm_email) then
    raise exception 'Un compte existe deja pour cet e-mail';
  end if;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    new_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    norm_email, extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name, 'organisation', p_organisation),
    now(), now(), '', '', '', '', '', '', '', ''
  );

  -- handle_new_user a créé le profil → on applique les réglages admin.
  insert into public.profiles (id, email, full_name, organisation, role, subscription_status, subscription_tier, trial_ends_at, is_super_admin)
  values (new_id, norm_email, p_full_name, p_organisation, 'member', p_status, p_tier, p_trial_ends_at, coalesce(p_super, false))
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    organisation = excluded.organisation,
    subscription_status = excluded.subscription_status,
    subscription_tier = excluded.subscription_tier,
    trial_ends_at = excluded.trial_ends_at,
    is_super_admin = excluded.is_super_admin;

  return new_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.billing_price_eur(p_tier text, p_cycle text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when p_tier = 'candidat' and p_cycle = 'monthly' then 49
    when p_tier = 'candidat' and p_cycle = 'yearly'  then 490
    when p_tier = 'equipe'   and p_cycle = 'monthly' then 199
    when p_tier = 'equipe'   and p_cycle = 'yearly'  then 1990
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.self_set_plan(p_tier text, p_cycle text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid := (select auth.uid());
  prof record;
  v_type text;
  v_amount integer;
begin
  if v_user is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;
  if p_tier not in ('candidat', 'equipe') then
    raise exception 'Formule invalide (self-service : candidat ou equipe)';
  end if;
  if p_cycle not in ('monthly', 'yearly') then
    raise exception 'Cycle invalide (monthly ou yearly)';
  end if;

  select subscription_status, subscription_tier, billing_cycle, cancel_at
    into prof
  from public.profiles
  where id = v_user
  for update;

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
$function$
;

CREATE OR REPLACE FUNCTION public.self_cancel()
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.self_resume()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.admin_set_subscription(p_user uuid, p_status text, p_tier text, p_trial_ends_at timestamp with time zone, p_billing_cycle text DEFAULT NULL::text, p_cancel_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_super_admin() then raise exception 'Acces refuse' using errcode = '42501'; end if;
  if p_status not in ('trial', 'active', 'inactive') then raise exception 'Statut invalide'; end if;
  if p_tier not in ('candidat', 'equipe', 'parti') then raise exception 'Formule invalide'; end if;
  if p_billing_cycle is not null and p_billing_cycle not in ('monthly', 'yearly') then
    raise exception 'Cycle invalide';
  end if;

  update public.profiles
     set subscription_status = p_status,
         subscription_tier = p_tier,
         trial_ends_at = p_trial_ends_at,
         billing_cycle = coalesce(p_billing_cycle, billing_cycle),
         cancel_at = p_cancel_at,
         subscription_started_at = case
           when p_status = 'active' then coalesce(subscription_started_at, now())
           else subscription_started_at
         end
   where id = p_user;

  insert into public.billing_events (user_id, type, tier, cycle, details)
  values (
    p_user, 'admin_set', p_tier, p_billing_cycle,
    jsonb_build_object(
      'status', p_status,
      'trial_ends_at', p_trial_ends_at,
      'cancel_at', p_cancel_at,
      'by', (select auth.uid())
    )
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare
  claims jsonb;
  prof record;
begin
  claims := coalesce(event -> 'claims', '{}'::jsonb);

  if not (claims ? 'app_metadata') then
    claims := jsonb_set(claims, '{app_metadata}', '{}'::jsonb);
  end if;

  select subscription_status, trial_ends_at, cancel_at, is_super_admin
    into prof
  from public.profiles
  where id = (event ->> 'user_id')::uuid;

  if found then
    -- jsonb_build_object encode un NULL en JSON `null` (jamais SQL NULL),
    -- contrairement à to_jsonb(NULL) + jsonb_set (strict).
    claims := jsonb_set(
      claims,
      '{app_metadata}',
      coalesce(claims -> 'app_metadata', '{}'::jsonb) || jsonb_build_object(
        'subscription_status', prof.subscription_status,
        'trial_ends_at', prof.trial_ends_at,
        'cancel_at', prof.cancel_at,
        'is_super_admin', coalesce(prof.is_super_admin, false)
      )
    );
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$function$
;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

alter table public."pins" enable row level security;

alter table public."teams" enable row level security;

alter table public."team_roles" enable row level security;

alter table public."member_roles" enable row level security;

alter table public."tasks" enable row level security;

alter table public."watch_keywords" enable row level security;

alter table public."notes" enable row level security;

alter table public."billing_events" enable row level security;

alter table public."campaigns" enable row level security;

alter table public."campaign_sectors" enable row level security;

alter table public."stripe_events" enable row level security;

alter table public."waitlist" enable row level security;

alter table public."contacts" enable row level security;

alter table public."shifts" enable row level security;

alter table public."shift_signups" enable row level security;

alter table public."canvass_reports" enable row level security;

alter table public."profiles" enable row level security;

alter table public."phone_lists" enable row level security;

alter table public."phone_contacts" enable row level security;

create policy "tasks_select" on public."tasks" as PERMISSIVE for SELECT to "public" using (((user_id = auth.uid()) OR ((team_id IS NOT NULL) AND (team_id = current_team_id()))));

create policy "tasks_insert" on public."tasks" as PERMISSIVE for INSERT to "public" with check (((user_id = auth.uid()) AND ((team_id IS NULL) OR (team_id = current_team_id()))));

create policy "tasks_update" on public."tasks" as PERMISSIVE for UPDATE to "public" using (((user_id = auth.uid()) OR ((team_id IS NOT NULL) AND (team_id = current_team_id())))) with check (((team_id IS NULL) OR (team_id = current_team_id())));

create policy "tasks_delete" on public."tasks" as PERMISSIVE for DELETE to "public" using ((user_id = auth.uid()));

create policy "notes_select" on public."notes" as PERMISSIVE for SELECT to "public" using (((user_id = auth.uid()) OR ((team_id IS NOT NULL) AND (team_id = current_team_id()))));

create policy "notes_insert" on public."notes" as PERMISSIVE for INSERT to "public" with check (((user_id = auth.uid()) AND ((team_id IS NULL) OR (team_id = current_team_id()))));

create policy "campaigns_team_select" on public."campaigns" as PERMISSIVE for SELECT to "public" using ((team_id = current_team_id()));

create policy "campaigns_team_insert" on public."campaigns" as PERMISSIVE for INSERT to "public" with check ((team_id = current_team_id()));

create policy "shifts_delete" on public."shifts" as PERMISSIVE for DELETE to "public" using ((user_id = auth.uid()));

create policy "profiles_self_select" on public."profiles" as PERMISSIVE for SELECT to "public" using ((auth.uid() = id));

create policy "profiles_self_update" on public."profiles" as PERMISSIVE for UPDATE to "public" using ((auth.uid() = id)) with check ((auth.uid() = id));

create policy "teams_member_select" on public."teams" as PERMISSIVE for SELECT to "public" using ((id = current_team_id()));

create policy "profiles_team_select" on public."profiles" as PERMISSIVE for SELECT to "public" using (((team_id IS NOT NULL) AND (team_id = current_team_id())));

create policy "pins_select" on public."pins" as PERMISSIVE for SELECT to "public" using (((user_id = auth.uid()) OR ((team_id IS NOT NULL) AND (team_id = current_team_id()))));

create policy "pins_insert" on public."pins" as PERMISSIVE for INSERT to "public" with check (((user_id = auth.uid()) AND ((team_id IS NULL) OR (team_id = current_team_id()))));

create policy "pins_update" on public."pins" as PERMISSIVE for UPDATE to "public" using ((user_id = auth.uid())) with check (((user_id = auth.uid()) AND ((team_id IS NULL) OR (team_id = current_team_id()))));

create policy "pins_delete" on public."pins" as PERMISSIVE for DELETE to "public" using ((user_id = auth.uid()));

create policy "notes_update" on public."notes" as PERMISSIVE for UPDATE to "public" using ((user_id = auth.uid())) with check (((user_id = auth.uid()) AND ((team_id IS NULL) OR (team_id = current_team_id()))));

create policy "notes_delete" on public."notes" as PERMISSIVE for DELETE to "public" using ((user_id = auth.uid()));

create policy "campaigns_team_update" on public."campaigns" as PERMISSIVE for UPDATE to "public" using ((team_id = current_team_id())) with check ((team_id = current_team_id()));

create policy "campaigns_team_delete" on public."campaigns" as PERMISSIVE for DELETE to "public" using ((team_id = current_team_id()));

create policy "sectors_team_select" on public."campaign_sectors" as PERMISSIVE for SELECT to "public" using ((team_id = current_team_id()));

create policy "sectors_team_insert" on public."campaign_sectors" as PERMISSIVE for INSERT to "public" with check ((team_id = current_team_id()));

create policy "sectors_team_update" on public."campaign_sectors" as PERMISSIVE for UPDATE to "public" using ((team_id = current_team_id())) with check ((team_id = current_team_id()));

create policy "sectors_team_delete" on public."campaign_sectors" as PERMISSIVE for DELETE to "public" using ((team_id = current_team_id()));

create policy "contacts_select" on public."contacts" as PERMISSIVE for SELECT to "public" using (((user_id = auth.uid()) OR ((team_id IS NOT NULL) AND (team_id = current_team_id()))));

create policy "contacts_insert" on public."contacts" as PERMISSIVE for INSERT to "public" with check (((user_id = auth.uid()) AND ((team_id IS NULL) OR (team_id = current_team_id()))));

create policy "contacts_update" on public."contacts" as PERMISSIVE for UPDATE to "public" using (((user_id = auth.uid()) OR ((team_id IS NOT NULL) AND (team_id = current_team_id())))) with check (((team_id IS NULL) OR (team_id = current_team_id())));

create policy "contacts_delete" on public."contacts" as PERMISSIVE for DELETE to "public" using ((user_id = auth.uid()));

create policy "shifts_select" on public."shifts" as PERMISSIVE for SELECT to "public" using (((user_id = auth.uid()) OR ((team_id IS NOT NULL) AND (team_id = current_team_id()))));

create policy "shifts_insert" on public."shifts" as PERMISSIVE for INSERT to "public" with check (((user_id = auth.uid()) AND ((team_id IS NULL) OR (team_id = current_team_id()))));

create policy "shifts_update" on public."shifts" as PERMISSIVE for UPDATE to "public" using (((user_id = auth.uid()) OR ((team_id IS NOT NULL) AND (team_id = current_team_id())))) with check (((team_id IS NULL) OR (team_id = current_team_id())));

create policy "signups_select" on public."shift_signups" as PERMISSIVE for SELECT to "public" using (((user_id = auth.uid()) OR ((team_id IS NOT NULL) AND (team_id = current_team_id()))));

create policy "signups_insert" on public."shift_signups" as PERMISSIVE for INSERT to "public" with check (((user_id = auth.uid()) AND ((team_id IS NULL) OR (team_id = current_team_id()))));

create policy "signups_delete" on public."shift_signups" as PERMISSIVE for DELETE to "public" using ((user_id = auth.uid()));

create policy "profiles_superadmin_select" on public."profiles" as PERMISSIVE for SELECT to "public" using (is_super_admin());

create policy "teams_superadmin_select" on public."teams" as PERMISSIVE for SELECT to "public" using (is_super_admin());

create policy "canvass_select" on public."canvass_reports" as PERMISSIVE for SELECT to "public" using (((user_id = auth.uid()) OR ((team_id IS NOT NULL) AND (team_id = current_team_id()))));

create policy "canvass_insert" on public."canvass_reports" as PERMISSIVE for INSERT to "public" with check (((user_id = auth.uid()) AND ((team_id IS NULL) OR (team_id = current_team_id()))));

create policy "canvass_update" on public."canvass_reports" as PERMISSIVE for UPDATE to "public" using (((user_id = auth.uid()) OR ((team_id IS NOT NULL) AND (team_id = current_team_id())))) with check (((team_id IS NULL) OR (team_id = current_team_id())));

create policy "canvass_delete" on public."canvass_reports" as PERMISSIVE for DELETE to "public" using ((user_id = auth.uid()));

create policy "phone_lists_select" on public."phone_lists" as PERMISSIVE for SELECT to "public" using ((team_id = current_team_id()));

create policy "phone_lists_insert" on public."phone_lists" as PERMISSIVE for INSERT to "public" with check (((created_by = auth.uid()) AND (team_id = current_team_id())));

create policy "phone_lists_update" on public."phone_lists" as PERMISSIVE for UPDATE to "public" using ((team_id = current_team_id())) with check ((team_id = current_team_id()));

create policy "phone_lists_delete" on public."phone_lists" as PERMISSIVE for DELETE to "public" using ((created_by = auth.uid()));

create policy "phone_contacts_select" on public."phone_contacts" as PERMISSIVE for SELECT to "public" using ((team_id = current_team_id()));

create policy "phone_contacts_insert" on public."phone_contacts" as PERMISSIVE for INSERT to "public" with check ((team_id = current_team_id()));

create policy "phone_contacts_update" on public."phone_contacts" as PERMISSIVE for UPDATE to "public" using ((team_id = current_team_id())) with check ((team_id = current_team_id()));

create policy "phone_contacts_delete" on public."phone_contacts" as PERMISSIVE for DELETE to "public" using ((team_id = current_team_id()));

create policy "team_roles_select" on public."team_roles" as PERMISSIVE for SELECT to "public" using ((team_id = current_team_id()));

create policy "team_roles_insert" on public."team_roles" as PERMISSIVE for INSERT to "public" with check ((team_id IN ( SELECT teams.id
   FROM teams
  WHERE (teams.created_by = auth.uid()))));

create policy "team_roles_update" on public."team_roles" as PERMISSIVE for UPDATE to "public" using ((team_id IN ( SELECT teams.id
   FROM teams
  WHERE (teams.created_by = auth.uid())))) with check ((team_id IN ( SELECT teams.id
   FROM teams
  WHERE (teams.created_by = auth.uid()))));

create policy "team_roles_delete" on public."team_roles" as PERMISSIVE for DELETE to "public" using ((team_id IN ( SELECT teams.id
   FROM teams
  WHERE (teams.created_by = auth.uid()))));

create policy "member_roles_select" on public."member_roles" as PERMISSIVE for SELECT to "public" using ((team_id = current_team_id()));

create policy "member_roles_insert" on public."member_roles" as PERMISSIVE for INSERT to "public" with check ((team_id IN ( SELECT teams.id
   FROM teams
  WHERE (teams.created_by = auth.uid()))));

create policy "member_roles_delete" on public."member_roles" as PERMISSIVE for DELETE to "public" using ((team_id IN ( SELECT teams.id
   FROM teams
  WHERE (teams.created_by = auth.uid()))));

create policy "watch_keywords_select" on public."watch_keywords" as PERMISSIVE for SELECT to "public" using (((user_id = ( SELECT auth.uid() AS uid)) OR ((team_id IS NOT NULL) AND (team_id = current_team_id()))));

create policy "watch_keywords_insert" on public."watch_keywords" as PERMISSIVE for INSERT to "public" with check (((user_id = ( SELECT auth.uid() AS uid)) AND ((team_id IS NULL) OR (team_id = current_team_id()))));

create policy "watch_keywords_delete" on public."watch_keywords" as PERMISSIVE for DELETE to "public" using (((user_id = ( SELECT auth.uid() AS uid)) OR ((team_id IS NOT NULL) AND (team_id = current_team_id()))));

create policy "profiles_auth_admin_read" on public."profiles" as PERMISSIVE for SELECT to "supabase_auth_admin" using (true);

create policy "billing_events_self_or_admin_select" on public."billing_events" as PERMISSIVE for SELECT to "authenticated" using (((user_id = ( SELECT auth.uid() AS uid)) OR is_super_admin()));

grant INSERT on public."pins" to "authenticated";

grant SELECT on public."pins" to "authenticated";

grant UPDATE on public."pins" to "authenticated";

grant DELETE on public."pins" to "authenticated";

grant TRUNCATE on public."pins" to "authenticated";

grant REFERENCES on public."pins" to "authenticated";

grant TRIGGER on public."pins" to "authenticated";

grant INSERT on public."pins" to "service_role";

grant SELECT on public."pins" to "service_role";

grant UPDATE on public."pins" to "service_role";

grant DELETE on public."pins" to "service_role";

grant TRUNCATE on public."pins" to "service_role";

grant REFERENCES on public."pins" to "service_role";

grant TRIGGER on public."pins" to "service_role";

grant INSERT on public."teams" to "authenticated";

grant SELECT on public."teams" to "authenticated";

grant UPDATE on public."teams" to "authenticated";

grant DELETE on public."teams" to "authenticated";

grant TRUNCATE on public."teams" to "authenticated";

grant REFERENCES on public."teams" to "authenticated";

grant TRIGGER on public."teams" to "authenticated";

grant INSERT on public."teams" to "service_role";

grant SELECT on public."teams" to "service_role";

grant UPDATE on public."teams" to "service_role";

grant DELETE on public."teams" to "service_role";

grant TRUNCATE on public."teams" to "service_role";

grant REFERENCES on public."teams" to "service_role";

grant TRIGGER on public."teams" to "service_role";

grant INSERT on public."team_roles" to "authenticated";

grant SELECT on public."team_roles" to "authenticated";

grant UPDATE on public."team_roles" to "authenticated";

grant DELETE on public."team_roles" to "authenticated";

grant TRUNCATE on public."team_roles" to "authenticated";

grant REFERENCES on public."team_roles" to "authenticated";

grant TRIGGER on public."team_roles" to "authenticated";

grant INSERT on public."team_roles" to "service_role";

grant SELECT on public."team_roles" to "service_role";

grant UPDATE on public."team_roles" to "service_role";

grant DELETE on public."team_roles" to "service_role";

grant TRUNCATE on public."team_roles" to "service_role";

grant REFERENCES on public."team_roles" to "service_role";

grant TRIGGER on public."team_roles" to "service_role";

grant INSERT on public."member_roles" to "authenticated";

grant SELECT on public."member_roles" to "authenticated";

grant UPDATE on public."member_roles" to "authenticated";

grant DELETE on public."member_roles" to "authenticated";

grant TRUNCATE on public."member_roles" to "authenticated";

grant REFERENCES on public."member_roles" to "authenticated";

grant TRIGGER on public."member_roles" to "authenticated";

grant INSERT on public."member_roles" to "service_role";

grant SELECT on public."member_roles" to "service_role";

grant UPDATE on public."member_roles" to "service_role";

grant DELETE on public."member_roles" to "service_role";

grant TRUNCATE on public."member_roles" to "service_role";

grant REFERENCES on public."member_roles" to "service_role";

grant TRIGGER on public."member_roles" to "service_role";

grant INSERT on public."tasks" to "authenticated";

grant SELECT on public."tasks" to "authenticated";

grant UPDATE on public."tasks" to "authenticated";

grant DELETE on public."tasks" to "authenticated";

grant TRUNCATE on public."tasks" to "authenticated";

grant REFERENCES on public."tasks" to "authenticated";

grant TRIGGER on public."tasks" to "authenticated";

grant INSERT on public."tasks" to "service_role";

grant SELECT on public."tasks" to "service_role";

grant UPDATE on public."tasks" to "service_role";

grant DELETE on public."tasks" to "service_role";

grant TRUNCATE on public."tasks" to "service_role";

grant REFERENCES on public."tasks" to "service_role";

grant TRIGGER on public."tasks" to "service_role";

grant INSERT on public."watch_keywords" to "authenticated";

grant SELECT on public."watch_keywords" to "authenticated";

grant UPDATE on public."watch_keywords" to "authenticated";

grant DELETE on public."watch_keywords" to "authenticated";

grant TRUNCATE on public."watch_keywords" to "authenticated";

grant REFERENCES on public."watch_keywords" to "authenticated";

grant TRIGGER on public."watch_keywords" to "authenticated";

grant INSERT on public."watch_keywords" to "service_role";

grant SELECT on public."watch_keywords" to "service_role";

grant UPDATE on public."watch_keywords" to "service_role";

grant DELETE on public."watch_keywords" to "service_role";

grant TRUNCATE on public."watch_keywords" to "service_role";

grant REFERENCES on public."watch_keywords" to "service_role";

grant TRIGGER on public."watch_keywords" to "service_role";

grant INSERT on public."notes" to "authenticated";

grant SELECT on public."notes" to "authenticated";

grant UPDATE on public."notes" to "authenticated";

grant DELETE on public."notes" to "authenticated";

grant TRUNCATE on public."notes" to "authenticated";

grant REFERENCES on public."notes" to "authenticated";

grant TRIGGER on public."notes" to "authenticated";

grant INSERT on public."notes" to "service_role";

grant SELECT on public."notes" to "service_role";

grant UPDATE on public."notes" to "service_role";

grant DELETE on public."notes" to "service_role";

grant TRUNCATE on public."notes" to "service_role";

grant REFERENCES on public."notes" to "service_role";

grant TRIGGER on public."notes" to "service_role";

grant INSERT on public."billing_events" to "service_role";

grant SELECT on public."billing_events" to "service_role";

grant UPDATE on public."billing_events" to "service_role";

grant DELETE on public."billing_events" to "service_role";

grant TRUNCATE on public."billing_events" to "service_role";

grant REFERENCES on public."billing_events" to "service_role";

grant TRIGGER on public."billing_events" to "service_role";

grant SELECT on public."billing_events" to "authenticated";

grant INSERT on public."campaigns" to "authenticated";

grant SELECT on public."campaigns" to "authenticated";

grant UPDATE on public."campaigns" to "authenticated";

grant DELETE on public."campaigns" to "authenticated";

grant TRUNCATE on public."campaigns" to "authenticated";

grant REFERENCES on public."campaigns" to "authenticated";

grant TRIGGER on public."campaigns" to "authenticated";

grant INSERT on public."campaigns" to "service_role";

grant SELECT on public."campaigns" to "service_role";

grant UPDATE on public."campaigns" to "service_role";

grant DELETE on public."campaigns" to "service_role";

grant TRUNCATE on public."campaigns" to "service_role";

grant REFERENCES on public."campaigns" to "service_role";

grant TRIGGER on public."campaigns" to "service_role";

grant INSERT on public."campaign_sectors" to "authenticated";

grant SELECT on public."campaign_sectors" to "authenticated";

grant UPDATE on public."campaign_sectors" to "authenticated";

grant DELETE on public."campaign_sectors" to "authenticated";

grant TRUNCATE on public."campaign_sectors" to "authenticated";

grant REFERENCES on public."campaign_sectors" to "authenticated";

grant TRIGGER on public."campaign_sectors" to "authenticated";

grant INSERT on public."campaign_sectors" to "service_role";

grant SELECT on public."campaign_sectors" to "service_role";

grant UPDATE on public."campaign_sectors" to "service_role";

grant DELETE on public."campaign_sectors" to "service_role";

grant TRUNCATE on public."campaign_sectors" to "service_role";

grant REFERENCES on public."campaign_sectors" to "service_role";

grant TRIGGER on public."campaign_sectors" to "service_role";

grant INSERT on public."stripe_events" to "service_role";

grant SELECT on public."stripe_events" to "service_role";

grant UPDATE on public."stripe_events" to "service_role";

grant DELETE on public."stripe_events" to "service_role";

grant TRUNCATE on public."stripe_events" to "service_role";

grant REFERENCES on public."stripe_events" to "service_role";

grant TRIGGER on public."stripe_events" to "service_role";

grant INSERT on public."waitlist" to "authenticated";

grant SELECT on public."waitlist" to "authenticated";

grant UPDATE on public."waitlist" to "authenticated";

grant DELETE on public."waitlist" to "authenticated";

grant TRUNCATE on public."waitlist" to "authenticated";

grant REFERENCES on public."waitlist" to "authenticated";

grant TRIGGER on public."waitlist" to "authenticated";

grant INSERT on public."waitlist" to "service_role";

grant SELECT on public."waitlist" to "service_role";

grant UPDATE on public."waitlist" to "service_role";

grant DELETE on public."waitlist" to "service_role";

grant TRUNCATE on public."waitlist" to "service_role";

grant REFERENCES on public."waitlist" to "service_role";

grant TRIGGER on public."waitlist" to "service_role";

grant INSERT on public."contacts" to "authenticated";

grant SELECT on public."contacts" to "authenticated";

grant UPDATE on public."contacts" to "authenticated";

grant DELETE on public."contacts" to "authenticated";

grant TRUNCATE on public."contacts" to "authenticated";

grant REFERENCES on public."contacts" to "authenticated";

grant TRIGGER on public."contacts" to "authenticated";

grant INSERT on public."contacts" to "service_role";

grant SELECT on public."contacts" to "service_role";

grant UPDATE on public."contacts" to "service_role";

grant DELETE on public."contacts" to "service_role";

grant TRUNCATE on public."contacts" to "service_role";

grant REFERENCES on public."contacts" to "service_role";

grant TRIGGER on public."contacts" to "service_role";

grant INSERT on public."shifts" to "authenticated";

grant SELECT on public."shifts" to "authenticated";

grant UPDATE on public."shifts" to "authenticated";

grant DELETE on public."shifts" to "authenticated";

grant TRUNCATE on public."shifts" to "authenticated";

grant REFERENCES on public."shifts" to "authenticated";

grant TRIGGER on public."shifts" to "authenticated";

grant INSERT on public."shifts" to "service_role";

grant SELECT on public."shifts" to "service_role";

grant UPDATE on public."shifts" to "service_role";

grant DELETE on public."shifts" to "service_role";

grant TRUNCATE on public."shifts" to "service_role";

grant REFERENCES on public."shifts" to "service_role";

grant TRIGGER on public."shifts" to "service_role";

grant INSERT on public."shift_signups" to "authenticated";

grant SELECT on public."shift_signups" to "authenticated";

grant UPDATE on public."shift_signups" to "authenticated";

grant DELETE on public."shift_signups" to "authenticated";

grant TRUNCATE on public."shift_signups" to "authenticated";

grant REFERENCES on public."shift_signups" to "authenticated";

grant TRIGGER on public."shift_signups" to "authenticated";

grant INSERT on public."shift_signups" to "service_role";

grant SELECT on public."shift_signups" to "service_role";

grant UPDATE on public."shift_signups" to "service_role";

grant DELETE on public."shift_signups" to "service_role";

grant TRUNCATE on public."shift_signups" to "service_role";

grant REFERENCES on public."shift_signups" to "service_role";

grant TRIGGER on public."shift_signups" to "service_role";

grant INSERT on public."canvass_reports" to "authenticated";

grant SELECT on public."canvass_reports" to "authenticated";

grant UPDATE on public."canvass_reports" to "authenticated";

grant DELETE on public."canvass_reports" to "authenticated";

grant TRUNCATE on public."canvass_reports" to "authenticated";

grant REFERENCES on public."canvass_reports" to "authenticated";

grant TRIGGER on public."canvass_reports" to "authenticated";

grant INSERT on public."canvass_reports" to "service_role";

grant SELECT on public."canvass_reports" to "service_role";

grant UPDATE on public."canvass_reports" to "service_role";

grant DELETE on public."canvass_reports" to "service_role";

grant TRUNCATE on public."canvass_reports" to "service_role";

grant REFERENCES on public."canvass_reports" to "service_role";

grant TRIGGER on public."canvass_reports" to "service_role";

grant INSERT on public."profiles" to "authenticated";

grant SELECT on public."profiles" to "authenticated";

grant DELETE on public."profiles" to "authenticated";

grant TRUNCATE on public."profiles" to "authenticated";

grant REFERENCES on public."profiles" to "authenticated";

grant TRIGGER on public."profiles" to "authenticated";

grant INSERT on public."profiles" to "service_role";

grant SELECT on public."profiles" to "service_role";

grant UPDATE on public."profiles" to "service_role";

grant DELETE on public."profiles" to "service_role";

grant TRUNCATE on public."profiles" to "service_role";

grant REFERENCES on public."profiles" to "service_role";

grant TRIGGER on public."profiles" to "service_role";

grant SELECT on public."profiles" to "supabase_auth_admin";

grant INSERT on public."phone_lists" to "authenticated";

grant SELECT on public."phone_lists" to "authenticated";

grant UPDATE on public."phone_lists" to "authenticated";

grant DELETE on public."phone_lists" to "authenticated";

grant TRUNCATE on public."phone_lists" to "authenticated";

grant REFERENCES on public."phone_lists" to "authenticated";

grant TRIGGER on public."phone_lists" to "authenticated";

grant INSERT on public."phone_lists" to "service_role";

grant SELECT on public."phone_lists" to "service_role";

grant UPDATE on public."phone_lists" to "service_role";

grant DELETE on public."phone_lists" to "service_role";

grant TRUNCATE on public."phone_lists" to "service_role";

grant REFERENCES on public."phone_lists" to "service_role";

grant TRIGGER on public."phone_lists" to "service_role";

grant INSERT on public."phone_contacts" to "authenticated";

grant SELECT on public."phone_contacts" to "authenticated";

grant UPDATE on public."phone_contacts" to "authenticated";

grant DELETE on public."phone_contacts" to "authenticated";

grant TRUNCATE on public."phone_contacts" to "authenticated";

grant REFERENCES on public."phone_contacts" to "authenticated";

grant TRIGGER on public."phone_contacts" to "authenticated";

grant INSERT on public."phone_contacts" to "service_role";

grant SELECT on public."phone_contacts" to "service_role";

grant UPDATE on public."phone_contacts" to "service_role";

grant DELETE on public."phone_contacts" to "service_role";

grant TRUNCATE on public."phone_contacts" to "service_role";

grant REFERENCES on public."phone_contacts" to "service_role";

grant TRIGGER on public."phone_contacts" to "service_role";

revoke all on function public.is_super_admin() from public;

grant execute on function public.is_super_admin() to "authenticated";

grant execute on function public.is_super_admin() to "service_role";

revoke all on function public.admin_set_super_admin(p_user uuid, p_value boolean) from public;

grant execute on function public.admin_set_super_admin(p_user uuid, p_value boolean) to "authenticated";

grant execute on function public.admin_set_super_admin(p_user uuid, p_value boolean) to "service_role";

revoke all on function public.handle_new_user() from public;

grant execute on function public.handle_new_user() to "service_role";

revoke all on function public.current_team_id() from public;

grant execute on function public.current_team_id() to "authenticated";

grant execute on function public.current_team_id() to "service_role";

revoke all on function public.create_team(p_name text) from public;

grant execute on function public.create_team(p_name text) to "authenticated";

grant execute on function public.create_team(p_name text) to "service_role";

revoke all on function public.join_team(p_code text) from public;

grant execute on function public.join_team(p_code text) to "authenticated";

grant execute on function public.join_team(p_code text) to "service_role";

revoke all on function public.leave_team() from public;

grant execute on function public.leave_team() to "authenticated";

grant execute on function public.leave_team() to "service_role";

revoke all on function public.admin_create_account(p_email text, p_password text, p_full_name text, p_organisation text, p_status text, p_tier text, p_trial_ends_at timestamp with time zone, p_super boolean) from public;

grant execute on function public.admin_create_account(p_email text, p_password text, p_full_name text, p_organisation text, p_status text, p_tier text, p_trial_ends_at timestamp with time zone, p_super boolean) to "authenticated";

grant execute on function public.admin_create_account(p_email text, p_password text, p_full_name text, p_organisation text, p_status text, p_tier text, p_trial_ends_at timestamp with time zone, p_super boolean) to "service_role";

revoke all on function public.billing_price_eur(p_tier text, p_cycle text) from public;

grant execute on function public.billing_price_eur(p_tier text, p_cycle text) to "authenticated";

grant execute on function public.billing_price_eur(p_tier text, p_cycle text) to "service_role";

revoke all on function public.self_set_plan(p_tier text, p_cycle text) from public;

grant execute on function public.self_set_plan(p_tier text, p_cycle text) to "authenticated";

grant execute on function public.self_set_plan(p_tier text, p_cycle text) to "service_role";

revoke all on function public.self_cancel() from public;

grant execute on function public.self_cancel() to "authenticated";

grant execute on function public.self_cancel() to "service_role";

revoke all on function public.self_resume() from public;

grant execute on function public.self_resume() to "authenticated";

grant execute on function public.self_resume() to "service_role";

revoke all on function public.admin_set_subscription(p_user uuid, p_status text, p_tier text, p_trial_ends_at timestamp with time zone, p_billing_cycle text, p_cancel_at timestamp with time zone) from public;

grant execute on function public.admin_set_subscription(p_user uuid, p_status text, p_tier text, p_trial_ends_at timestamp with time zone, p_billing_cycle text, p_cancel_at timestamp with time zone) to "authenticated";

grant execute on function public.admin_set_subscription(p_user uuid, p_status text, p_tier text, p_trial_ends_at timestamp with time zone, p_billing_cycle text, p_cancel_at timestamp with time zone) to "service_role";

revoke all on function public.custom_access_token_hook(event jsonb) from public;

grant execute on function public.custom_access_token_hook(event jsonb) to "service_role";

grant execute on function public.custom_access_token_hook(event jsonb) to "supabase_auth_admin";
grant update ("full_name") on public.profiles to authenticated;
grant update ("organisation") on public.profiles to authenticated;
