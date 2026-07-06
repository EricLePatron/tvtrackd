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
