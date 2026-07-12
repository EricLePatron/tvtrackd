import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  bucketSignupsByDay,
  bucketSignupsByHour,
  computeImportStats,
  findHourMarkerIndex,
  splitShowsByStatus,
  type ImportRunRaw,
  type SignupDay,
  type SignupHour,
  type ImportStats,
  type TopShow,
  type UserShowStatusRow,
} from "@/lib/admin-metrics-aggregation";

export type { SignupDay, SignupHour, ImportStats, TopShow };

// Fenêtre fixe (pas glissante) pour la sparkline horaire des inscriptions —
// bracket la semaine de bascule TV Time -> tvtrackd. Fixe volontairement
// pour que le marqueur du 15/07 (fermeture TV Time) soit visible dès le
// déploiement de cette feature (J-3, 12/07), pas seulement une fois "now"
// entré dans une fenêtre glissante des 72 dernières heures qui l'exclurait
// jusqu'au 14/07 en fin de journée. À retirer/reconsidérer une fois la
// fenêtre de migration passée.
const MIGRATION_WINDOW_START = "2026-07-10T00:00:00.000Z";
const MIGRATION_WINDOW_END = "2026-07-17T00:00:00.000Z";
const TVTIME_CLOSURE_MARKER = "2026-07-15T00:00:00.000Z";

// Fenêtre de lecture du bloc "Imports" (bySourceDay + taux d'échec/matching).
const IMPORT_STATS_WINDOW_DAYS = 14;

export type AdminMetrics = {
  totalUsers: number;
  signupsSeries: SignupDay[];
  signupsSeriesHourly: SignupHour[];
  signupsHourlyMarkerIndex: number | null;
  // DAU/WAU/MAU + compteurs d'épisodes "réels" (watched_at_approximate = false)
  dau: number;
  wau: number;
  mau: number;
  episodesWatchedTotal: number;
  episodesWatchedLast7d: number;
  // Miroir "activité d'import" (watched_at_approximate = true) — mêmes
  // fenêtres, à lire séparément : un pic ici signale un import de masse,
  // pas de l'engagement utilisateur réel.
  dauImports: number;
  wauImports: number;
  mauImports: number;
  episodesImportedTotal: number;
  episodesImportedLast7d: number;
  activeShowsAVoir: number;
  activeShowsEnCours: number;
  topShowsAVoir: TopShow[];
  topShowsEnCours: TopShow[];
  importStats: ImportStats;
};

// Supabase RPC call typed as `any` because `has_role` / `admin_watch_activity`
// and the `import_runs.total_groups` column are not in the generated
// Database types yet (added by migration). Will be fixed on next type sync.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

