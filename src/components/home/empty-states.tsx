import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import type { ShowLite, ScheduleEpisode, UpcomingShowNext } from "@/lib/schedule";
import { formatCountdownLabel, formatUpcomingDayLabel } from "@/lib/schedule";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

/** Cas 1 — aucune série suivie : import / recherche. */
export function NoShowsPanel() {
  return (
    <div className="mx-5">
      <div className="rounded-xl border border-dashed border-border bg-transparent p-6 text-center">
        <p className="font-counter text-[11px] uppercase tracking-widest text-muted-foreground">
          Aucune série suivie
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Importez votre historique ou cherchez une série pour démarrer.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Link
            to="/profile"
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Importer mon historique
          </Link>
          <Link
            to="/search"
            className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground"
          >
            Chercher une série
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Cas 2 — tout vu, rien de programmé : bannière de confirmation. */
export function AllCaughtUpBanner() {
  return (
    <div className="mx-5">
      <div className="flex items-center gap-3 rounded-xl border border-cyan-accent/40 bg-cyan-accent/10 px-4 py-3.5">
        <Check className="h-4 w-4 shrink-0 text-cyan-accent" />
        <div>
          <p className="font-counter text-[11px] uppercase tracking-widest text-cyan-accent">
            À jour
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Rien de neuf pour l'instant — tout est marqué vu.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Cas 3 — rien à voir maintenant, mais des sorties à venir.
 * Hero graphique plein écran sur la série la plus proche (backdrop + gros
 * compteur "J-N" en Plex Mono cyan, dans l'esprit du HeroTicket), puis une
 * petite liste "Aussi en attente" pour les autres séries dont un épisode
 * arrive bientôt — voir `UpcomingShowNext[]` fourni par `nextUpcomingPerShow`.
 */
export function NothingNowCountdownTicket({
  awaited,
}: {
  awaited: UpcomingShowNext[];
}) {
  if (!awaited.length) return null;
  const [first, ...rest] = awaited;
  return (
    <div className="mx-5 space-y-3">
      <AwaitedHeroCard entry={first} />
      {rest.length > 0 && <AwaitedShowsList entries={rest} />}
    </div>
  );
}

function AwaitedHeroCard({ entry }: { entry: UpcomingShowNext }) {
  const { show, episode, daysUntil } = entry;
  const backdropUrl = episode.still_path ?? show.backdrop_path ?? show.poster_path;
  const dayLabel = formatCountdownLabel(daysUntil);
  // Un gros nombre isolé façon compteur mécanique — "J-3", "Demain", "Aujourd'hui"
  // n'ont pas le même gabarit ; on garde toujours un chiffre lisible quand > 1.
  const bigNumber = daysUntil >= 2 ? pad(daysUntil) : null;

  return (
    <Link
      to="/show/$mediaType/$tmdbId"
      params={{ mediaType: show.media_type, tmdbId: String(show.tmdb_id) }}
      className="relative block aspect-[16/10] overflow-hidden rounded-2xl border border-border bg-card"
    >
      {backdropUrl && (
        <div aria-hidden className="absolute inset-0">
          <img
            src={backdropUrl}
            alt=""
            width={1280}
            height={720}
            fetchPriority="high"
            decoding="async"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/20" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 to-transparent" />
        </div>
      )}

      <div className="relative flex h-full flex-col justify-between p-4">
        <p className="font-counter text-[10px] uppercase tracking-[0.25em] text-cyan-accent">
          En attente
        </p>

        <div>
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <h2 className="font-display text-xl leading-tight text-foreground line-clamp-2">
                {show.title}
              </h2>
              <p className="text-sm text-muted-foreground line-clamp-1">
                S{pad(episode.season_number)} E{pad(episode.episode_number)}
                {episode.title ? ` · ${episode.title}` : ""}
              </p>
              <p className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
                {episode.air_date
                  ? formatUpcomingDayLabel(episode.air_date, today(episode.air_date, daysUntil))
                  : dayLabel}
              </p>
            </div>

            {/* Compteur signature — J-N en gros, cyan permanent. Pour
                "aujourd'hui"/"demain", pas de chiffre isolé mais un label
                complet plus discret dans le même bloc pour ne pas laisser
                l'angle bas-droit vide. */}
            <div className="shrink-0 rounded-xl border border-cyan-accent/40 bg-background/70 px-3 py-2 text-right backdrop-blur-sm">
              {bigNumber ? (
                <>
                  <p className="font-counter text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
                    Jours
                  </p>
                  <p
                    className="font-counter text-[32px] leading-none tracking-tight text-cyan-accent tabular-nums"
                    style={{ textShadow: "0 0 14px rgba(77,217,196,0.35)" }}
                  >
                    {bigNumber}
                  </p>
                </>
              ) : (
                <p
                  className="font-counter text-base uppercase tracking-[0.2em] text-cyan-accent"
                  style={{ textShadow: "0 0 12px rgba(77,217,196,0.35)" }}
                >
                  {dayLabel}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

// `formatUpcomingDayLabel` needs `today` — on n'en dispose pas ici, mais
// `daysUntil = daysBetween(today, air_date)` permet de le retrouver
// facilement pour garder l'API purement locale. Petit helper inline plutôt
// que de faire remonter `today` jusqu'à ce composant, alors qu'on l'a déjà
// en creux dans la donnée.
function today(airDate: string, daysUntil: number): string {
  const d = new Date(airDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - daysUntil);
  return d.toISOString().slice(0, 10);
}

function AwaitedShowsList({ entries }: { entries: UpcomingShowNext[] }) {
  // Cap doux : au-delà de 4 autres séries, le rail "Programme à venir" plus
  // bas reprend le relais — pas la peine de dupliquer une longue liste ici.
  const visible = entries.slice(0, 4);
  const hidden = entries.length - visible.length;
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-3">
      <p className="mb-2 px-1 font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
        Aussi en attente
      </p>
      <ul className="divide-y divide-border/60">
        {visible.map((entry) => (
          <AwaitedRow key={entry.show.id} entry={entry} />
        ))}
      </ul>
      {hidden > 0 && (
        <p className="mt-2 px-1 font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
          +{hidden} autre{hidden > 1 ? "s" : ""} série{hidden > 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

function AwaitedRow({ entry }: { entry: UpcomingShowNext }) {
  const { show, episode, daysUntil } = entry;
  const poster = show.poster_path;
  const chip =
    daysUntil >= 2 ? `J-${daysUntil}` : daysUntil === 1 ? "Demain" : "Auj.";
  return (
    <li>
      <Link
        to="/show/$mediaType/$tmdbId"
        params={{ mediaType: show.media_type, tmdbId: String(show.tmdb_id) }}
        className="flex items-center gap-3 py-2"
      >
        <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md border border-border bg-surface-elevated">
          {poster && (
            <img
              src={poster}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-sm text-foreground">{show.title}</p>
          <p className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
            S{pad(episode.season_number)} E{pad(episode.episode_number)}
          </p>
        </div>
        <span className="shrink-0 rounded-md border border-cyan-accent/40 bg-cyan-accent/10 px-2 py-1 font-counter text-[11px] uppercase tracking-widest text-cyan-accent tabular-nums">
          {chip}
        </span>
      </Link>
    </li>
  );
}

/** Cas 4 — file d'attente active (Zone A pleine), rien de programmé en Zone B. */
export function NothingScheduledNotice() {
  return <p className="px-5 text-xs text-muted-foreground">Rien de prévu pour l'instant.</p>;
}

// Anciens types conservés pour compat éventuelle — non exportés.
export type _LegacyCountdown = { show: ShowLite; episode: ScheduleEpisode; daysUntil: number };
