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