import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "follow_show",
  title: "Suivre une série ou un film",
  description:
    "Ajoute (ou met à jour) une série/film dans la bibliothèque de l'utilisateur avec un statut donné. La série doit déjà exister dans le cache shows (identifiée par tmdb_id + media_type).",
  inputSchema: {
    tmdb_id: z.number().int().positive().describe("Identifiant TMDb."),
    media_type: z.enum(["tv", "movie"]).describe("Type de média."),
    status: z
      .enum(["a_voir", "en_cours", "termine", "abandonne", "archive"])
      .describe("Statut à appliquer."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  handler: async ({ tmdb_id, media_type, status }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Non authentifié." }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data: show, error: showErr } = await sb
      .from("shows")
      .select("id")
      .eq("tmdb_id", tmdb_id)
      .eq("media_type", media_type)
      .maybeSingle();
    if (showErr) return { content: [{ type: "text", text: showErr.message }], isError: true };
    if (!show) {
      return {
        content: [
          {
            type: "text",
            text: "Série/film introuvable dans le cache. Consulter la fiche via l'app d'abord pour l'importer depuis TMDb.",
          },
        ],
        isError: true,
      };
    }
    const { data, error } = await sb
      .from("user_shows")
      .upsert(
        { user_id: ctx.getUserId()!, show_id: show.id, status },
        { onConflict: "user_id,show_id" },
      )
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Statut « ${status} » appliqué.` }],
      structuredContent: { user_show: data },
    };
  },
});
