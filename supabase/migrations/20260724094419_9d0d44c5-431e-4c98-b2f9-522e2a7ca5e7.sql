
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
