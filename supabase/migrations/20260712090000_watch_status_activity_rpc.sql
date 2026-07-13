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
