-- ===== 20260703094535_c9e306dc-1e21-4707-b150-9e210e30df9b.sql =====

-- profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- shows (cache partagé, lecture publique)
CREATE TABLE public.shows (
  id serial PRIMARY KEY,
  tmdb_id int UNIQUE NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('tv','movie')),
  title text NOT NULL,
  poster_path text,
  overview text,
  first_air_date date,
  status text,
  cached_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shows TO anon, authenticated;
GRANT ALL ON public.shows TO service_role;
ALTER TABLE public.shows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shows_public_read" ON public.shows FOR SELECT TO anon, authenticated USING (true);

-- seasons
CREATE TABLE public.seasons (
  id serial PRIMARY KEY,
  show_id int NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
  season_number int NOT NULL,
  episode_count int,
  UNIQUE (show_id, season_number)
);
GRANT SELECT ON public.seasons TO anon, authenticated;
GRANT ALL ON public.seasons TO service_role;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seasons_public_read" ON public.seasons FOR SELECT TO anon, authenticated USING (true);

-- episodes
CREATE TABLE public.episodes (
  id serial PRIMARY KEY,
  show_id int NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
  season_number int NOT NULL,
  episode_number int NOT NULL,
  title text,
  air_date date,
  overview text,
  UNIQUE (show_id, season_number, episode_number)
);
GRANT SELECT ON public.episodes TO anon, authenticated;
GRANT ALL ON public.episodes TO service_role;
ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "episodes_public_read" ON public.episodes FOR SELECT TO anon, authenticated USING (true);

