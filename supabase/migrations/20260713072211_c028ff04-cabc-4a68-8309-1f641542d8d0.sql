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