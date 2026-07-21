import { Link } from "@tanstack/react-router";
import { User } from "lucide-react";
import { useShowCredits } from "@/hooks/use-show-credits";

/**
 * Rail horizontal du casting principal, placé sur la fiche série/film. Chaque
 * carte est cliquable et amène sur /person/$personId → filmographie complète.
 */
export function CastRail({
  tmdbId,
  mediaType,
}: {
  tmdbId: number | string;
  mediaType: "tv" | "movie" | string;
}) {
  const { data: cast = [], isLoading, isError } = useShowCredits(tmdbId, mediaType);

  if (!isLoading && (isError || cast.length === 0)) return null;

  return (
    <section className="mt-8">
      <h3 className="mb-3 font-display text-sm uppercase tracking-widest text-foreground">
        Casting
      </h3>
      {isLoading ? (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="w-[92px] shrink-0 space-y-2"
            >
              <div className="aspect-[2/3] w-full animate-pulse rounded-md bg-surface-elevated" />
              <div className="h-2.5 w-full animate-pulse rounded bg-surface-elevated" />
            </div>
          ))}
        </div>
      ) : (
        <ul className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
          {cast.map((c) => (
            <li key={c.person_id} className="w-[92px] shrink-0 snap-start">
              <Link
                to="/person/$personId"
                params={{ personId: String(c.person_id) }}
                className="group block"
              >
                <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-surface-elevated">
                  {c.profile_url ? (
                    <img
                      src={c.profile_url}
                      alt={c.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <User className="h-7 w-7" aria-hidden="true" />
                    </div>
                  )}
                </div>
                <p className="mt-2 line-clamp-2 text-[12px] leading-tight text-foreground">
                  {c.name}
                </p>
                {c.character && (
                  <p className="mt-0.5 line-clamp-1 font-counter text-[10px] uppercase tracking-wide text-muted-foreground">
                    {c.character}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
