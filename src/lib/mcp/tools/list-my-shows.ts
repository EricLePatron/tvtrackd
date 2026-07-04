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
  name: "list_my_shows",
  title: "Lister mes séries et films",
  description:
    "Liste les séries et films suivis par l'utilisateur connecté, filtrables par statut (a_voir, en_cours, termine, abandonne, archive).",
  inputSchema: {
    status: z
      .enum(["a_voir", "en_cours", "termine", "abandonne", "archive"])
      .optional()
      .describe("Statut à filtrer. Omettre pour tout retourner."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ status }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Non authentifié." }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let query = sb
      .from("user_shows")
      .select("id, status, created_at, shows(tmdb_id, media_type, title, first_air_date, poster_path)")
      .eq("user_id", ctx.getUserId()!);
    if (status) query = query.eq("status", status);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { items: data ?? [] },
    };
  },
});
