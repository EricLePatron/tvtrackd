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