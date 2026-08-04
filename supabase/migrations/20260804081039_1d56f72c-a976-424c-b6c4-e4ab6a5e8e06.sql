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