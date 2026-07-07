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
