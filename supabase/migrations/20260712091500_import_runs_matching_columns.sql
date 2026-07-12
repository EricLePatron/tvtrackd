-- Dashboard admin — taux de matching TMDb par run d'import.
--
-- `import_runs.unmatched_count` existe déjà mais son dénominateur (nombre
-- total de groupes titre/année rencontrés dans le run) n'était pas stocké.
-- `total_groups` comble ce manque ; le nombre de groupes matchés se déduit
-- toujours comme `total_groups - unmatched_count` (une seule source de
-- vérité, pas de colonne `matched_count` redondante qui pourrait diverger).
--
-- Additive et nullable : les runs déjà en base avant cette migration n'ont
-- pas ce dénominateur et ne l'auront jamais (non calculable rétroactivement
-- — le détail des groupes vus dans un run passé n'est pas conservé). Le
-- dashboard doit donc exclure les lignes `total_groups IS NULL` du calcul du
-- taux de matching, pas les traiter comme 0/0.

ALTER TABLE public.import_runs
  ADD COLUMN total_groups int NULL;

COMMENT ON COLUMN public.import_runs.total_groups IS
  'Nombre total de groupes (titre, année) rencontrés dans le run — dénominateur du taux de matching TMDb (matched = total_groups - unmatched_count). NULL pour les runs créés avant cette colonne : non calculable rétroactivement, à exclure du calcul du taux plutôt qu''à traiter comme 0.';
