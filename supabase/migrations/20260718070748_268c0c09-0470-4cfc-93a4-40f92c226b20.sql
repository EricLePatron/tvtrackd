
CREATE TABLE public.show_ratings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  show_id integer NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, show_id)
);

GRANT SELECT ON public.show_ratings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.show_ratings TO authenticated;
GRANT ALL ON public.show_ratings TO service_role;

ALTER TABLE public.show_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ratings are viewable by everyone"
  ON public.show_ratings FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own rating"
  ON public.show_ratings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rating"
  ON public.show_ratings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own rating"
  ON public.show_ratings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX show_ratings_show_id_idx ON public.show_ratings(show_id);

CREATE OR REPLACE FUNCTION public.update_show_ratings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_show_ratings_updated_at
BEFORE UPDATE ON public.show_ratings
FOR EACH ROW EXECUTE FUNCTION public.update_show_ratings_updated_at();
