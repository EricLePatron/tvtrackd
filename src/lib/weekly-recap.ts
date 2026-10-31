import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * Récap « ma semaine » : lundi → dimanche en heure locale, épisodes
 * uniquement. `watch_status` porte une ligne par épisode (watched_at = dernier
 * visionnage) : un revisionnage de la semaine met `watched_at` à jour et est
 * donc compté, à raison de 1 par épisode. Les dates approximatives issues d'un
 * import (`watched_at_approximate`) sont exclues pour ne pas inventer
 * d'activité. Aucune table dédiée : tout se calcule depuis `watch_status`.
 */

/** Seuil d'affichage du bloc « Ma semaine » sur l'accueil. */
export const WEEKLY_RECAP_MIN_EPISODES = 3;

export type RecapRow = {
  watched_at: string;
  watched_at_approximate: boolean;
  show_id: number;
  title: string;
  poster_path: string | null;
};

export type WeeklyRecap = {
  start: Date;
  end: Date;
  episodes: number;
  showsCount: number;
  /** Séries les plus vues, ordre décroissant (affiches de la carte). */
  topShows: { showId: number; title: string; posterPath: string | null; count: number }[];
  rangeLabel: string;
};

export function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const MONTHS = [
  "JANV.",
  "FÉVR.",
  "MARS",
  "AVR.",
  "MAI",
  "JUIN",
  "JUIL.",
  "AOÛT",
  "SEPT.",
  "OCT.",
  "NOV.",
  "DÉC.",
];

/** « 20 → 26 OCT. » ou « 28 OCT. → 3 NOV. » quand la semaine chevauche deux mois. */
export function weekRangeLabel(start: Date, end: Date): string {
  const sameMonth = start.getMonth() === end.getMonth();
  const from = sameMonth ? `${start.getDate()}` : `${start.getDate()} ${MONTHS[start.getMonth()]}`;
  return `${from} → ${end.getDate()} ${MONTHS[end.getMonth()]}`;
}

export function computeWeeklyRecap(
  rows: ReadonlyArray<RecapRow>,
  now: Date = new Date(),
): WeeklyRecap {
  const start = startOfWeek(now);
  const nextMonday = addDays(start, 7);
  const end = addDays(start, 6);

  const perShow = new Map<number, { title: string; posterPath: string | null; count: number }>();
  let episodes = 0;
  for (const r of rows) {
    if (r.watched_at_approximate) continue;
    const t = new Date(r.watched_at);
    if (!(t >= start && t < nextMonday)) continue;
    episodes += 1;
    const prev = perShow.get(r.show_id);
    if (prev) prev.count += 1;
    else perShow.set(r.show_id, { title: r.title, posterPath: r.poster_path, count: 1 });
  }

  const topShows = [...perShow.entries()]
    .map(([showId, v]) => ({ showId, ...v }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, "fr"));

  return {
    start,
    end,
    episodes,
    showsCount: perShow.size,
    topShows,
    rangeLabel: weekRangeLabel(start, end),
  };
}

type RawRow = {
  watched_at: string;
  watched_at_approximate: boolean;
  episode: { show_id: number; show: { title: string; poster_path: string | null } };
};

export function useWeeklyRecap(userId?: string) {
  return useQuery({
    queryKey: ["weekly-recap", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<WeeklyRecap> => {
      const start = startOfWeek(new Date());
      const { data, error } = await supabase
        .from("watch_status")
        .select(
          "watched_at, watched_at_approximate, episode:episodes!inner(show_id, show:shows!inner(title, poster_path))",
        )
        .eq("user_id", userId!)
        .eq("watched_at_approximate", false)
        .gte("watched_at", start.toISOString())
        .limit(1000);
      if (error) throw error;
      const rows = ((data ?? []) as unknown as RawRow[]).map((r) => ({
        watched_at: r.watched_at,
        watched_at_approximate: r.watched_at_approximate,
        show_id: r.episode.show_id,
        title: r.episode.show.title,
        poster_path: r.episode.show.poster_path,
      }));
      return computeWeeklyRecap(rows);
    },
  });
}
