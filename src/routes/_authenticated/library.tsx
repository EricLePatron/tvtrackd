import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { z } from "zod";
import { Check } from "lucide-react";
import { ScreenHeader, EmptyPanel } from "@/components/screen-header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { VhsCounter } from "@/components/vhs-counter";
import { StatusPill, type PillTone } from "@/components/status-pill";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildLastWatchedAtByShow,
  buildLibraryProgress,
  splitEnCoursByFreshness,
  type ScheduleEpisode,
} from "@/lib/schedule";
import { compareLibraryRows } from "@/lib/library-sort";

const STATUSES = [
  { key: "a_voir", label: "À voir" },
  { key: "en_cours", label: "En cours" },
  { key: "termine", label: "Terminé" },
  { key: "abandonne", label: "Abandonné" },
  { key: "archive", label: "Archivé" },
] as const;

type StatusKey = (typeof STATUSES)[number]["key"];

// Tab-pastille tones — cf. décision produit : en_cours=amber, termine=cyan,
// le reste (a_voir/abandonne/archive) en muted par défaut. Purement
// présentational, sans lien avec `tvPillState` (logique métier de la fiche
// série, non réutilisée ici).
const STATUS_TONE: Record<StatusKey, PillTone> = {
  a_voir: "muted",
  en_cours: "amber",
  termine: "cyan",
  abandonne: "muted",
  archive: "muted",
};

const SORT_OPTIONS = [
  { key: "activite", label: "Activité récente" },
  { key: "progression", label: "Progression" },
  { key: "titre", label: "Titre A→Z" },
  { key: "ajout", label: "Date d'ajout" },
  { key: "sortie", label: "Sortie récente" },
] as const;

type SortKey = (typeof SORT_OPTIONS)[number]["key"];
const DEFAULT_SORT: SortKey = "activite";

const librarySearchSchema = z.object({
  status: z.enum(["a_voir", "en_cours", "termine", "abandonne", "archive"]).optional(),
  sort: z.enum(["activite", "progression", "titre", "ajout", "sortie"]).optional(),
});

export const Route = createFileRoute("/_authenticated/library")({
  // Same defensive try/catch as /auth's validateSearch: a malformed/garbage
  // `?status=`/`?sort=` (typo'd link, stale bookmark) falls back to `{}` (→
  // the component's own defaults) rather than blowing up the whole route via
  // the root errorComponent.
  validateSearch: (search: Record<string, unknown>) => {
    try {
      return librarySearchSchema.parse(search);
    } catch {
      return {};
    }
  },
  component: LibraryScreen,
});

type Row = {
  id: number;
  status: string;
  created_at: string;
  show: {
    id: number;
    tmdb_id: number;
    media_type: string;
    title: string;
    poster_path: string | null;
    first_air_date: string | null;
  } | null;
};

