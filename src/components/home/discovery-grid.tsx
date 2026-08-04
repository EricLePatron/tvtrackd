import { Link } from "@tanstack/react-router";
import { Check, Plus } from "lucide-react";

export type TrendingItem = {
  tmdb_id: number;
  media_type: "tv" | "movie";
  title: string;
  overview: string;
  poster_url: string | null;
  year: number | null;
};

/**
 * TMDb tv/movie ids are independent namespaces — a composite key avoids
 * collisions between e.g. a tv show and a movie sharing the same tmdb_id.
 */
export function trendingKey(item: { media_type: string; tmdb_id: number }): string {
  return `${item.media_type}:${item.tmdb_id}`;
}

/**
 * "Le rayon du moment" — trending TMDb picks with a one-tap quick-follow "+"
 * button (optimistic). Presentational only: the trending data source and the
 * follow mutation are supplied by the caller.
 */
export function DiscoveryGrid({
  title = "Le rayon du moment",
  items,
  isLoading,
  isError,
  variant = "grid",
  followedKeys,
  pendingKey,
  onFollow,
}: {
  title?: string;
  items: TrendingItem[];
  isLoading?: boolean;
  isError?: boolean;
  variant?: "grid" | "compact";
  followedKeys: ReadonlySet<string>;
  pendingKey?: string | null;
  onFollow: (item: TrendingItem) => void;
}) {
  const showError = !isLoading && !!isError && items.length === 0;

  if (!isLoading && !showError && items.length === 0) return null;

  return (
    <section className={variant === "grid" ? "mt-10" : "mt-8"}>
      <h2 className="mb-4 font-display text-xl font-bold text-foreground sm:text-2xl">
        {title}
      </h2>

      {showError ? (
        <p className="font-counter text-[11px] uppercase tracking-widest text-muted-foreground">
          Indisponible pour le moment
        </p>
      ) : isLoading ? (
        <div
          className={
            variant === "grid"
              ? "grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6"
              : "flex gap-3 overflow-x-auto"
          }
        >
          {Array.from({ length: variant === "grid" ? 6 : 4 }).map((_, i) => (
            <div
              key={i}
              className={`aspect-[2/3] animate-pulse rounded-lg bg-surface-elevated ${
                variant === "compact" ? "w-36 shrink-0" : ""
              }`}
            />
          ))}
        </div>
      ) : (
        <div
          className={
            variant === "grid"
              ? "grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6"
              : "-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1"
          }
        >
          {items.map((item) => {
            const key = trendingKey(item);
            const followed = followedKeys.has(key);
            const pending = pendingKey === key;
            return (
              <div
                key={key}
                className={variant === "compact" ? "w-36 shrink-0 snap-start" : undefined}
              >

                <div className="relative">
                  <Link
                    to="/show/$mediaType/$tmdbId"
                    params={{ mediaType: item.media_type, tmdbId: String(item.tmdb_id) }}
                    className="block"
                  >
                    <div className="aspect-[2/3] overflow-hidden rounded-lg border border-border bg-surface-elevated transition-transform duration-200 hover:scale-[1.03]">
                      {item.poster_url ? (
                        <img
                          src={item.poster_url}
                          alt={item.title}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center font-counter text-[10px] uppercase text-muted-foreground">
                          no art
                        </div>
                      )}
                    </div>
                  </Link>
                  <button
                    onClick={() => !followed && onFollow(item)}
                    disabled={followed || pending}
                    aria-label={followed ? "Déjà suivi" : `Suivre ${item.title}`}
                    className={`absolute bottom-2 right-2 grid place-items-center rounded-full border transition-colors ${
                      variant === "grid" ? "h-9 w-9" : "h-11 w-11"
                    } ${
                      followed
                        ? "border-secondary bg-secondary text-secondary-foreground"
                        : "border-primary/60 bg-background/80 text-primary backdrop-blur-sm"
                    }`}
                  >
                    {followed ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </button>
                </div>
                {/* Même pattern de troncature que les grilles bibliothèque et
                    recherche : `truncate` sur une ligne + `title` pour le nom
                    complet au survol. */}
                <p
                  className={`mt-2 truncate font-medium text-foreground ${
                    variant === "grid" ? "text-xs" : "text-sm"
                  }`}
                  title={item.title}
                >
                  {item.title}
                </p>

              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