type WatchActivityRow = {
  window_label: "1d" | "7d" | "30d";
  is_approximate: boolean;
  distinct_users: number | string;
  episode_count: number | string;
};

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
    const admin = supabaseAdmin as AnySupabase;

    // totalUsers — listUsers returns { users, aud, total? } depending on version
    const { data: usersPage1 } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const totalUsers = (usersPage1 as any)?.total ?? 0;

    // Un seul fetch listUsers couvre à la fois la vue 30j (existante) et la
    // vue horaire 72j fixe (item 4) : la fenêtre de bascule (10/07 -> 17/07)
    // est entièrement contenue dans les 30 derniers jours vus depuis le 12/07.
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
    const recentCreatedAt = recentUsers.map((u) => u.created_at!);

    const signupsSeries = bucketSignupsByDay(recentCreatedAt, since30.toISOString(), 30);
    const signupsSeriesHourly = bucketSignupsByHour(
      recentCreatedAt,
      MIGRATION_WINDOW_START,
      MIGRATION_WINDOW_END,
    );
    const signupsHourlyMarkerIndex = findHourMarkerIndex(
      signupsSeriesHourly,
      TVTIME_CLOSURE_MARKER,
    );

    // DAU/WAU/MAU + épisodes, réel vs miroir import, en un seul aller-retour
    // (fonction SQL admin_watch_activity — voir migration
    // 20260712090000_watch_status_activity_rpc.sql). Remplace les anciennes
    // requêtes brutes non filtrées sur watched_at_approximate, qui faisaient
    // passer un import de masse pour de l'activité utilisateur réelle.
    const { data: activityRows } = await admin.rpc("admin_watch_activity");
    const activity = (activityRows ?? []) as WatchActivityRow[];
    const findActivity = (window: WatchActivityRow["window_label"], isApprox: boolean) =>
      activity.find((r) => r.window_label === window && r.is_approximate === isApprox);

    const dau = Number(findActivity("1d", false)?.distinct_users ?? 0);
    const wau = Number(findActivity("7d", false)?.distinct_users ?? 0);
    const mau = Number(findActivity("30d", false)?.distinct_users ?? 0);
    const episodesWatchedLast7d = Number(findActivity("7d", false)?.episode_count ?? 0);

    const dauImports = Number(findActivity("1d", true)?.distinct_users ?? 0);
    const wauImports = Number(findActivity("7d", true)?.distinct_users ?? 0);
    const mauImports = Number(findActivity("30d", true)?.distinct_users ?? 0);
    const episodesImportedLast7d = Number(findActivity("7d", true)?.episode_count ?? 0);

    // episodesWatchedTotal / episodesImportedTotal — compteurs all-time (pas
    // de fenêtre), donc hors du RPC ci-dessus, mais toujours filtrés sur
    // watched_at_approximate (index composite watch_status_approx_watched_at_idx).
    // `admin` (cast AnySupabase) car cette colonne n'est pas encore dans les
    // types générés (même limitation que has_role/admin_watch_activity plus haut).
    const [{ count: episodesWatchedTotal }, { count: episodesImportedTotal }] = await Promise.all([
      admin
        .from("watch_status")
        .select("id", { count: "exact", head: true })
        .eq("watched_at_approximate", false),
      admin
        .from("watch_status")
        .select("id", { count: "exact", head: true })
        .eq("watched_at_approximate", true),
    ]);

    // Séries actives + Top 10, scindés par statut (a_voir / en_cours) — un
    // seul fetch de user_shows sert les deux (comptages ET classement).
    const { data: userShowsRaw } = await supabaseAdmin
      .from("user_shows")
      .select("show_id, status, shows(title)")
      .in("status", ["a_voir", "en_cours"])
      .order("show_id");

    const userShowStatusRows: UserShowStatusRow[] = (userShowsRaw ?? []).map((row) => ({
      show_id: row.show_id,
      status: row.status,
      title: (row.shows as { title?: string } | null)?.title ?? "Inconnu",
    }));
    const { activeShowsAVoir, activeShowsEnCours, topShowsAVoir, topShowsEnCours } =
      splitShowsByStatus(userShowStatusRows);

    // Bloc "Imports" : runs par source/jour, taux d'échec, volume moyen
    // (runs réussis uniquement), taux de matching TMDb pondéré.
    const sinceImportStats = new Date();
    sinceImportStats.setDate(sinceImportStats.getDate() - IMPORT_STATS_WINDOW_DAYS);
    const { data: importRunsRaw } = await admin
      .from("import_runs")
      .select(
        "source, imported_episodes, followed_shows, unmatched_count, total_groups, created_at",
      )
      .gte("created_at", sinceImportStats.toISOString());
    const importStats = computeImportStats((importRunsRaw ?? []) as ImportRunRaw[]);

    return {
      totalUsers,
      signupsSeries,
      signupsSeriesHourly,
      signupsHourlyMarkerIndex,
      dau,
      wau,
      mau,
      episodesWatchedTotal: episodesWatchedTotal ?? 0,
      episodesWatchedLast7d,
      dauImports,
      wauImports,
      mauImports,
      episodesImportedTotal: episodesImportedTotal ?? 0,
      episodesImportedLast7d,
      activeShowsAVoir,
      activeShowsEnCours,
      topShowsAVoir,
      topShowsEnCours,
      importStats,
    };
  });