function LibraryScreen() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [active, setActive] = useState<StatusKey>(search.status ?? "en_cours");
  const [sort, setSort] = useState<SortKey>(search.sort ?? DEFAULT_SORT);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Bidirectional sync: the URL can drive the active tab/sort (e.g. Home's
  // "Voir tout · à reprendre" link landing here with `?status=en_cours`), and
  // — via handleTabChange/handleSortChange below — they also drive the URL,
  // so the current filter+sort stay bookmarkable/shareable and survive a
  // back-navigation. Guarded on an actual mismatch so this never fights with
  // the handlers' own `navigate` (which always lands here with
  // `search.status === active` / `search.sort === sort` already, a no-op on
  // the next render).
  useEffect(() => {
    if (search.status && search.status !== active) {
      setActive(search.status);
    }
  }, [search.status, active]);
  useEffect(() => {
    if (search.sort && search.sort !== sort) {
      setSort(search.sort);
    }
  }, [search.sort, sort]);

  const handleTabChange = (key: StatusKey) => {
    setActive(key);
    navigate({ search: { status: key, sort }, replace: true });
  };

  const handleSortChange = (key: SortKey) => {
    setSort(key);
    navigate({ search: { status: active, sort: key }, replace: true });
  };

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["library", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_shows")
        .select(
          "id, status, created_at, show:shows(id, tmdb_id, media_type, title, poster_path, first_air_date)",
        )
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const counts: Record<string, number> = {};
  for (const s of STATUSES) counts[s.key] = 0;
  rows.forEach((r) => {
    counts[r.status] = (counts[r.status] ?? 0) + 1;
  });

  const filtered = useMemo(
    () =>
      rows.filter(
        (r): r is Row & { show: NonNullable<Row["show"]> } => r.status === active && !!r.show,
      ),
    [rows, active],
  );

  // Show ids of the CURRENT tab only — scopes the "En cours" progress query
  // further down. Sorted for a stable query key.
  const activeShowIds = useMemo(
    () => filtered.map((r) => r.show.id).sort((a, b) => a - b),
    [filtered],
  );

  // Show ids of the WHOLE library (every tab), sorted — the recency query key
  // below. Keyed on the full set (not the active tab) so it's fetched ONCE and
  // reused across tab switches: switching tabs never refetches it, so the
  // default "Activité récente" order and the Actif/En pause split are stable
  // (no re-sort flash) as soon as the library has loaded.
  const allShowIds = useMemo(
    () =>
      rows
        .filter((r) => r.show)
        .map((r) => r.show!.id)
        .sort((a, b) => a - b),
    [rows],
  );

  // Lightweight "last watched per show" query — feeds the default "Activité
  // récente" sort on EVERY tab, and (only on "En cours") the Actif/En pause
  // freshness split. Deliberately NOT the heavy per-episode progress query
  // below (which stays scoped to "En cours" only, cf. product decision):
  // this mirrors the Home screen's own dedicated recency query
  // (src/routes/_public/index.tsx) — one row per *watched* episode of a
  // followed show, not a full episode fetch, so its cost scales with watch
  // history, not with series length.
  const { data: lastWatchedAtByShowId = new Map<number, string>(), isLoading: recencyLoading } =
    useQuery({
      queryKey: ["library-recency", user?.id, allShowIds],
      enabled: !!user && allShowIds.length > 0,
      queryFn: async () => {
        const { data, error } = await supabase
          .from("watch_status")
          .select("watched_at, episode:episodes!inner(show_id)")
          .eq("user_id", user!.id)
          .in("episode.show_id", allShowIds);
        if (error) throw error;
        return buildLastWatchedAtByShow(
          (data as unknown as { watched_at: string; episode: { show_id: number } }[]).map((r) => ({
            show_id: r.episode.show_id,
            watched_at: r.watched_at,
          })),
        );
      },
    });

  // Progress data (compteur S·E) — scoped to the "En cours" tab ONLY, per
  // product decision: "Terminé" renders a static "Vue" chip (no query
  // needed, every row there is already fully watched by definition of the
  // status), "À voir"/"Abandonné"/"Archive" render no chip at all. Keeping
  // this scoped avoids fetching every followed show's full episode list just
  // to paint a chip nobody sees outside "En cours".
  const { data: progressData, isLoading: progressLoading } = useQuery({
    queryKey: ["library-progress", user?.id, activeShowIds],
    enabled: !!user && active === "en_cours" && activeShowIds.length > 0,
    queryFn: async () => {
      // Unlike the home screen's episodes query (src/routes/_public/index.tsx),
      // this one cannot be bounded to a time window: buildLibraryProgress needs
      // the *whole* show (all seasons) to walk back to the first unwatched
      // episode and to size the current season's total, which can include
      // not-yet-aired episodes. The unbounded payload is accepted for the MVP's
      // low volume, but an explicit season/episode order means that if
      // PostgREST's default row cap (commonly 1000) ever truncates the result,
      // it drops the *tail* of a deterministically sorted list (later
      // seasons/episodes) rather than an arbitrary DB-order slice — keeping
      // buildLibraryProgress's "first unwatched episode" resolution correct for
      // as many shows as possible instead of silently corrupting it.
      const { data: eps, error: epsError } = await supabase
        .from("episodes")
        .select(
          "id, season_number, episode_number, title, air_date, show:shows!inner(id, tmdb_id, media_type, title, poster_path)",
        )
        .in("show_id", activeShowIds)
        .order("season_number", { ascending: true })
        .order("episode_number", { ascending: true });
      if (epsError) throw epsError;

      const episodes = (eps ?? []) as unknown as ScheduleEpisode[];
      const epIds = episodes.map((e) => e.id);
      const { data: watched, error: watchedError } = epIds.length
        ? await supabase
            .from("watch_status")
            .select("episode_id")
            .eq("user_id", user!.id)
            .in("episode_id", epIds)
        : { data: [], error: null };
      if (watchedError) throw watchedError;

      const watchedSet = new Set((watched ?? []).map((w) => w.episode_id));
      return buildLibraryProgress(episodes, watchedSet, today);
    },
  });

  // Actif/En pause split (En cours tab only) — same freshness rule/threshold
  // as Home's hero/Reprendre split (`selectHero`), applied here to EVERY
  // en_cours show (hero included), not just the non-hero ones Home renders.
  const { dormant: dormantShowIds } = useMemo(
    () =>
      active === "en_cours"
        ? splitEnCoursByFreshness(activeShowIds, today, lastWatchedAtByShowId)
        : { active: [], dormant: [] },
    [active, activeShowIds, today, lastWatchedAtByShowId],
  );
  const dormantShowIdSet = useMemo(() => new Set(dormantShowIds), [dormantShowIds]);

  // "Progression" only means something on "En cours" (the only tab with the
  // per-episode backlog data it sorts on). Rather than let the Select keep
  // showing "Progression" while silently sorting alphabetically on other tabs,
  // it's hidden there and the effective sort falls back to the default — the
  // stored `sort` (and the URL) is preserved, so switching back to En cours
  // restores it.
  const progressionAvailable = active === "en_cours";
  const effectiveSort: SortKey =
    !progressionAvailable && sort === "progression" ? DEFAULT_SORT : sort;
  const visibleSortOptions = useMemo(
    () =>
      progressionAvailable ? SORT_OPTIONS : SORT_OPTIONS.filter((o) => o.key !== "progression"),
    [progressionAvailable],
  );

  const sortedFiltered = useMemo(() => {
    const seriesRemainingByShowId =
      active === "en_cours" ? progressData?.seriesRemainingByShowId : undefined;
    return [...filtered].sort((a, b) =>
      compareLibraryRows(a, b, effectiveSort, { lastWatchedAtByShowId, seriesRemainingByShowId }),
    );
  }, [filtered, effectiveSort, lastWatchedAtByShowId, progressData, active]);

  const enCoursActiveRows = useMemo(
    () =>
      active === "en_cours" ? sortedFiltered.filter((r) => !dormantShowIdSet.has(r.show!.id)) : [],
    [active, sortedFiltered, dormantShowIdSet],
  );
  const enCoursDormantRows = useMemo(
    () =>
      active === "en_cours" ? sortedFiltered.filter((r) => dormantShowIdSet.has(r.show!.id)) : [],
    [active, sortedFiltered, dormantShowIdSet],
  );

  const buildChip = (showId: number): CardChip | undefined => {
    if (active === "termine") return { kind: "vue" };
    if (active !== "en_cours") return undefined;
    if (progressLoading) return { kind: "loading" };
    const isDormant = dormantShowIdSet.has(showId);
    const entry = progressData?.progressByShowId.get(showId);
    if (entry) {
      return {
        kind: "progress",
        tone: isDormant ? "muted" : "amber",
        seasonNumber: entry.nextEpisode.season_number,
        episodeNumber: entry.nextEpisode.episode_number,
        watched: entry.seasonWatched,
        total: entry.seasonTotal,
      };
    }
    if (progressData?.knownShowIds.has(showId)) {
      const caughtUpSeason = progressData.caughtUpSeasonByShowId.get(showId);
      if (caughtUpSeason !== undefined) {
        return {
          kind: "caughtUp",
          tone: isDormant ? "muted" : "cyan",
          seasonNumber: caughtUpSeason,
        };
      }
    }
    // No cached episode data at all for this show (e.g. just followed, sync
    // pending) — still on "En cours", so still reserve the chip's h-7 slot
    // (an invisible placeholder) rather than `undefined`: every other card
    // in this tab has a chip, and an entirely missing block here would break
    // the grid's row-by-row alignment (cf. LibraryCard's fixed-height note).
    return { kind: "empty" };
  };

  return (
    <>
      <ScreenHeader eyebrow="Ma collection" title="Bibliothèque">
        Vos suivis, filtrés par statut — l'archive garde tout l'historique.
      </ScreenHeader>

      <div className="px-5">
        <div className="-mx-1 overflow-x-auto">
          <div className="flex gap-2 px-1 pb-2">
            {STATUSES.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => handleTabChange(s.key)}
                // -my-2 py-2 : élargit la zone de clic (~44px de haut, cf. revue
                // accessibilité) sans repousser la pastille visuelle ni gonfler
                // la hauteur de la rangée.
                className="shrink-0 -my-2 py-2"
              >
                <StatusPill
                  label={s.label}
                  tone={STATUS_TONE[s.key]}
                  count={counts[s.key] ?? 0}
                  active={active === s.key}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Barre de tri, discrète, sous les onglets. */}
        <div className="mb-1 flex items-center justify-end gap-2">
          <span className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
            Trier
          </span>
          <Select value={effectiveSort} onValueChange={(v) => handleSortChange(v as SortKey)}>
            <SelectTrigger className="h-9 w-auto min-w-[160px] gap-1.5 rounded-md border-border bg-card px-2.5 text-[11px] text-foreground data-[state=open]:border-primary">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {visibleSortOptions.map((o) => (
                <SelectItem key={o.key} value={o.key} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading || (filtered.length > 0 && recencyLoading) ? (
          // Hold a stable skeleton until BOTH the library rows and the (global,
          // one-shot) recency data are in: the default "Activité récente" order
          // and the Actif/En pause split both depend on recency, so painting
          // before it resolves would show cards that then re-sort/re-group — the
          // cold-load flash flagged in review. Recency is fetched once and
          // cached across tabs, so this skeleton only appears on the library's
          // first load, not on every tab switch.
          <SkeletonGrid />
        ) : filtered.length === 0 ? (
          <EmptyState status={active} />
        ) : active === "en_cours" ? (
          <>
            {enCoursActiveRows.length > 0 && (
              <LibrarySection title="Actif">
                {enCoursActiveRows.map((r) => (
                  <LibraryCard key={r.id} show={r.show!} chip={buildChip(r.show!.id)} />
                ))}
              </LibrarySection>
            )}
            {enCoursDormantRows.length > 0 && (
              <LibrarySection title="En pause">
                {enCoursDormantRows.map((r) => (
                  <LibraryCard key={r.id} show={r.show!} chip={buildChip(r.show!.id)} />
                ))}
              </LibrarySection>
            )}
          </>
        ) : (
          <div className="mt-5 grid grid-cols-3 gap-3">
            {sortedFiltered.map((r) => (
              <LibraryCard key={r.id} show={r.show!} chip={buildChip(r.show!.id)} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function SkeletonGrid() {
  return (
    <div className="mt-5 grid grid-cols-3 gap-3" aria-hidden="true">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i}>
          <div className="aspect-[2/3] animate-pulse rounded-lg bg-surface-elevated" />
          <div className="mt-1.5 h-4 w-4/5 animate-pulse rounded bg-surface-elevated" />
        </div>
      ))}
    </div>
  );
}

function LibrarySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-5">
      <p className="mb-2 font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
        {title}
      </p>
      <div className="grid grid-cols-3 gap-3">{children}</div>
    </div>
  );
}

const EMPTY_COPY: Record<StatusKey, { hint: string }> = {
  a_voir: {
    hint: "Rien à voir pour l'instant. Suivez une série depuis la recherche : elle atterrit ici tant que vous n'avez rien commencé.",
  },
  en_cours: {
    hint: "Aucune série en cours. Dès que vous marquez un épisode vu, la série apparaît ici avec son compteur.",
  },
  termine: {
    hint: "Aucune série terminée pour l'instant.",
  },
  abandonne: {
    hint: "Aucune série abandonnée — tant mieux.",
  },
  archive: {
    hint: "Rien n'est archivé. Et si vous archivez un jour une série, son historique de visionnage reste intact — rien n'est jamais perdu, tout reste exportable.",
  },
};

function EmptyState({ status }: { status: StatusKey }) {
  const label = STATUSES.find((s) => s.key === status)?.label ?? status;
  return (
    <div className="mt-5">
      <EmptyPanel
        label={label}
        stat="00"
        hint={EMPTY_COPY[status].hint}
        action={
          status === "archive" ? (
            <Link
              to="/profile"
              className="inline-flex items-center gap-1.5 font-counter text-[10px] uppercase tracking-widest text-primary"
            >
              Exporter mes données ›
            </Link>
          ) : undefined
        }
      />
    </div>
  );
}

type CardChip =
  | { kind: "loading" }
  | { kind: "vue" }
  | { kind: "empty" }
  | {
      kind: "progress";
      tone: "amber" | "muted";
      seasonNumber: number;
      episodeNumber: number;
      watched: number;
      total: number;
    }
  | { kind: "caughtUp"; tone: "cyan" | "muted"; seasonNumber: number };

function LibraryCard({
  show,
  chip,
}: {
  show: NonNullable<Row["show"]>;
  chip: CardChip | undefined;
}) {
  return (
    <Link
      to="/show/$mediaType/$tmdbId"
      params={{
        mediaType: show.media_type,
        tmdbId: String(show.tmdb_id),
      }}
      className="group block"
    >
      <div className="aspect-[2/3] overflow-hidden rounded-lg border border-white/[0.14] bg-surface-elevated">
        {show.poster_path && (
          <img
            src={show.poster_path}
            alt={show.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        )}
      </div>
      {/* Titre volontairement tronqué sur UNE seule ligne : la vignette porte
          déjà l'affiche, le nom complet n'est pas nécessaire ici et une hauteur
          fixe (1 ligne pour tous) garantit que le statut en dessous s'aligne à
          l'identique d'une carte à l'autre dans la grille. */}
      <p className="mt-1.5 truncate text-xs text-foreground">{show.title}</p>

      {chip && (
        // Fixed min-height shared by every chip shape (skeleton / progress /
        // caught-up / vue) so the card never jumps between them, and sibling
        // cards stay aligned in the grid — 28px (h-7) matches the tallest
        // chip (label + 2px bar).
        <div className="mt-1.5 flex min-h-7 w-full flex-col justify-center">
          <CardChipView chip={chip} />
        </div>
      )}
    </Link>
  );
}

function CardChipView({ chip }: { chip: CardChip }) {
  const pad = (n: number) => n.toString().padStart(2, "0");

  if (chip.kind === "loading") {
    return <div className="h-7 w-full animate-pulse rounded-md bg-surface-elevated" />;
  }

  if (chip.kind === "empty") {
    return <div className="h-7 w-full" aria-hidden="true" />;
  }

  if (chip.kind === "vue") {
    return (
      <div className="flex h-7 items-center gap-1.5 rounded-md bg-surface-elevated px-2 font-counter text-[10px] uppercase tracking-wide text-cyan-accent">
        <Check className="h-3 w-3" aria-hidden="true" />
        Vue
      </div>
    );
  }

  if (chip.kind === "caughtUp") {
    const toneClass = chip.tone === "muted" ? "text-muted-foreground" : "text-cyan-accent";
    const barClass = chip.tone === "muted" ? "bg-muted-foreground/50" : "bg-cyan-accent";
    return (
      <div className="flex h-7 flex-col justify-center gap-1 rounded-md bg-surface-elevated px-2 py-1.5 font-counter text-[10px] uppercase tracking-wide leading-none">
        <span className={toneClass}>S{pad(chip.seasonNumber)}·À jour</span>
        <div className="h-[2px] w-full overflow-hidden bg-muted-foreground/15">
          <div className={`h-full ${barClass}`} style={{ width: "100%" }} />
        </div>
      </div>
    );
  }

  // chip.kind === "progress"
  return (
    <VhsCounter
      variant="grid"
      tone={chip.tone}
      seasonNumber={chip.seasonNumber}
      nextEpisodeNumber={chip.episodeNumber}
      watched={chip.watched}
      total={chip.total}
    />
  );
}
