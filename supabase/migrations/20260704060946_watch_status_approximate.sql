-- Distingue une date de visionnage réelle (saisie granulaire, tracking manuel)
-- d'une date approximative reconstituée lors d'un import agrégé (ex. export
-- Betaseries, qui ne fournit qu'un dernier épisode vu et un statut de complétion,
-- sans date par épisode). Additif uniquement : aucune contrainte existante modifiée.
ALTER TABLE public.watch_status
  ADD COLUMN watched_at_approximate boolean NOT NULL DEFAULT false;
