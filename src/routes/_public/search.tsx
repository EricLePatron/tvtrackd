import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search as SearchIcon, Loader2 } from "lucide-react";
import { ScreenHeader } from "@/components/screen-header";
import { supabase } from "@/integrations/supabase/client";
import { DiscoverySection } from "@/components/home/discovery-section";

export const Route = createFileRoute("/_public/search")({
  component: SearchScreen,
  head: () => ({
    meta: [
      { title: "Rechercher une série ou un film — tvtrackd" },
      {
        name: "description",
        content:
          "Recherchez une série ou un film dans le catalogue TMDb et ajoutez-le à votre bibliothèque tvtrackd en un clic.",
      },
      { property: "og:title", content: "Rechercher une série ou un film — tvtrackd" },
      {
        property: "og:description",
        content:
          "Trouvez une série ou un film et ajoutez-le à votre bibliothèque tvtrackd en un clic.",
      },
      { property: "og:url", content: "https://tvtrackd.com/search" },
    ],
    links: [{ rel: "canonical", href: "https://tvtrackd.com/search" }],
  }),
});

type Result = {
  tmdb_id: number;
  media_type: "tv" | "movie";
  title: string;
  overview: string;
  poster_url: string | null;
  year: number | null;
};

function SearchScreen() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    if (debounced.length < 2) {
      setResults([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    supabase.functions
      .invoke("search-media", { body: { q: debounced } })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setError(error.message);
        else setResults((data as { results: Result[] })?.results ?? []);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const count = useMemo(() => results.length.toString().padStart(2, "0"), [results]);

  return (
    <>
      <ScreenHeader eyebrow="Explorer" title="Recherche">
        Titres, années, genres — l'index TMDb en direct.
      </ScreenHeader>
      <div className="mx-5">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 focus-within:border-primary/60">
          <SearchIcon className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Chercher une série ou un film…"
            autoFocus
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <span className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
              {count}
            </span>
          )}
        </div>

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        {results.length > 0 ? (
          <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {results.map((r) => (
              <Link
                key={`${r.media_type}-${r.tmdb_id}`}
                to="/show/$mediaType/$tmdbId"
                params={{ mediaType: r.media_type, tmdbId: String(r.tmdb_id) }}
                className="group block"
              >
                <div className="aspect-[2/3] overflow-hidden rounded-md border border-border bg-surface-elevated">
                  {r.poster_url ? (
                    <img
                      src={r.poster_url}
                      alt={r.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center font-counter text-[10px] uppercase text-muted-foreground">
                      no art
                    </div>
                  )}
                </div>
                {/* Titre tronqué sur une seule ligne (même pattern que la grille
                    bibliothèque) : hauteur constante d'une carte à l'autre, donc
                    la ligne meta en dessous s'aligne à l'identique sur toute la
                    grille. L'affiche identifie déjà la série ; `title` restitue
                    le nom complet au survol / appui long. */}
                <p className="mt-1.5 truncate text-xs text-foreground" title={r.title}>
                  {r.title}
                </p>
                <p className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
                  {r.media_type === "tv" ? "Série" : "Film"} · {r.year ?? "—"}
                </p>
              </Link>
            ))}
          </div>
        ) : loading && debounced.length >= 2 ? (
          <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              // Réserve le poster ET les deux lignes de texte (titre + meta) du
              // résultat réel : sans ça la carte « sautait » en hauteur quand les
              // résultats remplaçaient les skeletons. Aligné sur le SkeletonGrid
              // de la bibliothèque.
              <div key={i}>
                <div className="aspect-[2/3] animate-pulse rounded-md bg-surface-elevated" />
                <div className="mt-1.5 h-4 w-4/5 animate-pulse rounded bg-surface-elevated" />
                <div className="mt-1 h-3 w-1/2 animate-pulse rounded bg-surface-elevated" />
              </div>
            ))}
          </div>
        ) : (
          !loading &&
          debounced.length >= 2 &&
          !error && (
            <p className="mt-8 text-center font-counter text-[11px] uppercase tracking-widest text-muted-foreground">
              Aucun résultat
            </p>
          )
        )}

        {debounced.length < 2 && (
          <div className="mt-8">
            <DiscoverySection variant="grid" />
          </div>
        )}
      </div>
    </>
  );
}
