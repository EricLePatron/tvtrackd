import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { User } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { APP_NAME, SITE_URL } from "@/lib/app-config";
import { useAuth } from "@/hooks/use-auth";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { useFollowedKeys } from "@/hooks/use-followed-keys";
import { useQuickFollow } from "@/hooks/use-quick-follow";
import { usePersonCredits, fetchPersonCredits } from "@/hooks/use-person-credits";
import { DiscoveryGrid, trendingKey, type TrendingItem } from "@/components/home/discovery-grid";
import { retry } from "@/lib/retry";

export const Route = createFileRoute("/_public/person/$personId")({
  component: PersonScreen,
  // `retry` restaure le filet perdu par le passage en `loader` (react-query
  // retentait automatiquement 3 fois un `useQuery` en échec, un `loader` ne
  // le fait pas nativement) — cf. QA P0-1, majeur #3.
  loader: async ({ params }) => retry(() => fetchPersonCredits(params.personId)),
  head: ({ params, loaderData }) => {
    const canonicalUrl = `${SITE_URL}/person/${params.personId}`;
    const person = loaderData?.person;

    // Filet de sécurité (même logique que la fiche série/film) : le loader
    // fait normalement échouer la route avant `head()` en cas d'erreur, mais
    // on reste défensif plutôt que de planter le rendu du <head>.
    if (!person) {
      return {
        meta: [
          { title: `Filmographie — ${APP_NAME}` },
          {
            name: "description",
            content:
              "Découvrez toutes les séries et films dans lesquels un acteur ou une actrice a joué.",
          },
        ],
        links: [{ rel: "canonical", href: canonicalUrl }],
      };
    }

    const title = `${person.name} — filmographie, séries et films — ${APP_NAME}`;
    const description = person.biography
      ? person.biography.slice(0, 155).trim() + (person.biography.length > 155 ? "…" : "")
      : `Toutes les séries et films dans lesquels ${person.name} a joué, avec disponibilité de suivi sur ${APP_NAME}.`;

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: canonicalUrl },
        ...(person.profile_url ? [{ property: "og:image", content: person.profile_url }] : []),
      ],
      links: [{ rel: "canonical", href: canonicalUrl }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Person",
            url: canonicalUrl,
            name: person.name,
            ...(person.profile_url ? { image: person.profile_url } : {}),
            ...(person.birthday ? { birthDate: person.birthday } : {}),
            ...(person.place_of_birth ? { birthPlace: person.place_of_birth } : {}),
            ...(person.biography ? { description: person.biography } : {}),
          }),
        },
      ],
    };
  },
  // `<BackButton />` dans les deux fallbacks (QA P0-1, majeur #3) : sans ça,
  // un utilisateur qui atterrit ici (loader en échec même après retry, ou
  // personId inconnu) est bloqué sur un écran sans issue de navigation.
  errorComponent: ({ error }) => (
    <div className="p-6">
      <BackButton />
      <p className="mt-4 text-sm text-destructive">Erreur : {error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-6">
      <BackButton />
      <p className="mt-4 text-sm text-muted-foreground">Introuvable.</p>
    </div>
  ),
});

function PersonScreen() {
  const { personId } = Route.useParams();
  const { user } = useAuth();
  const loaderData = Route.useLoaderData();
  const { data, isLoading, isError } = usePersonCredits(personId, loaderData);
  const { data: alreadyFollowedKeys = new Set<string>() } = useFollowedKeys(user?.id);
  const [optimisticKeys, setOptimisticKeys] = useState<Set<string>>(new Set());
  const followMutation = useQuickFollow(user?.id);
  const { requireAuth } = useAuthGate();

  const followedKeys = useMemo(
    () => new Set([...alreadyFollowedKeys, ...optimisticKeys]),
    [alreadyFollowedKeys, optimisticKeys],
  );

  const handleFollow = (item: TrendingItem) => {
    requireAuth(
      () => {
        const key = trendingKey(item);
        setOptimisticKeys((prev) => new Set(prev).add(key));
        followMutation.mutate(item, {
          onError: () => {
            setOptimisticKeys((prev) => {
              const next = new Set(prev);
              next.delete(key);
              return next;
            });
          },
        });
      },
      {
        reason: "suivre cette série",
        intent: { kind: "follow", tmdbId: item.tmdb_id, mediaType: item.media_type },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="p-5">
        <BackButton />
        <div className="mt-4 flex gap-4">
          <div className="h-28 w-28 shrink-0 animate-pulse rounded-full bg-surface-elevated" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-2/3 animate-pulse rounded bg-surface-elevated" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-surface-elevated" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-6">
        <BackButton />
        <p className="mt-4 text-sm text-destructive">Chargement impossible.</p>
      </div>
    );
  }

  const { person, credits } = data;
  const tvCredits = credits.filter((c) => c.media_type === "tv");
  const movieCredits = credits.filter((c) => c.media_type === "movie");

  return (
    <div className="pb-24">
      <div className="px-5 pt-4">
        <BackButton />
      </div>

      <header className="mx-5 mt-3 flex gap-4">
        <div className="h-28 w-28 shrink-0 overflow-hidden rounded-full bg-surface-elevated">
          {person.profile_url ? (
            <img
              src={person.profile_url}
              alt={person.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <User className="h-9 w-9" aria-hidden="true" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl leading-tight text-foreground">{person.name}</h1>
          {person.known_for_department && (
            <p className="mt-1 font-counter text-[10px] uppercase tracking-[0.24em] text-cyan-accent">
              {person.known_for_department}
            </p>
          )}
          {(person.birthday || person.place_of_birth) && (
            <p className="mt-1 text-[12px] text-muted-foreground">
              {person.birthday && new Date(person.birthday).toLocaleDateString("fr-FR")}
              {person.birthday && person.place_of_birth ? " · " : ""}
              {person.place_of_birth}
            </p>
          )}
        </div>
      </header>

      {person.biography && <PersonBio bio={person.biography} />}

      <div className="mx-5">
        {tvCredits.length > 0 && (
          <DiscoveryGrid
            title={`Séries · ${tvCredits.length}`}
            items={tvCredits}
            followedKeys={followedKeys}
            pendingKey={
              followMutation.isPending && followMutation.variables
                ? trendingKey(followMutation.variables)
                : null
            }
            onFollow={handleFollow}
          />
        )}
        {movieCredits.length > 0 && (
          <DiscoveryGrid
            title={`Films · ${movieCredits.length}`}
            items={movieCredits}
            followedKeys={followedKeys}
            pendingKey={
              followMutation.isPending && followMutation.variables
                ? trendingKey(followMutation.variables)
                : null
            }
            onFollow={handleFollow}
          />
        )}
        {credits.length === 0 && (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Aucune filmographie référencée.
          </p>
        )}
      </div>
    </div>
  );
}

function PersonBio({ bio }: { bio: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = bio.length > 320;
  return (
    <div className="mx-5 mt-5">
      <p className="font-counter text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
        Biographie
      </p>
      <p
        className={`mt-1.5 whitespace-pre-line text-sm leading-relaxed text-muted-foreground ${
          !expanded && isLong ? "line-clamp-4" : ""
        }`}
      >
        {bio}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          {expanded ? "Réduire" : "Lire la suite"}
        </button>
      )}
    </div>
  );
}
