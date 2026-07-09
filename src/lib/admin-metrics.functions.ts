import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SignupDay = { date: string; count: number };
export type TopShow = { title: string; followers: number };

export type AdminMetrics = {
  totalUsers: number;
  signupsSeries: SignupDay[];
  dau: number;
  wau: number;
  mau: number;
  activeShows: number;
  episodesWatchedTotal: number;
  episodesWatchedLast7d: number;
  topShows: TopShow[];
  importsTotal: number;
};

// Supabase RPC call typed as `any` because `has_role` is not in the generated
// Database types yet (added by migration). Will be fixed on next type sync.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

export const getAdminMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminMetrics> => {
    // Check admin role via RPC (uses authenticated user client, respects RLS)
    const { data: isAdmin, error: roleError } = await (context.supabase as AnySupabase).rpc(
      "has_role",
      {
        _user_id: context.userId,
        _role: "admin",
      },
    );
    if (roleError || !isAdmin) {
      throw new Error("Forbidden");
    }

    // Use service-role client for privileged queries
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // totalUsers — listUsers returns { users, aud, total? } depending on version
    const { data: usersPage1 } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const totalUsers = (usersPage1 as any)?.total ?? 0;

    // signupsSeries: last 30 days, group by day
    const since30 = new Date();
    since30.setDate(since30.getDate() - 29);
    since30.setHours(0, 0, 0, 0);

    const { data: recentUsersData } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const recentUsers = (recentUsersData?.users ?? []).filter(
      (u) => u.created_at && new Date(u.created_at) >= since30,
    );

    // Build day → count map for last 30 days
    const dayMap = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
      const d = new Date(since30);
      d.setDate(d.getDate() + i);
      dayMap.set(d.toISOString().slice(0, 10), 0);
    }
    for (const u of recentUsers) {
      const day = u.created_at!.slice(0, 10);
      dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
    }
    const signupsSeries: SignupDay[] = Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    // DAU / WAU / MAU  (distinct users with watched_at in last 1/7/30 days)
    const now = new Date();
    const ts1d = new Date(now.getTime() - 1 * 86400000).toISOString();
    const ts7d = new Date(now.getTime() - 7 * 86400000).toISOString();
    const ts30d = new Date(now.getTime() - 30 * 86400000).toISOString();

    const [dauRes, wauRes, mauRes] = await Promise.all([
      supabaseAdmin.from("watch_status").select("user_id").gte("watched_at", ts1d),
      supabaseAdmin.from("watch_status").select("user_id").gte("watched_at", ts7d),
      supabaseAdmin.from("watch_status").select("user_id").gte("watched_at", ts30d),
    ]);

    const dau = new Set((dauRes.data ?? []).map((r) => r.user_id)).size;
    const wau = new Set((wauRes.data ?? []).map((r) => r.user_id)).size;
    const mau = new Set((mauRes.data ?? []).map((r) => r.user_id)).size;

    // activeShows
    const { count: activeShows } = await supabaseAdmin
      .from("user_shows")
      .select("id", { count: "exact", head: true })
      .in("status", ["en_cours", "a_voir"]);

    // episodesWatchedTotal
    const { count: episodesWatchedTotal } = await supabaseAdmin
      .from("watch_status")
      .select("id", { count: "exact", head: true });

    // episodesWatchedLast7d
    const { count: episodesWatchedLast7d } = await supabaseAdmin
      .from("watch_status")
      .select("id", { count: "exact", head: true })
      .gte("watched_at", ts7d);

    // topShows: top 10 by follower count
    const { data: topShowsRaw } = await supabaseAdmin
      .from("user_shows")
      .select("show_id, shows(title)")
      .order("show_id");

    const showCount = new Map<number, { title: string; count: number }>();
    for (const row of topShowsRaw ?? []) {
      const title = (row.shows as { title?: string } | null)?.title ?? "Inconnu";
      const prev = showCount.get(row.show_id) ?? { title, count: 0 };
      showCount.set(row.show_id, { title: prev.title, count: prev.count + 1 });
    }
    const topShows: TopShow[] = Array.from(showCount.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(({ title, count }) => ({ title, followers: count }));

    // importsTotal
    const { count: importsTotal } = await supabaseAdmin
      .from("import_runs")
      .select("id", { count: "exact", head: true });

    return {
      totalUsers,
      signupsSeries,
      dau,
      wau,
      mau,
      activeShows: activeShows ?? 0,
      episodesWatchedTotal: episodesWatchedTotal ?? 0,
      episodesWatchedLast7d: episodesWatchedLast7d ?? 0,
      topShows,
      importsTotal: importsTotal ?? 0,
    };
  });
