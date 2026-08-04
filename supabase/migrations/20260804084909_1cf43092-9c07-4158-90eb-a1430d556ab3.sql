ALTER TABLE public.import_runs
  ADD COLUMN IF NOT EXISTS unmatched_items jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS resolved_keys   jsonb NOT NULL DEFAULT '[]';

DROP POLICY IF EXISTS "import_runs_update_own" ON public.import_runs;
CREATE POLICY "import_runs_update_own"
  ON public.import_runs
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT UPDATE ON public.import_runs TO authenticated;