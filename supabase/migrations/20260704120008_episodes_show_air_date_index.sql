-- Perf: the /calendar timeline (bidirectional scroll, unlimited backward
-- pagination) filters episodes by `show_id IN (...) AND air_date BETWEEN ...`
-- repeatedly as the user scrolls back in time. The existing unique
-- constraint on (show_id, season_number, episode_number) only helps the
-- show_id lookup; add a composite index that directly serves this range
-- query pattern on the shared `episodes` cache table.
CREATE INDEX IF NOT EXISTS episodes_show_id_air_date_idx
  ON public.episodes (show_id, air_date);
