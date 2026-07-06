-- Métadonnées TMDb supplémentaires sur shows (note, genres, tagline)
ALTER TABLE public.shows
  ADD COLUMN IF NOT EXISTS genres text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS vote_average numeric,
  ADD COLUMN IF NOT EXISTS tagline text;

-- Force le refetch des fiches déjà en cache pour récupérer ces nouveaux champs
UPDATE public.shows SET cached_at = 'epoch';
