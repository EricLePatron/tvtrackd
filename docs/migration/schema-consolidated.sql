-- ============================================================================
-- tvtrackd — SCHÉMA CONSOLIDÉ (état final, exécutable en une passe)
-- ============================================================================
--
-- À exécuter UNE FOIS sur une base Supabase VIERGE (SQL editor ou psql), dans
-- l'ordre : d'abord la PARTIE 1 (tables + RLS + index), puis la PARTIE 2
-- (fonctions, triggers, moteur de statut). Les deux parties sont dans ce fichier,
-- déjà dans le bon ordre — il suffit de tout exécuter.
--
-- Ce fichier REMPLACE `docs/migration/bootstrap-schema.sql`, qui est la simple
-- concaténation des 28 migrations Lovable et contient des CREATE TABLE/CREATE TYPE
-- EN DOUBLE (import_runs, user_roles, app_role). Rejouer le bootstrap sur une base
-- fraîche échoue en « relation already exists » ; ce schéma consolidé est dédupliqué.
--
-- Source : documentation de rebuild (pages 05 « Schéma SQL complet » et 06
-- « Fonctions, triggers & moteur de statut »), elle-même dérivée du code réel du repo.
--
-- Point de vigilance métier (hérité de l'analyse Betaseries) : `user_shows.status`
-- (archivage) et l'historique d'épisodes vus (`watch_status`) sont volontairement
-- séparés. `manual_override` ne fait que figer `status`, il ne touche jamais
-- `watch_status` — désarchiver ne casse donc jamais l'accès à l'historique.
-- ============================================================================


-- ============================================================================
-- PARTIE 1 — TABLES + RLS + INDEX (page 05)
-- ============================================================================

-- ---------- Enum de rôles + schema privé (helpers hors API) ----------
create type public.app_role as enum ('admin', 'moderator', 'user');
create schema if not exists private;
grant usage on schema private to authenticated, service_role;

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  avatar_url text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
create policy profiles_select_own on public.profiles for select to authenticated using (auth.uid() = id);
create policy profiles_insert_own on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy profiles_update_own on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- ---------- shows (cache TMDb partagé, lecture publique) ----------
create table public.shows (
  id serial primary key,
  tmdb_id int not null,
  media_type text not null check (media_type in ('tv','movie')),
  title text not null,
  poster_path text,
  backdrop_path text,
  overview text,
  first_air_date date,
  status text,
  genres text[] not null default '{}',
  vote_average numeric,
  tagline text,
  watch_providers jsonb not null default '{}'::jsonb,
  networks jsonb not null default '[]'::jsonb,
  cached_at timestamptz not null default now(),
  providers_cached_at timestamptz,
  constraint shows_tmdb_id_key unique (tmdb_id),
  constraint shows_tmdb_media_unique unique (tmdb_id, media_type)
);
alter table public.shows enable row level security;
grant select on public.shows to anon, authenticated;
grant all on public.shows to service_role;
create policy shows_public_read on public.shows for select to anon, authenticated using (true);

-- ---------- seasons ----------
create table public.seasons (
  id serial primary key,
  show_id int not null references public.shows(id) on delete cascade,
  season_number int not null,
  episode_count int,
  constraint seasons_show_season_unique unique (show_id, season_number)
);
alter table public.seasons enable row level security;
grant select on public.seasons to anon, authenticated;
grant all on public.seasons to service_role;
create policy seasons_public_read on public.seasons for select to anon, authenticated using (true);

-- ---------- episodes ----------
create table public.episodes (
  id serial primary key,
  show_id int not null references public.shows(id) on delete cascade,
  season_number int not null,
  episode_number int not null,
  title text,
  air_date date,
  overview text,
  still_path text,
  constraint episodes_show_season_ep_unique unique (show_id, season_number, episode_number)
);
alter table public.episodes enable row level security;
grant select on public.episodes to anon, authenticated;
grant all on public.episodes to service_role;
create policy episodes_public_read on public.episodes for select to anon, authenticated using (true);
-- Sert la timeline calendrier (range air_date par show_id)
create index episodes_show_id_air_date_idx on public.episodes (show_id, air_date);

-- ---------- user_shows ----------
create table public.user_shows (
  id serial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  show_id int not null references public.shows(id) on delete cascade,
  status text not null check (status in ('a_voir','en_cours','termine','abandonne','archive')),
  manual_override text check (manual_override in ('abandonne','archive')),
  created_at timestamptz not null default now(),
  constraint user_shows_user_show_unique unique (user_id, show_id)
);
alter table public.user_shows enable row level security;
grant select, insert, update, delete on public.user_shows to authenticated;
grant all on public.user_shows to service_role;
grant usage, select on sequence public.user_shows_id_seq to service_role;
create policy user_shows_select_own on public.user_shows for select to authenticated using (auth.uid() = user_id);
create policy user_shows_insert_own on public.user_shows for insert to authenticated with check (auth.uid() = user_id);
create policy user_shows_update_own on public.user_shows for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy user_shows_delete_own on public.user_shows for delete to authenticated using (auth.uid() = user_id);

-- ---------- watch_status (1 ligne par visionnage) ----------
create table public.watch_status (
  id serial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  episode_id int not null references public.episodes(id) on delete cascade,
  watch_count int not null default 1,
  watched_at timestamptz not null default now(),
  watched_at_approximate boolean not null default false,
  constraint watch_status_user_ep_unique unique (user_id, episode_id)
);
alter table public.watch_status enable row level security;
grant select, insert, update, delete on public.watch_status to authenticated;
grant all on public.watch_status to service_role;
grant usage, select on sequence public.watch_status_id_seq to service_role;
create policy watch_status_select_own on public.watch_status for select to authenticated using (auth.uid() = user_id);
create policy watch_status_insert_own on public.watch_status for insert to authenticated with check (auth.uid() = user_id);
create policy watch_status_update_own on public.watch_status for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy watch_status_delete_own on public.watch_status for delete to authenticated using (auth.uid() = user_id);
-- Sert les fenêtres DAU/WAU/MAU du dashboard admin
create index watch_status_approx_watched_at_idx on public.watch_status (watched_at_approximate, watched_at desc);

-- ---------- import_runs ----------
create table public.import_runs (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default '',
  imported_episodes int not null default 0,
  followed_shows int not null default 0,
  unmatched_count int not null default 0,
  unmatched jsonb not null default '[]',
  unmatched_items jsonb not null default '[]',
  resolved_keys jsonb not null default '[]',
  total_groups int,
  created_at timestamptz not null default now()
);
create index import_runs_user_created on public.import_runs (user_id, created_at desc);
alter table public.import_runs enable row level security;
grant select, insert, update on public.import_runs to authenticated;
grant all on public.import_runs to service_role;
grant usage, select on sequence public.import_runs_id_seq to service_role, authenticated;
create policy import_runs_select_own on public.import_runs for select to authenticated using (user_id = auth.uid());
create policy import_runs_insert_own on public.import_runs for insert to authenticated with check (user_id = auth.uid());
create policy import_runs_update_own on public.import_runs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
comment on column public.import_runs.total_groups is
  'Nombre total de groupes (titre, année) du run — dénominateur du taux de matching TMDb (matched = total_groups - unmatched_count). NULL pour les runs anciens : à exclure du calcul, pas traiter comme 0.';

-- ---------- user_roles ----------
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;
-- Lecture seule côté client ; toute écriture passe par service_role
revoke insert, update, delete, truncate on public.user_roles from public, anon, authenticated;
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
-- (policy user_roles_select : définie en PARTIE 2, après private.has_role)

-- ---------- show_ratings ----------
create table public.show_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  show_id int not null references public.shows(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, show_id)
);
create index show_ratings_show_id_idx on public.show_ratings(show_id);
alter table public.show_ratings enable row level security;
grant select, insert, update, delete on public.show_ratings to authenticated;
grant all on public.show_ratings to service_role;
create policy show_ratings_select_own on public.show_ratings for select to authenticated using (auth.uid() = user_id);
create policy show_ratings_insert_own on public.show_ratings for insert to authenticated with check (auth.uid() = user_id);
create policy show_ratings_update_own on public.show_ratings for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy show_ratings_delete_own on public.show_ratings for delete to authenticated using (auth.uid() = user_id);


