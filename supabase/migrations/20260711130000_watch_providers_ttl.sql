-- TTL court dédié à `watch_providers`, distinct du TTL 48h de la fiche
-- (`cached_at`) : la disponibilité streaming change plus vite que le reste
-- des métadonnées (cf. régression observée sur des titres récents où TMDb
-- avait déjà la dispo FR mais notre cache restait figé sur un instantané
-- vide jusqu'à 48h). `NULL` par défaut = à rafraîchir au prochain accès, pas
-- de backfill de masse (le rafraîchissement reste lazy, à la consultation).
ALTER TABLE public.shows
  ADD COLUMN IF NOT EXISTS providers_cached_at timestamptz;
