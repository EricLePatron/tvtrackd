import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const token = authHeader.replace("Bearer ", "");
    const { data: userRes, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userRes.user) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const userId = userRes.user.id;

    const { data: userShows } = await admin
      .from("user_shows")
      .select("status, created_at, show:shows(tmdb_id, media_type, title, first_air_date)")
      .eq("user_id", userId);

    const { data: watch } = await admin
      .from("watch_status")
      .select(
        "watch_count, watched_at, episode:episodes(season_number, episode_number, title, air_date, show:shows(tmdb_id, title))",
      )
      .eq("user_id", userId);

    const payload = {
      exported_at: new Date().toISOString(),
      user_id: userId,
      shows: userShows ?? [],
      watched: watch ?? [],
    };

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="tvtrackd-export-${Date.now()}.json"`,
      },
    });
  } catch (err) {
    console.error("[export-data]", err);
    return Response.json(
      { error: (err as Error).message },
      { status: 500, headers: corsHeaders },
    );
  }
});
