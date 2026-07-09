CREATE TABLE public.import_runs (
  id                bigserial PRIMARY KEY,
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source            text        NOT NULL DEFAULT '',
  imported_episodes int         NOT NULL DEFAULT 0,
  followed_shows    int         NOT NULL DEFAULT 0,
  unmatched_count   int         NOT NULL DEFAULT 0,
  unmatched         jsonb       NOT NULL DEFAULT '[]',
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX import_runs_user_created ON public.import_runs (user_id, created_at DESC);

GRANT SELECT, INSERT ON public.import_runs TO authenticated;
GRANT ALL ON public.import_runs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.import_runs_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.import_runs_id_seq TO authenticated;

ALTER TABLE public.import_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_runs_select_own"
  ON public.import_runs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "import_runs_insert_own"
  ON public.import_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());