-- ============================================================================
-- PARTIE 2 — FONCTIONS, TRIGGERS & MOTEUR DE STATUT (page 06)
-- À exécuter APRÈS la partie 1 (les fonctions référencent les tables).
-- ============================================================================

-- ============ 1. Création auto du profil + seed admin ============
-- Remplace l'email admin par le tien si besoin.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  if new.email = 'chollet.eric@gmail.com' then
    insert into public.user_roles (user_id, role) values (new.id, 'admin')
    on conflict do nothing;
  end if;
  return new;
end; $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Seed admin pour un compte déjà existant
insert into public.user_roles (user_id, role)
  select id, 'admin' from auth.users where email = 'chollet.eric@gmail.com'
  on conflict do nothing;

-- ============ 2. Rôles : helper hors API + policy ============
create or replace function private.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;
revoke all on function private.has_role(uuid, public.app_role) from public, anon;
grant execute on function private.has_role(uuid, public.app_role) to authenticated, service_role;

create policy user_roles_select on public.user_roles
  for select to authenticated
  using (private.has_role(auth.uid(), 'admin') or user_id = auth.uid());

-- ============ 3. Statut de MON show (front, RLS, scopé auth.uid) ============
create or replace function public.compute_my_show_status(p_show_id integer)
returns text language plpgsql stable security invoker set search_path = public as $$
declare
  v_media_type text; v_show_status text; v_total_known int;
  v_has_null_count boolean; v_watched_count int; v_user uuid := auth.uid();
