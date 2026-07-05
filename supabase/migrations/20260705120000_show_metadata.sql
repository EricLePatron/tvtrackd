-- Métadonnées TMDb supplémentaires sur shows (note, genres, tagline)
ALTER TABLE public.shows
  ADD COLUMN genres text[] NOT NULL DEFAULT '{}',
  ADD COLUMN vote_average numeric,
  ADD COLUMN tagline text;

-- Force le refetch des fiches déjà en cache pour récupérer ces nouveaux champs
UPDATE public.shows SET cached_at = 'epoch';
