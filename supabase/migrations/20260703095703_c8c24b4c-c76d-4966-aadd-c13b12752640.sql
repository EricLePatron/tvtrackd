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