begin
  if v_user is null then return null; end if;
  select media_type, status into v_media_type, v_show_status from public.shows where id = p_show_id;
  if v_media_type is distinct from 'tv' then return null; end if;
  select coalesce(bool_or(episode_count is null), false), coalesce(sum(episode_count), 0)
    into v_has_null_count, v_total_known from public.seasons where show_id = p_show_id;
  if v_has_null_count then v_total_known := null; end if;
  select count(*) into v_watched_count from public.watch_status ws
    join public.episodes e on e.id = ws.episode_id
    where ws.user_id = v_user and e.show_id = p_show_id;
  if v_watched_count = 0 then return 'a_voir'; end if;
  if v_total_known is not null and v_total_known > 0 and v_watched_count >= v_total_known
     and v_show_status in ('Ended', 'Canceled') then return 'termine'; end if;
  return 'en_cours';
end; $$;
revoke all on function public.compute_my_show_status(integer) from public, anon;
grant execute on function public.compute_my_show_status(integer) to authenticated;

-- ============ 4. Moteur de statut (service_role) ============
create or replace function public.compute_tv_status(p_show_id int, p_user_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_total_known int; v_has_null_count boolean; v_watched_count int; v_show_status text;
begin
  select coalesce(bool_or(episode_count is null), false), coalesce(sum(episode_count), 0)
    into v_has_null_count, v_total_known from public.seasons where show_id = p_show_id;
  if v_has_null_count then v_total_known := null; end if;
  select count(*) into v_watched_count from public.watch_status ws
    join public.episodes e on e.id = ws.episode_id
    where ws.user_id = p_user_id and e.show_id = p_show_id;
  if v_watched_count = 0 then return 'a_voir'; end if;
  select status into v_show_status from public.shows where id = p_show_id;
  if v_total_known is not null and v_total_known > 0 and v_watched_count >= v_total_known
     and v_show_status in ('Ended', 'Canceled') then return 'termine'; end if;
  return 'en_cours';
end; $$;

create or replace function public.compute_show_status(p_show_id int, p_user_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_media_type text;
begin
  select media_type into v_media_type from public.shows where id = p_show_id;
  if v_media_type = 'tv' then return public.compute_tv_status(p_show_id, p_user_id); end if;
  return null; -- films : rien à calculer
end; $$;

-- Applique le statut calculé ; respecte manual_override ; lève 'abandonne'
-- sur un nouveau visionnage (p_new_watch_event), jamais 'archive'.
create or replace function public.apply_computed_status(
  p_show_id int, p_user_id uuid, p_new_watch_event boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare v_row public.user_shows%rowtype; v_new_status text;
begin
  select * into v_row from public.user_shows
    where show_id = p_show_id and user_id = p_user_id for update;
  if not found then return; end if;
  if v_row.manual_override is not null then
    if p_new_watch_event and v_row.manual_override = 'abandonne' then
      update public.user_shows set manual_override = null where id = v_row.id;
      v_row.manual_override := null;
    else return; end if;
  end if;
  v_new_status := public.compute_show_status(p_show_id, p_user_id);
  if v_new_status is null or v_new_status = v_row.status then return; end if;
  update public.user_shows set status = v_new_status where id = v_row.id;
end; $$;

-- ---- Triggers de recalcul ----
create or replace function public.trg_watch_status_recompute()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_user_id uuid; v_episode_id int; v_show_id int; v_is_new_watch boolean;
begin
  if tg_op = 'DELETE' then v_user_id := old.user_id; v_episode_id := old.episode_id; v_is_new_watch := false;
  else v_user_id := new.user_id; v_episode_id := new.episode_id; v_is_new_watch := (tg_op = 'INSERT'); end if;
  select show_id into v_show_id from public.episodes where id = v_episode_id;
  if v_show_id is not null then perform public.apply_computed_status(v_show_id, v_user_id, v_is_new_watch); end if;
  return null;
end; $$;
create trigger watch_status_recompute_status
  after insert or update or delete on public.watch_status
  for each row execute function public.trg_watch_status_recompute();

create or replace function public.trg_episodes_recompute()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select user_id from public.user_shows where show_id = new.show_id loop
    perform public.apply_computed_status(new.show_id, r.user_id);
  end loop; return null;
end; $$;
create trigger episodes_recompute_status
  after insert on public.episodes
  for each row execute function public.trg_episodes_recompute();

create or replace function public.trg_seasons_recompute()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select user_id from public.user_shows where show_id = new.show_id loop
    perform public.apply_computed_status(new.show_id, r.user_id);
  end loop; return null;
end; $$;
create trigger seasons_recompute_status
  after insert or update of episode_count on public.seasons
  for each row execute function public.trg_seasons_recompute();

create or replace function public.trg_shows_recompute()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.media_type <> 'tv' then return null; end if;
  if new.status is not distinct from old.status then return null; end if;
  for r in select user_id from public.user_shows where show_id = new.id loop
    perform public.apply_computed_status(new.id, r.user_id);
  end loop; return null;
end; $$;
create trigger shows_recompute_status
  after update of status on public.shows
  for each row execute function public.trg_shows_recompute();

create or replace function public.trg_user_shows_manual_override_recompute()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.manual_override is not null then
    update public.user_shows set status = new.manual_override where id = new.id;
  else
    update public.user_shows
      set status = coalesce(public.compute_show_status(new.show_id, new.user_id), new.status)
      where id = new.id;
  end if; return null;
end; $$;
create trigger user_shows_manual_override_recompute
  after update of manual_override on public.user_shows
  for each row when (new.manual_override is distinct from old.manual_override)
  execute function public.trg_user_shows_manual_override_recompute();

-- ---- Grants du moteur : service_role uniquement, jamais anon/authenticated ----
revoke execute on function public.compute_tv_status(int, uuid) from public, anon, authenticated;
revoke execute on function public.compute_show_status(int, uuid) from public, anon, authenticated;
revoke execute on function public.apply_computed_status(int, uuid, boolean) from public, anon, authenticated;
grant execute on function public.compute_tv_status(int, uuid) to service_role;
grant execute on function public.compute_show_status(int, uuid) to service_role;
grant execute on function public.apply_computed_status(int, uuid, boolean) to service_role;
revoke execute on function public.trg_watch_status_recompute() from public, anon, authenticated;
revoke execute on function public.trg_episodes_recompute() from public, anon, authenticated;
revoke execute on function public.trg_seasons_recompute() from public, anon, authenticated;
revoke execute on function public.trg_shows_recompute() from public, anon, authenticated;
revoke execute on function public.trg_user_shows_manual_override_recompute() from public, anon, authenticated;

-- ============ 5. Metriques admin (service_role) ============
create or replace function public.admin_watch_activity(_now timestamptz default now())
returns table (window_label text, is_approximate boolean, distinct_users bigint, episode_count bigint)
language sql stable set search_path = public as $$
  select w.window_label, w.is_approximate,
         count(distinct ws.user_id)::bigint, count(ws.id)::bigint
  from (values
    ('1d', _now - interval '1 day', false), ('1d', _now - interval '1 day', true),
    ('7d', _now - interval '7 days', false), ('7d', _now - interval '7 days', true),
    ('30d', _now - interval '30 days', false), ('30d', _now - interval '30 days', true)
  ) as w(window_label, since, is_approximate)
  left join public.watch_status ws
    on ws.watched_at >= w.since and ws.watched_at_approximate = w.is_approximate
  group by w.window_label, w.is_approximate;
$$;
revoke all on function public.admin_watch_activity(timestamptz) from public, anon, authenticated;
grant execute on function public.admin_watch_activity(timestamptz) to service_role;

-- ============ 6. show_ratings.updated_at ============
create or replace function public.update_show_ratings_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;
revoke all on function public.update_show_ratings_updated_at() from public, anon, authenticated;
create trigger trg_show_ratings_updated_at
  before update on public.show_ratings
  for each row execute function public.update_show_ratings_updated_at();


-- ============================================================================
-- CONTRÔLES POST-EXÉCUTION (à lancer après coup pour valider)
-- ============================================================================
-- Tables attendues : episodes, import_runs, profiles, seasons, show_ratings,
--                     shows, user_roles, user_shows, watch_status
--   select table_name from information_schema.tables where table_schema='public' order by 1;
-- RLS active partout (relrowsecurity doit être true pour chaque table) :
--   select relname, relrowsecurity from pg_class
--     where relnamespace='public'::regnamespace and relkind='r' order by 1;
-- Policies / fonctions / triggers :
--   select tablename, policyname from pg_policies where schemaname='public' order by 1,2;
--   select proname from pg_proc where pronamespace in ('public'::regnamespace,'private'::regnamespace) order by 1;
--   select tgname from pg_trigger where not tgisinternal order by 1;
-- ============================================================================
