ALTER TABLE public.shows
  ADD COLUMN genres text[] NOT NULL DEFAULT '{}',
  ADD COLUMN vote_average numeric,
  ADD COLUMN tagline text;

UPDATE public.shows SET cached_at = 'epoch';