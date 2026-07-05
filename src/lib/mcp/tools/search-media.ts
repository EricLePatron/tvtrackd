import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

const TMDB_IMG = "https://image.tmdb.org/t/p/w500";

export default defineTool({
  name: "search_media",
  title: "Rechercher séries et films",
  description:
    "Recherche TMDb (séries et films) par titre. Retourne titre, année, type, id TMDb et résumé.",
  inputSchema: {
    query: z.string().min(2).describe("Titre à rechercher (minimum 2 caractères)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ query }) => {
    const apiKey = (process.env.TMDB_API_KEY ?? "").trim();
    if (!apiKey) {
      return {
        content: [{ type: "text", text: "TMDB_API_KEY manquante côté serveur." }],
        isError: true,
      };
    }
    const url = new URL("https://api.themoviedb.org/3/search/multi");
    url.searchParams.set("query", query);
    url.searchParams.set("language", "fr-FR");
    url.searchParams.set("include_adult", "false");
    const isV4 = apiKey.startsWith("eyJ");
    if (!isV4) url.searchParams.set("api_key", apiKey);
    const res = await fetch(url, {
      headers: isV4 ? { Authorization: `Bearer ${apiKey}` } : {},
    });
    if (!res.ok) {
      return {
        content: [{ type: "text", text: `TMDb error ${res.status}` }],
        isError: true,
      };
    }
    const data = (await res.json()) as { results?: Array<Record<string, unknown>> };
    const results = (data.results ?? [])
      .filter((r) => r.media_type === "tv" || r.media_type === "movie")
      .slice(0, 15)
      .map((r) => {
        const title = (r.title ?? r.name ?? "") as string;
        const date = ((r.release_date ?? r.first_air_date) as string) ?? "";
        return {
          tmdb_id: r.id as number,
          media_type: r.media_type as "tv" | "movie",
          title,
          overview: (r.overview ?? "") as string,
          poster_url: r.poster_path ? `${TMDB_IMG}${r.poster_path as string}` : null,
          year: date ? Number(date.slice(0, 4)) : null,
        };
      });
    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      structuredContent: { results },
    };
  },
});
