
-- profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- shows (cache partagé, lecture publique)
CREATE TABLE public.shows (
  id serial PRIMARY KEY,
  tmdb_id int UNIQUE NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('tv','movie')),
  title text NOT NULL,
  poster_path text,
  overview text,
  first_air_date date,
  status text,
  cached_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shows TO anon, authenticated;
GRANT ALL ON public.shows TO service_role;
ALTER TABLE public.shows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shows_public_read" ON public.shows FOR SELECT TO anon, authenticated USING (true);

-- seasons
CREATE TABLE public.seasons (
  id serial PRIMARY KEY,
  show_id int NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
  season_number int NOT NULL,
  episode_count int,
  UNIQUE (show_id, season_number)
);
GRANT SELECT ON public.seasons TO anon, authenticated;
GRANT ALL ON public.seasons TO service_role;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seasons_public_read" ON public.seasons FOR SELECT TO anon, authenticated USING (true);

-- episodes
CREATE TABLE public.episodes (
  id serial PRIMARY KEY,
  show_id int NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
  season_number int NOT NULL,
  episode_number int NOT NULL,
  title text,
  air_date date,
  overview text,
  UNIQUE (show_id, season_number, episode_number)
);
GRANT SELECT ON public.episodes TO anon, authenticated;
GRANT ALL ON public.episodes TO service_role;
ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "episodes_public_read" ON public.episodes FOR SELECT TO anon, authenticated USING (true);

-- user_shows
CREATE TABLE public.user_shows (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  show_id int NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('a_voir','en_cours','termine','abandonne','archive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, show_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_shows TO authenticated;
GRANT ALL ON public.user_shows TO service_role;
ALTER TABLE public.user_shows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_shows_select_own" ON public.user_shows FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_shows_insert_own" ON public.user_shows FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_shows_update_own" ON public.user_shows FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_shows_delete_own" ON public.user_shows FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- watch_status
CREATE TABLE public.watch_status (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  episode_id int NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  watch_count int NOT NULL DEFAULT 1,
  watched_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watch_status TO authenticated;
GRANT ALL ON public.watch_status TO service_role;
ALTER TABLE public.watch_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "watch_status_select_own" ON public.watch_status FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "watch_status_insert_own" ON public.watch_status FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "watch_status_update_own" ON public.watch_status FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "watch_status_delete_own" ON public.watch_status FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