-- user_shows
CREATE TABLE public.user_shows (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  show_id int NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('a_voir','en_cours','termine','abandonne','archive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, show_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_shows TO authenticated;
GRANT ALL ON public.user_shows TO service_role;
ALTER TABLE public.user_shows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_shows_select_own" ON public.user_shows FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_shows_insert_own" ON public.user_shows FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_shows_update_own" ON public.user_shows FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_shows_delete_own" ON public.user_shows FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- watch_status
CREATE TABLE public.watch_status (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  episode_id int NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  watch_count int NOT NULL DEFAULT 1,
  watched_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watch_status TO authenticated;
GRANT ALL ON public.watch_status TO service_role;
ALTER TABLE public.watch_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "watch_status_select_own" ON public.watch_status FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "watch_status_insert_own" ON public.watch_status FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "watch_status_update_own" ON public.watch_status FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "watch_status_delete_own" ON public.watch_status FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== 20260703094546_a6368b20-b340-4dde-8f17-9713bd73bb5f.sql =====

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ===== 20260703095703_c8c24b4c-c76d-4966-aadd-c13b12752640.sql =====
-- Add unique constraints needed for TMDb upsert flows
ALTER TABLE public.shows ADD CONSTRAINT shows_tmdb_media_unique UNIQUE (tmdb_id, media_type);
ALTER TABLE public.seasons ADD CONSTRAINT seasons_show_season_unique UNIQUE (show_id, season_number);
ALTER TABLE public.episodes ADD CONSTRAINT episodes_show_season_ep_unique UNIQUE (show_id, season_number, episode_number);
ALTER TABLE public.user_shows ADD CONSTRAINT user_shows_user_show_unique UNIQUE (user_id, show_id);
ALTER TABLE public.watch_status ADD CONSTRAINT watch_status_user_ep_unique UNIQUE (user_id, episode_id);

-- Grant service_role full access for edge functions (needed for upserts)
GRANT ALL ON public.shows TO service_role;
GRANT ALL ON public.seasons TO service_role;
GRANT ALL ON public.episodes TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.shows_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.seasons_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.episodes_id_seq TO service_role;
-- ===== 20260704060946_watch_status_approximate.sql =====
-- Distingue une date de visionnage réelle (saisie granulaire, tracking manuel)
-- d'une date approximative reconstituée lors d'un import agrégé (ex. export
-- Betaseries, qui ne fournit qu'un dernier épisode vu et un statut de complétion,
-- sans date par épisode). Additif uniquement : aucune contrainte existante modifiée.
ALTER TABLE public.watch_status
  ADD COLUMN watched_at_approximate boolean NOT NULL DEFAULT false;

-- ===== 20260704120008_episodes_show_air_date_index.sql =====
-- Perf: the /calendar timeline (bidirectional scroll, unlimited backward
-- pagination) filters episodes by `show_id IN (...) AND air_date BETWEEN ...`
-- repeatedly as the user scrolls back in time. The existing unique
-- constraint on (show_id, season_number, episode_number) only helps the
-- show_id lookup; add a composite index that directly serves this range
-- query pattern on the shared `episodes` cache table.
CREATE INDEX IF NOT EXISTS episodes_show_id_air_date_idx
  ON public.episodes (show_id, air_date);

-- ===== 20260705085630_b06deb43-8898-48cc-a7bb-b8eac22f85fe.sql =====
ALTER TABLE public.shows
  ADD COLUMN genres text[] NOT NULL DEFAULT '{}',
  ADD COLUMN vote_average numeric,
  ADD COLUMN tagline text;

UPDATE public.shows SET cached_at = 'epoch';
-- ===== 20260705120000_show_metadata.sql =====
-- Métadonnées TMDb supplémentaires sur shows (note, genres, tagline)
ALTER TABLE public.shows
  ADD COLUMN IF NOT EXISTS genres text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS vote_average numeric,
  ADD COLUMN IF NOT EXISTS tagline text;

-- Force le refetch des fiches déjà en cache pour récupérer ces nouveaux champs
UPDATE public.shows SET cached_at = 'epoch';

-- ===== 20260706100000_auto_status.sql =====
-- Statut automatique pour les séries TV.
--
-- Jusqu'ici, `user_shows.status` était choisi manuellement par l'utilisateur
-- (via le StatusPicker) ou déduit ponctuellement par l'edge function
-- import-history (deduceStatus/getShowProgress). Cette migration centralise
-- le calcul en SQL et l'applique aussi bien au tracking natif qu'à l'import :
--
-- - Pour les séries (media_type = 'tv') : `status` ∈ {a_voir, en_cours, termine}
--   est désormais TOUJOURS dérivé de la progression de visionnage
--   (watch_status) et de l'état TMDb de la série (shows.status). Ces 3
--   valeurs ne sont plus jamais écrites manuellement par le frontend.
--   `manual_override` (abandonne | archive | NULL) permet de figer `status`
--   sur l'une des 2 valeurs qui ne peuvent jamais être déduites
--   automatiquement. Tant que `manual_override IS NULL`, `status` reste
--   piloté par le calcul.
-- - Pour les films (media_type = 'movie') : aucun changement. Il n'existe
--   aucune ligne `episodes`/`seasons` pour les films dans ce schéma, donc
--   aucune progression n'est calculable ; `status` reste choisi manuellement
--   parmi les 5 valeurs existantes et `manual_override` n'est jamais
--   utilisé pour eux.
--
-- Rappel CLAUDE.md : ne jamais coupler l'archivage et l'historique de
-- visionnage dans la même colonne — c'est respecté ici : `manual_override`
-- ne fait que figer `status`, il ne touche jamais à `watch_status`.

ALTER TABLE public.user_shows
  ADD COLUMN manual_override text CHECK (manual_override IN ('abandonne', 'archive'));

-- ------------------------------------------------------------------------
-- compute_tv_status : reprend deduceStatus()/getShowProgress() de l'edge
-- function import-history/index.ts (désormais centralisées ici). Ne
-- retourne jamais 'abandonne'/'archive' : ces 2 valeurs ne sont jamais
-- déduites automatiquement, seulement figées via manual_override.
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_tv_status(p_show_id int, p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_known int;
  v_has_null_count boolean;
  v_watched_count int;
  v_show_status text;
BEGIN
  SELECT
    COALESCE(bool_or(episode_count IS NULL), false),
    COALESCE(sum(episode_count), 0)
  INTO v_has_null_count, v_total_known
  FROM public.seasons
  WHERE show_id = p_show_id;

  IF v_has_null_count THEN
    v_total_known := NULL;
  END IF;

  SELECT count(*)
  INTO v_watched_count
  FROM public.watch_status ws
  JOIN public.episodes e ON e.id = ws.episode_id
  WHERE ws.user_id = p_user_id
    AND e.show_id = p_show_id;

  IF v_watched_count = 0 THEN
    RETURN 'a_voir';
  END IF;

  SELECT status INTO v_show_status FROM public.shows WHERE id = p_show_id;

  IF v_total_known IS NOT NULL
     AND v_total_known > 0
     AND v_watched_count >= v_total_known
     AND v_show_status IN ('Ended', 'Canceled') THEN
    RETURN 'termine';
  END IF;

  RETURN 'en_cours';
END;
$$;

-- Dispatch media_type : seules les séries ont un statut calculable ; NULL
-- pour les films signifie "ne rien calculer, laisser status tel quel".
CREATE OR REPLACE FUNCTION public.compute_show_status(p_show_id int, p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_media_type text;
BEGIN
  SELECT media_type INTO v_media_type FROM public.shows WHERE id = p_show_id;
  IF v_media_type = 'tv' THEN
    RETURN public.compute_tv_status(p_show_id, p_user_id);
  END IF;
  RETURN NULL;
END;
$$;

-- Variante exposée au frontend (RPC), scoping obligatoire sur auth.uid() :
-- compute_show_status(p_show_id, p_user_id) prend un user_id arbitraire et
-- est donc réservée à service_role (import-history). L'exposer directement
-- à `authenticated` permettrait à un utilisateur de sonder la progression
-- de visionnage d'un AUTRE utilisateur sur une série (fuite d'info),
-- puisque c'est une fonction SECURITY DEFINER qui contourne RLS. Cette
-- variante ne calcule donc jamais que le statut de l'appelant.
CREATE OR REPLACE FUNCTION public.compute_my_show_status(p_show_id int)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.compute_show_status(p_show_id, auth.uid());
$$;

-- ------------------------------------------------------------------------
-- apply_computed_status : fonction centrale appelée par les triggers.
-- Respecte manual_override (skip si non NULL) et ne touche `status` que
-- s'il diffère du calcul, pour éviter des écritures inutiles.
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_computed_status(p_show_id int, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.user_shows%ROWTYPE;
  v_new_status text;
BEGIN
  SELECT * INTO v_row
  FROM public.user_shows
  WHERE show_id = p_show_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN; -- série pas (encore) suivie par cet utilisateur : rien à faire
  END IF;

  IF v_row.manual_override IS NOT NULL THEN
    RETURN; -- figé sur abandonne/archive : ne jamais recalculer par-dessus
  END IF;

  v_new_status := public.compute_show_status(p_show_id, p_user_id);

  IF v_new_status IS NULL OR v_new_status = v_row.status THEN
    RETURN;
  END IF;

  UPDATE public.user_shows SET status = v_new_status WHERE id = v_row.id;
END;
$$;

-- ------------------------------------------------------------------------
-- Triggers externes : watch_status / episodes / seasons / shows.
-- Volontairement AUCUN trigger sur user_shows réagissant à un changement de
-- `status` (boucle triviale, cf. discussion) : apply_computed_status est
-- le seul point d'écriture de `status` en dehors des actions manuelles
-- abandonne/archive/reprise ci-dessous.
-- ------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trg_watch_status_recompute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_episode_id int;
  v_show_id int;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
    v_episode_id := OLD.episode_id;
  ELSE
    v_user_id := NEW.user_id;
    v_episode_id := NEW.episode_id;
  END IF;

  SELECT show_id INTO v_show_id FROM public.episodes WHERE id = v_episode_id;
  IF v_show_id IS NOT NULL THEN
    PERFORM public.apply_computed_status(v_show_id, v_user_id);
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER watch_status_recompute_status
AFTER INSERT OR UPDATE OR DELETE ON public.watch_status
FOR EACH ROW EXECUTE FUNCTION public.trg_watch_status_recompute();

-- Nouvel épisode qui sort (cache TMDb rafraîchi) : peut faire passer une
-- série "à jour" de en_cours à termine (Ended/Canceled) devient impossible
-- puisqu'un nouvel épisode ne peut que RETARDER la complétion — mais peut
-- aussi faire passer une série de termine -> en_cours si un épisode
-- supplémentaire vient d'être annoncé/ajouté après coup. Recalcul pour tous
-- les followers de la série, par sécurité.
CREATE OR REPLACE FUNCTION public.trg_episodes_recompute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT user_id FROM public.user_shows WHERE show_id = NEW.show_id LOOP
    PERFORM public.apply_computed_status(NEW.show_id, r.user_id);
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER episodes_recompute_status
AFTER INSERT ON public.episodes
FOR EACH ROW EXECUTE FUNCTION public.trg_episodes_recompute();

-- Total d'épisodes connu qui se complète/change (episode_count passe de
-- NULL à une valeur, ou change).
CREATE OR REPLACE FUNCTION public.trg_seasons_recompute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT user_id FROM public.user_shows WHERE show_id = NEW.show_id LOOP
    PERFORM public.apply_computed_status(NEW.show_id, r.user_id);
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER seasons_recompute_status
AFTER INSERT OR UPDATE OF episode_count ON public.seasons
FOR EACH ROW EXECUTE FUNCTION public.trg_seasons_recompute();

-- Bascule Returning Series <-> Ended/Canceled côté TMDb. Le cache `shows`
-- est réécrit en entier à chaque refresh (upsert de toutes les colonnes),
-- donc ce trigger fire même quand `status` ne change pas réellement : on
-- filtre explicitement pour ne recalculer que sur un changement effectif.
CREATE OR REPLACE FUNCTION public.trg_shows_recompute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF NEW.media_type <> 'tv' THEN
    RETURN NULL;
  END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NULL;
  END IF;
  FOR r IN SELECT user_id FROM public.user_shows WHERE show_id = NEW.id LOOP
    PERFORM public.apply_computed_status(NEW.id, r.user_id);
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER shows_recompute_status
AFTER UPDATE OF status ON public.shows
FOR EACH ROW EXECUTE FUNCTION public.trg_shows_recompute();

-- ------------------------------------------------------------------------
-- Trigger sur user_shows scopé à `manual_override` (PAS à `status`, donc
-- aucun risque de boucle avec apply_computed_status qui n'écrit que
-- `status`) : synchronise immédiatement `status` quand une action
-- explicite (Abandonner / Archiver / Reprendre le suivi) change
-- manual_override, plutôt que de laisser un `status` figé périmé jusqu'au
-- prochain événement externe. Permet au frontend de n'écrire QUE
-- `manual_override` pour ces 3 actions.
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_user_shows_manual_override_recompute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.manual_override IS NOT NULL THEN
    UPDATE public.user_shows SET status = NEW.manual_override WHERE id = NEW.id;
  ELSE
    UPDATE public.user_shows
    SET status = COALESCE(public.compute_show_status(NEW.show_id, NEW.user_id), NEW.status)
    WHERE id = NEW.id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER user_shows_manual_override_recompute
AFTER UPDATE OF manual_override ON public.user_shows
FOR EACH ROW
WHEN (NEW.manual_override IS DISTINCT FROM OLD.manual_override)
EXECUTE FUNCTION public.trg_user_shows_manual_override_recompute();

-- ------------------------------------------------------------------------
-- Grants : les fonctions à signature "libre" (p_user_id arbitraire) ne
-- doivent être exécutables que par service_role (edge functions), jamais
-- par anon/authenticated directement en RPC — sinon un utilisateur pourrait
-- calculer le statut de visionnage d'un AUTRE utilisateur. Seule la
-- variante scopée sur auth.uid() (compute_my_show_status) est exposée au
-- frontend. Les fonctions de trigger (trg_*) ne sont pas concernées : elles
-- ne sont invocables que par le mécanisme de trigger, pas en SQL direct.
-- ------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.compute_tv_status(int, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_show_status(int, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_computed_status(int, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_tv_status(int, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.compute_show_status(int, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_computed_status(int, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.compute_my_show_status(int) TO authenticated;

-- ------------------------------------------------------------------------
-- Backfill.
-- - Lignes TV déjà en abandonne/archive : la valeur devient manual_override,
--   `status` reste inchangé (figé tel quel, cohérent avec le nouveau modèle).
-- - Reste des lignes TV (a_voir/en_cours/termine) : manual_override reste
--   NULL et on force un recalcul via la fonction centrale, pour unifier sur
--   une seule règle (le tracking natif et l'import pouvaient légèrement
--   diverger auparavant — changement de status assumé ici).
-- - Films : jamais touchés (manual_override reste NULL, compute_show_status
--   renvoie NULL pour eux donc apply_computed_status est un no-op).
-- ------------------------------------------------------------------------
UPDATE public.user_shows us
SET manual_override = us.status
FROM public.shows s
WHERE us.show_id = s.id
  AND s.media_type = 'tv'
  AND us.status IN ('abandonne', 'archive');

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT us.user_id, us.show_id
    FROM public.user_shows us
    JOIN public.shows s ON s.id = us.show_id
    WHERE s.media_type = 'tv'
      AND us.manual_override IS NULL
  LOOP
    PERFORM public.apply_computed_status(r.show_id, r.user_id);
  END LOOP;
END $$;

-- ===== 20260706110000_lift_abandon_on_new_watch.sql =====
-- Levée automatique de l'override "abandonne" sur un nouveau visionnage.
--
-- Contexte (cf. 20260706100000_auto_status.sql) : apply_computed_status
-- skippait intégralement le recalcul dès que manual_override IS NOT NULL.
-- Nouveau comportement demandé : si l'utilisateur marque un épisode vu pour
-- la première fois (INSERT dans watch_status, jamais un DELETE ni un simple
-- rewatch qui passe par un UPDATE via upsert sur une ligne déjà existante)
-- alors que manual_override = 'abandonne', on lève cet override (NULL) et on
-- laisse le recalcul automatique se faire normalement dans la foulée.
--
-- 'archive' reste volontairement figé, y compris sur un nouveau visionnage :
-- "Archiver" disparaît de l'UI (plus aucune nouvelle ligne ne peut prendre
-- cette valeur désormais), seules des lignes historiques la conservent, et
-- rien ne doit les "réveiller" silencieusement suite à un visionnage isolé.

DROP FUNCTION IF EXISTS public.apply_computed_status(int, uuid);

CREATE FUNCTION public.apply_computed_status(
  p_show_id int,
  p_user_id uuid,
  p_new_watch_event boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.user_shows%ROWTYPE;
  v_new_status text;
BEGIN
  SELECT * INTO v_row
  FROM public.user_shows
  WHERE show_id = p_show_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN; -- série pas (encore) suivie par cet utilisateur : rien à faire
  END IF;

  IF v_row.manual_override IS NOT NULL THEN
    IF p_new_watch_event AND v_row.manual_override = 'abandonne' THEN
      -- Reprise de suivi implicite : lève l'override et continue vers le
      -- recalcul normal ci-dessous plutôt que de RETURN.
      UPDATE public.user_shows SET manual_override = NULL WHERE id = v_row.id;
      v_row.manual_override := NULL;
    ELSE
      RETURN; -- figé sur abandonne (hors nouveau watch) ou archive : jamais recalculé par-dessus
    END IF;
  END IF;

  v_new_status := public.compute_show_status(p_show_id, p_user_id);

  IF v_new_status IS NULL OR v_new_status = v_row.status THEN
    RETURN;
  END IF;

  UPDATE public.user_shows SET status = v_new_status WHERE id = v_row.id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_computed_status(int, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_computed_status(int, uuid, boolean) TO service_role;

-- trg_watch_status_recompute : ne passe p_new_watch_event = true que sur un
-- véritable INSERT (nouvel épisode marqué vu). Un DELETE (décochage) ou un
-- UPDATE (rewatch : upsert sur une ligne watch_status déjà existante) ne
-- lève jamais l'override.
CREATE OR REPLACE FUNCTION public.trg_watch_status_recompute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_episode_id int;
  v_show_id int;
  v_is_new_watch boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
    v_episode_id := OLD.episode_id;
    v_is_new_watch := false;
  ELSE
    v_user_id := NEW.user_id;
    v_episode_id := NEW.episode_id;
    v_is_new_watch := (TG_OP = 'INSERT');
  END IF;

  SELECT show_id INTO v_show_id FROM public.episodes WHERE id = v_episode_id;
  IF v_show_id IS NOT NULL THEN
    PERFORM public.apply_computed_status(v_show_id, v_user_id, v_is_new_watch);
  END IF;

  RETURN NULL;
END;
$$;

-- ===== 20260707052758_347ab50e-3988-43bd-97c4-10f6906bce84.sql =====
ALTER TABLE public.user_shows
  ADD COLUMN manual_override text CHECK (manual_override IN ('abandonne', 'archive'));

CREATE OR REPLACE FUNCTION public.compute_tv_status(p_show_id int, p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_known int;
  v_has_null_count boolean;
  v_watched_count int;
  v_show_status text;
BEGIN
  SELECT
    COALESCE(bool_or(episode_count IS NULL), false),
    COALESCE(sum(episode_count), 0)
  INTO v_has_null_count, v_total_known
  FROM public.seasons
  WHERE show_id = p_show_id;

  IF v_has_null_count THEN
    v_total_known := NULL;
  END IF;

  SELECT count(*)
  INTO v_watched_count
  FROM public.watch_status ws
  JOIN public.episodes e ON e.id = ws.episode_id
  WHERE ws.user_id = p_user_id
    AND e.show_id = p_show_id;

  IF v_watched_count = 0 THEN
    RETURN 'a_voir';
  END IF;

  SELECT status INTO v_show_status FROM public.shows WHERE id = p_show_id;

  IF v_total_known IS NOT NULL
     AND v_total_known > 0
     AND v_watched_count >= v_total_known
     AND v_show_status IN ('Ended', 'Canceled') THEN
    RETURN 'termine';
  END IF;

  RETURN 'en_cours';
END;
$$;

CREATE OR REPLACE FUNCTION public.compute_show_status(p_show_id int, p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_media_type text;
BEGIN
  SELECT media_type INTO v_media_type FROM public.shows WHERE id = p_show_id;
  IF v_media_type = 'tv' THEN
    RETURN public.compute_tv_status(p_show_id, p_user_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.compute_my_show_status(p_show_id int)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.compute_show_status(p_show_id, auth.uid());
$$;

DROP FUNCTION IF EXISTS public.apply_computed_status(int, uuid);
DROP FUNCTION IF EXISTS public.apply_computed_status(int, uuid, boolean);

CREATE FUNCTION public.apply_computed_status(
  p_show_id int,
  p_user_id uuid,
  p_new_watch_event boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.user_shows%ROWTYPE;
  v_new_status text;
BEGIN
  SELECT * INTO v_row
  FROM public.user_shows
  WHERE show_id = p_show_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_row.manual_override IS NOT NULL THEN
    IF p_new_watch_event AND v_row.manual_override = 'abandonne' THEN
      UPDATE public.user_shows SET manual_override = NULL WHERE id = v_row.id;
      v_row.manual_override := NULL;
    ELSE
      RETURN;
    END IF;
  END IF;

  v_new_status := public.compute_show_status(p_show_id, p_user_id);

  IF v_new_status IS NULL OR v_new_status = v_row.status THEN
    RETURN;
  END IF;

  UPDATE public.user_shows SET status = v_new_status WHERE id = v_row.id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_computed_status(int, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_computed_status(int, uuid, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.trg_episodes_recompute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT user_id FROM public.user_shows WHERE show_id = NEW.show_id LOOP
    PERFORM public.apply_computed_status(NEW.show_id, r.user_id);
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER episodes_recompute_status
AFTER INSERT ON public.episodes
FOR EACH ROW EXECUTE FUNCTION public.trg_episodes_recompute();

CREATE OR REPLACE FUNCTION public.trg_seasons_recompute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT user_id FROM public.user_shows WHERE show_id = NEW.show_id LOOP
    PERFORM public.apply_computed_status(NEW.show_id, r.user_id);
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER seasons_recompute_status
AFTER INSERT OR UPDATE OF episode_count ON public.seasons
FOR EACH ROW EXECUTE FUNCTION public.trg_seasons_recompute();

CREATE OR REPLACE FUNCTION public.trg_shows_recompute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF NEW.media_type <> 'tv' THEN
    RETURN NULL;
  END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NULL;
  END IF;
  FOR r IN SELECT user_id FROM public.user_shows WHERE show_id = NEW.id LOOP
    PERFORM public.apply_computed_status(NEW.id, r.user_id);
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER shows_recompute_status
AFTER UPDATE OF status ON public.shows
FOR EACH ROW EXECUTE FUNCTION public.trg_shows_recompute();

CREATE OR REPLACE FUNCTION public.trg_user_shows_manual_override_recompute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.manual_override IS NOT NULL THEN
    UPDATE public.user_shows SET status = NEW.manual_override WHERE id = NEW.id;
  ELSE
    UPDATE public.user_shows
    SET status = COALESCE(public.compute_show_status(NEW.show_id, NEW.user_id), NEW.status)
    WHERE id = NEW.id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER user_shows_manual_override_recompute
AFTER UPDATE OF manual_override ON public.user_shows
FOR EACH ROW
WHEN (NEW.manual_override IS DISTINCT FROM OLD.manual_override)
EXECUTE FUNCTION public.trg_user_shows_manual_override_recompute();

CREATE OR REPLACE FUNCTION public.trg_watch_status_recompute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_episode_id int;
  v_show_id int;
  v_is_new_watch boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
    v_episode_id := OLD.episode_id;
    v_is_new_watch := false;
  ELSE
    v_user_id := NEW.user_id;
    v_episode_id := NEW.episode_id;
    v_is_new_watch := (TG_OP = 'INSERT');
  END IF;

  SELECT show_id INTO v_show_id FROM public.episodes WHERE id = v_episode_id;

  IF v_show_id IS NOT NULL THEN
    PERFORM public.apply_computed_status(v_show_id, v_user_id, v_is_new_watch);
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER watch_status_recompute_status
AFTER INSERT OR UPDATE OR DELETE ON public.watch_status
FOR EACH ROW EXECUTE FUNCTION public.trg_watch_status_recompute();

REVOKE EXECUTE ON FUNCTION public.compute_tv_status(int, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_show_status(int, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_tv_status(int, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.compute_show_status(int, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.compute_my_show_status(int) TO authenticated;

UPDATE public.user_shows us
SET manual_override = us.status
FROM public.shows s
WHERE us.show_id = s.id
  AND s.media_type = 'tv'
  AND us.status IN ('abandonne', 'archive');

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT us.user_id, us.show_id
    FROM public.user_shows us
    JOIN public.shows s ON s.id = us.show_id
    WHERE s.media_type = 'tv'
      AND us.manual_override IS NULL
  LOOP
    PERFORM public.apply_computed_status(r.show_id, r.user_id);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
-- ===== 20260709120000_watch_providers.sql =====
-- Watch providers (streaming/location/achat) + chaînes de diffusion (networks)
-- Source : TMDb /watch/providers (motorisé par JustWatch) et /tv/{id}.networks.
ALTER TABLE public.shows
  ADD COLUMN IF NOT EXISTS watch_providers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS networks jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Force le refetch des fiches déjà en cache pour récupérer ces nouveaux champs
UPDATE public.shows SET cached_at = 'epoch';

-- ===== 20260709143021_a096a63e-26b5-4c55-b1e3-d637422867ba.sql =====
CREATE TABLE public.import_runs (
  id                bigserial PRIMARY KEY,
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source            text        NOT NULL DEFAULT '',
  imported_episodes int         NOT NULL DEFAULT 0,
  followed_shows    int         NOT NULL DEFAULT 0,
  unmatched_count   int         NOT NULL DEFAULT 0,
  unmatched         jsonb       NOT NULL DEFAULT '[]',
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX import_runs_user_created ON public.import_runs (user_id, created_at DESC);

GRANT SELECT, INSERT ON public.import_runs TO authenticated;
GRANT ALL ON public.import_runs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.import_runs_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.import_runs_id_seq TO authenticated;

ALTER TABLE public.import_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_runs_select_own"
  ON public.import_runs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "import_runs_insert_own"
  ON public.import_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
-- ===== 20260709153416_ae01b070-03f8-46cc-b260-64d7e65044c1.sql =====

CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL    ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE POLICY "user_roles_select"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'chollet.eric@gmail.com'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)));

  IF NEW.email = 'chollet.eric@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- ===== 20260710065208_0937c4d2-0e52-4476-820f-a12eb10497f8.sql =====
ALTER TABLE public.shows ADD COLUMN IF NOT EXISTS backdrop_path text;
-- ===== 20260710070559_dfc21e2d-6476-4f27-87c9-944970ceed6f.sql =====
ALTER TABLE public.shows ADD COLUMN IF NOT EXISTS watch_providers jsonb DEFAULT '{}'; ALTER TABLE public.shows ADD COLUMN IF NOT EXISTS networks jsonb DEFAULT '[]';
-- ===== 20260710080500_a72c839e-4188-4e24-a84d-1ccdc89fe52d.sql =====
ALTER TABLE public.episodes ADD COLUMN IF NOT EXISTS still_path text;
-- ===== 20260710120000_import_runs.sql =====
-- Migration : table import_runs — historique des imports par utilisateur.
-- Chaque ligne correspond à un appel réussi à l'edge function import-history.
-- RLS stricte : lecture/insert uniquement pour l'utilisateur propriétaire,
-- service_role a tous les droits (nécessaire pour l'insert depuis l'edge function).

CREATE TABLE public.import_runs (
  id           bigserial PRIMARY KEY,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source       text        NOT NULL DEFAULT '',
  imported_episodes int    NOT NULL DEFAULT 0,
  followed_shows    int    NOT NULL DEFAULT 0,
  unmatched_count   int    NOT NULL DEFAULT 0,
  unmatched         jsonb  NOT NULL DEFAULT '[]',
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Index pour les requêtes courantes côté front (derniers runs d'un user)
CREATE INDEX import_runs_user_created ON public.import_runs (user_id, created_at DESC);

-- RLS
ALTER TABLE public.import_runs ENABLE ROW LEVEL SECURITY;

-- L'utilisateur peut voir uniquement ses propres runs
CREATE POLICY "import_runs_select_own"
  ON public.import_runs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- L'utilisateur peut insérer pour lui-même (utile pour de futurs appels directs)
CREATE POLICY "import_runs_insert_own"
  ON public.import_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- service_role bypasse RLS par défaut, mais on le documente explicitement
GRANT ALL ON public.import_runs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.import_runs_id_seq TO service_role;
-- authenticated : SELECT + INSERT seulement (pas UPDATE/DELETE)
GRANT SELECT, INSERT ON public.import_runs TO authenticated;

-- ===== 20260711000000_admin_roles.sql =====
-- ============================================================
-- Admin roles system
-- ============================================================

-- 1. Enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- 2. Table user_roles
CREATE TABLE public.user_roles (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL    ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Helper function (before policies that reference it)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- 4. RLS policies
CREATE POLICY "user_roles_select"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR user_id = auth.uid()
  );

-- 5. Seed admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'chollet.eric@gmail.com'
ON CONFLICT DO NOTHING;

-- 6. Extend handle_new_user trigger to auto-grant admin to known email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)));

  -- Auto-grant admin role to known admin email
  IF NEW.email = 'chollet.eric@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- ===== 20260711130000_watch_providers_ttl.sql =====
-- TTL court dédié à `watch_providers`, distinct du TTL 48h de la fiche
-- (`cached_at`) : la disponibilité streaming change plus vite que le reste
-- des métadonnées (cf. régression observée sur des titres récents où TMDb
-- avait déjà la dispo FR mais notre cache restait figé sur un instantané
-- vide jusqu'à 48h). `NULL` par défaut = à rafraîchir au prochain accès, pas
-- de backfill de masse (le rafraîchissement reste lazy, à la consultation).
ALTER TABLE public.shows
  ADD COLUMN IF NOT EXISTS providers_cached_at timestamptz;

-- ===== 20260712090000_watch_status_activity_rpc.sql =====
-- Dashboard admin (/admin) — fenêtre de migration TV Time (fermeture 15/07/2026).
--
-- Jusqu'ici, DAU/WAU/MAU et les compteurs d'épisodes vus étaient calculés sur
-- TOUT `watch_status.watched_at`, sans filtrer `watched_at_approximate`. Un
-- import de masse insère des lignes avec `watched_at = now()` et
-- `watched_at_approximate = true`, ce qui faisait passer un importeur pour un
-- utilisateur actif et faussait ces métriques précisément pendant le pic
-- d'imports qu'elles sont censées surveiller.
--
-- Cette migration ajoute :
-- 1. Un index composite pour que les requêtes fenêtrées (1j/7j/30j) filtrant
--    sur `watched_at_approximate` restent des scans indexés plutôt qu'un scan
--    complet de la table, y compris pendant le pic d'imports.
-- 2. Une fonction d'agrégation unique `admin_watch_activity` qui calcule en un
--    seul aller-retour, côté Postgres, le nombre d'utilisateurs distincts et
--    d'épisodes pour chacune des 3 fenêtres (1j/7j/30j) x 2 signaux (réel vs
--    import), au lieu de rapatrier les lignes brutes en Node pour dédupliquer
--    côté JS.
--
-- Réservée à service_role (edge functions / server functions admin) : elle
-- agrège des données tous utilisateurs confondus, jamais exposée en RPC
-- direct à authenticated/anon — même convention que compute_show_status.

CREATE INDEX watch_status_approx_watched_at_idx
  ON public.watch_status (watched_at_approximate, watched_at DESC);

CREATE OR REPLACE FUNCTION public.admin_watch_activity(_now timestamptz DEFAULT now())
RETURNS TABLE (
  window_label   text,
  is_approximate boolean,
  distinct_users bigint,
  episode_count  bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT w.window_label,
         w.is_approximate,
         count(DISTINCT ws.user_id)::bigint AS distinct_users,
         count(ws.id)::bigint AS episode_count
  FROM (
    VALUES
      ('1d',  _now - interval '1 day',  false),
      ('1d',  _now - interval '1 day',  true),
      ('7d',  _now - interval '7 days', false),
      ('7d',  _now - interval '7 days', true),
      ('30d', _now - interval '30 days', false),
      ('30d', _now - interval '30 days', true)
  ) AS w(window_label, since, is_approximate)
  LEFT JOIN public.watch_status ws
    ON ws.watched_at >= w.since
   AND ws.watched_at_approximate = w.is_approximate
  GROUP BY w.window_label, w.is_approximate;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_watch_activity(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_watch_activity(timestamptz) TO service_role;

-- ===== 20260712091500_import_runs_matching_columns.sql =====
-- Dashboard admin — taux de matching TMDb par run d'import.
--
-- `import_runs.unmatched_count` existe déjà mais son dénominateur (nombre
-- total de groupes titre/année rencontrés dans le run) n'était pas stocké.
-- `total_groups` comble ce manque ; le nombre de groupes matchés se déduit
-- toujours comme `total_groups - unmatched_count` (une seule source de
-- vérité, pas de colonne `matched_count` redondante qui pourrait diverger).
--
-- Additive et nullable : les runs déjà en base avant cette migration n'ont
-- pas ce dénominateur et ne l'auront jamais (non calculable rétroactivement
-- — le détail des groupes vus dans un run passé n'est pas conservé). Le
-- dashboard doit donc exclure les lignes `total_groups IS NULL` du calcul du
-- taux de matching, pas les traiter comme 0/0.

ALTER TABLE public.import_runs
  ADD COLUMN total_groups int NULL;

COMMENT ON COLUMN public.import_runs.total_groups IS
  'Nombre total de groupes (titre, année) rencontrés dans le run — dénominateur du taux de matching TMDb (matched = total_groups - unmatched_count). NULL pour les runs créés avant cette colonne : non calculable rétroactivement, à exclure du calcul du taux plutôt qu''à traiter comme 0.';

-- ===== 20260713072211_c028ff04-cabc-4a68-8309-1f641542d8d0.sql =====
ALTER TABLE public.watch_status
  ADD COLUMN watched_at_approximate boolean NOT NULL DEFAULT false;

CREATE INDEX watch_status_approx_watched_at_idx
  ON public.watch_status (watched_at_approximate, watched_at DESC);

CREATE OR REPLACE FUNCTION public.admin_watch_activity(_now timestamptz DEFAULT now())
RETURNS TABLE (
  window_label   text,
  is_approximate boolean,
  distinct_users bigint,
  episode_count  bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT w.window_label,
         w.is_approximate,
         count(DISTINCT ws.user_id)::bigint AS distinct_users,
         count(ws.id)::bigint AS episode_count
  FROM (
    VALUES
      ('1d',  _now - interval '1 day',  false),
      ('1d',  _now - interval '1 day',  true),
      ('7d',  _now - interval '7 days', false),
      ('7d',  _now - interval '7 days', true),
      ('30d', _now - interval '30 days', false),
      ('30d', _now - interval '30 days', true)
  ) AS w(window_label, since, is_approximate)
  LEFT JOIN public.watch_status ws
    ON ws.watched_at >= w.since
   AND ws.watched_at_approximate = w.is_approximate
  GROUP BY w.window_label, w.is_approximate;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_watch_activity(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_watch_activity(timestamptz) TO service_role;

ALTER TABLE public.import_runs
  ADD COLUMN total_groups int NULL;
-- ===== 20260717113657_311b1fd5-2fe1-4ded-b266-80f20e1fc64a.sql =====
ALTER TABLE public.shows ADD COLUMN IF NOT EXISTS providers_cached_at timestamptz;
-- ===== 20260718070748_268c0c09-0470-4cfc-93a4-40f92c226b20.sql =====

CREATE TABLE public.show_ratings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  show_id integer NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, show_id)
);

GRANT SELECT ON public.show_ratings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.show_ratings TO authenticated;
GRANT ALL ON public.show_ratings TO service_role;

ALTER TABLE public.show_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ratings are viewable by everyone"
  ON public.show_ratings FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own rating"
  ON public.show_ratings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rating"
  ON public.show_ratings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own rating"
  ON public.show_ratings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX show_ratings_show_id_idx ON public.show_ratings(show_id);

CREATE OR REPLACE FUNCTION public.update_show_ratings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_show_ratings_updated_at
BEFORE UPDATE ON public.show_ratings
FOR EACH ROW EXECUTE FUNCTION public.update_show_ratings_updated_at();

-- ===== 20260724094419_9d0d44c5-431e-4c98-b2f9-522e2a7ca5e7.sql =====

-- 1. show_ratings: restrict SELECT to owner only
DROP POLICY IF EXISTS "Ratings are viewable by everyone" ON public.show_ratings;
CREATE POLICY "Users can view their own rating"
  ON public.show_ratings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 2. Revoke EXECUTE from anon/authenticated on internal SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.apply_computed_status(integer, uuid, boolean) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.compute_show_status(integer, uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.compute_tv_status(integer, uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_episodes_recompute() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_seasons_recompute() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_shows_recompute() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_user_shows_manual_override_recompute() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_watch_status_recompute() FROM anon, authenticated, PUBLIC;

-- 3. Set immutable search_path on update_show_ratings_updated_at
CREATE OR REPLACE FUNCTION public.update_show_ratings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- ===== 20260804071040_d2c73590-88d0-418c-9e28-8731e235684b.sql =====
-- 1. Lock down SECURITY DEFINER / helper functions
REVOKE ALL ON FUNCTION public.compute_my_show_status(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compute_my_show_status(int) TO authenticated;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- Trigger-only function: must never be callable through the API
REVOKE ALL ON FUNCTION public.update_show_ratings_updated_at() FROM PUBLIC, anon, authenticated;

-- 2. Fix mutable search_path + restrict admin metrics function
ALTER FUNCTION public.admin_watch_activity(timestamp with time zone) SET search_path = public;
REVOKE ALL ON FUNCTION public.admin_watch_activity(timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_watch_activity(timestamp with time zone) TO service_role;

-- 3. user_roles: explicitly deny all writes, allow read only
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.user_roles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.user_roles FROM anon;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
-- ===== 20260804081039_1d56f72c-a976-424c-b6c4-e4ab6a5e8e06.sql =====
-- 1) Move has_role out of the exposed API schema
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

DROP POLICY IF EXISTS user_roles_select ON public.user_roles;
CREATE POLICY user_roles_select ON public.user_roles
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR user_id = auth.uid());

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

-- 2) compute_my_show_status becomes SECURITY INVOKER (own data only, RLS applies)
CREATE OR REPLACE FUNCTION public.compute_my_show_status(p_show_id integer)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_media_type text;
  v_show_status text;
  v_total_known int;
  v_has_null_count boolean;
  v_watched_count int;
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT media_type, status INTO v_media_type, v_show_status
  FROM public.shows WHERE id = p_show_id;

  IF v_media_type IS DISTINCT FROM 'tv' THEN
    RETURN NULL;
  END IF;

  SELECT
    COALESCE(bool_or(episode_count IS NULL), false),
    COALESCE(sum(episode_count), 0)
  INTO v_has_null_count, v_total_known
  FROM public.seasons
  WHERE show_id = p_show_id;

  IF v_has_null_count THEN
    v_total_known := NULL;
  END IF;

  SELECT count(*)
  INTO v_watched_count
  FROM public.watch_status ws
  JOIN public.episodes e ON e.id = ws.episode_id
  WHERE ws.user_id = v_user
    AND e.show_id = p_show_id;

  IF v_watched_count = 0 THEN
    RETURN 'a_voir';
  END IF;

  IF v_total_known IS NOT NULL
     AND v_total_known > 0
     AND v_watched_count >= v_total_known
     AND v_show_status IN ('Ended', 'Canceled') THEN
    RETURN 'termine';
  END IF;

  RETURN 'en_cours';
END;
$$;

REVOKE ALL ON FUNCTION public.compute_my_show_status(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compute_my_show_status(integer) TO authenticated;
-- ===== 20260804084909_1cf43092-9c07-4158-90eb-a1430d556ab3.sql =====
ALTER TABLE public.import_runs
  ADD COLUMN IF NOT EXISTS unmatched_items jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS resolved_keys   jsonb NOT NULL DEFAULT '[]';

DROP POLICY IF EXISTS "import_runs_update_own" ON public.import_runs;
CREATE POLICY "import_runs_update_own"
  ON public.import_runs
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT UPDATE ON public.import_runs TO authenticated;
