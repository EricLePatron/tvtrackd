-- Watch providers (streaming/location/achat) + chaînes de diffusion (networks)
-- Source : TMDb /watch/providers (motorisé par JustWatch) et /tv/{id}.networks.
ALTER TABLE public.shows
  ADD COLUMN IF NOT EXISTS watch_providers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS networks jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Force le refetch des fiches déjà en cache pour récupérer ces nouveaux champs
UPDATE public.shows SET cached_at = 'epoch';
