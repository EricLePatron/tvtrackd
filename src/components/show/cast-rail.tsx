import { Link } from "@tanstack/react-router";
import { User } from "lucide-react";
import { useShowCredits, type CastMember } from "@/hooks/use-show-credits";

/**
 * Rail horizontal du casting principal, placé sur la fiche série/film. Chaque
 * carte est cliquable et amène sur /person/$personId → filmographie complète.
 */
export function CastRail({
  tmdbId,
  mediaType,
  initialData,
}: {
  tmdbId: number | string;
  mediaType: "tv" | "movie" | string;
  /** Casting déjà préchargé par le `loader` SSR de la route (best-effort). */
  initialData?: CastMember[];
}) {
  const { data: cast = [], isLoading, isError } = useShowCredits(tmdbId, mediaType, initialData);

  if (!isLoading && (isError || cast.length === 0)) return null;

  return (
    <section className="mt-8">
      <h3 className="mb-3 font-display text-sm uppercase tracking-widest text-foreground">
        Casting
      </h3>
      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="w-[68px] shrink-0 space-y-2">
              <div className="h-[68px] w-[68px] animate-pulse rounded-full bg-surface-elevated" />
              <div className="mx-auto h-2 w-3/4 animate-pulse rounded bg-surface-elevated" />
            </div>
          ))}
        </div>
      ) : (
        <ul className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1">
          {cast.map((c) => (
            <li key={c.person_id} className="w-[68px] shrink-0 snap-start">
              <Link
                to="/person/$personId"
                params={{ personId: String(c.person_id) }}
                className="group block text-center"
              >
                <div className="relative h-[68px] w-[68px] overflow-hidden rounded-full bg-surface-elevated ring-1 ring-white/5 transition-transform duration-300 group-hover:scale-105 group-hover:ring-white/10">
                  {c.profile_url ? (
                    <img
                      src={c.profile_url}
                      alt={c.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <User className="h-6 w-6" aria-hidden="true" />
                    </div>
                  )}
                </div>
                <p className="mt-2 line-clamp-2 text-[11px] leading-tight text-foreground">
                  {c.name}
                </p>
                {c.character && (
                  <p className="mt-0.5 line-clamp-1 text-[10px] leading-tight text-muted-foreground">
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
