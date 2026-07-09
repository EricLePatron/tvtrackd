-- Migration : table import_runs — historique des imports par utilisateur.
-- Chaque ligne correspond à un appel réussi à l'edge function import-history.
-- RLS stricte : lecture/insert uniquement pour l'utilisateur propriétaire,
-- service_role a tous les droits (nécessaire pour l'insert depuis l'edge function).

CREATE TABLE public.import_runs (
  id           bigserial PRIMARY KEY,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source       text        NOT NULL DEFAULT '',
  imported_episodes int    NOT NULL DEFAULT 0,
  followed_shows    int    NOT NULL DEFAULT 0,
  unmatched_count   int    NOT NULL DEFAULT 0,
  unmatched         jsonb  NOT NULL DEFAULT '[]',
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Index pour les requêtes courantes côté front (derniers runs d'un user)
CREATE INDEX import_runs_user_created ON public.import_runs (user_id, created_at DESC);

-- RLS
ALTER TABLE public.import_runs ENABLE ROW LEVEL SECURITY;

-- L'utilisateur peut voir uniquement ses propres runs
CREATE POLICY "import_runs_select_own"
  ON public.import_runs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- L'utilisateur peut insérer pour lui-même (utile pour de futurs appels directs)
CREATE POLICY "import_runs_insert_own"
  ON public.import_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- service_role bypasse RLS par défaut, mais on le documente explicitement
GRANT ALL ON public.import_runs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.import_runs_id_seq TO service_role;
-- authenticated : SELECT + INSERT seulement (pas UPDATE/DELETE)
GRANT SELECT, INSERT ON public.import_runs TO authenticated;
