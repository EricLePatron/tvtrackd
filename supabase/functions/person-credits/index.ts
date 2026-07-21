import { corsHeaders } from "../_shared/cors.ts";

const TMDB_API_KEY = (Deno.env.get("TMDB_API_KEY") ?? "").trim();
const TMDB_IMG = "https://image.tmdb.org/t/p/w500";
const TMDB_PROFILE = "https://image.tmdb.org/t/p/w300";
const IS_V4 = TMDB_API_KEY.startsWith("eyJ");

async function tmdb(path: string) {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  url.searchParams.set("language", "fr-FR");
  if (!IS_V4) url.searchParams.set("api_key", TMDB_API_KEY);
  const r = await fetch(url, {
    headers: IS_V4 ? { Authorization: `Bearer ${TMDB_API_KEY}` } : {},
  });
  if (!r.ok) throw new Error(`TMDb ${r.status} ${path}`);
  return r.json();
}

type TmdbCredit = {
  id: number;
  name?: string;
  title?: string;
  first_air_date?: string;
  release_date?: string;
  overview?: string;
  poster_path?: string | null;
  character?: string;
  popularity?: number;
  media_type?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { person_id } = await req.json();
    if (!person_id) {
      return Response.json({ error: "invalid params" }, { status: 400, headers: corsHeaders });
    }
    const [person, credits] = await Promise.all([
      tmdb(`/person/${person_id}`),
      tmdb(`/person/${person_id}/combined_credits`),
    ]);

    // Dédup par (media_type, id) puis tri par popularité décroissante.
    const seen = new Set<string>();
    const items = (credits.cast ?? [])
      .filter((c: TmdbCredit) =>
        (c.media_type === "tv" || c.media_type === "movie") && c.poster_path,
      )
      .filter((c: TmdbCredit) => {
        const k = `${c.media_type}:${c.id}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort(
        (a: TmdbCredit, b: TmdbCredit) => (b.popularity ?? 0) - (a.popularity ?? 0),
      )
      .slice(0, 60)
      .map((c: TmdbCredit) => {
        const title = c.name ?? c.title ?? "";
        const date = c.first_air_date ?? c.release_date ?? "";
        return {
          tmdb_id: c.id,
          media_type: c.media_type as "tv" | "movie",
          title,
          overview: c.overview ?? "",
          poster_url: c.poster_path ? `${TMDB_IMG}${c.poster_path}` : null,
          year: date ? Number(date.slice(0, 4)) : null,
          character: c.character ?? "",
        };
      });

    return Response.json(
      {
        person: {
          id: person.id,
          name: person.name ?? "",
          biography: person.biography ?? "",
          profile_url: person.profile_path ? `${TMDB_PROFILE}${person.profile_path}` : null,
          known_for_department: person.known_for_department ?? null,
          birthday: person.birthday ?? null,
          place_of_birth: person.place_of_birth ?? null,
        },
        credits: items,
      },
      { headers: corsHeaders },
    );
  } catch (err) {
    console.error("[person-credits]", err);
    return Response.json({ error: (err as Error).message }, { status: 500, headers: corsHeaders });
  }
});
