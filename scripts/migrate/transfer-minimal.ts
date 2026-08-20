/**
 * Transfert MINIMAL vers la base cible : uniquement le sous-ensemble de cache
 * TMDb référencé par l'historique utilisateur, puis les tables utilisateur.
 *
 * Le cache TMDb complet (~433 k shows / ~4,6 M episodes) sature le plan gratuit
 * (500 Mo) : il est abandonné et se reconstruira via get-show-details.
 *
 * Un simple --skip-cache est impossible : user_shows.show_id → shows.id et
 * watch_status.episode_id → episodes.id sont des FK NOT NULL. On charge donc
 * exactement les lignes de cache référencées, dans l'ordre des dépendances.
 * Ne JAMAIS contourner avec DISABLE TRIGGER ALL (désactive aussi les FK).
 *
 * Usage :
 *   SOURCE_URL=... SOURCE_SERVICE_KEY=... \
 *   TARGET_URL=... TARGET_SERVICE_KEY=... \
 *   bun scripts/migrate/transfer-minimal.ts [--dry-run]
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const PAGE = 1000;
const CHUNK = 500; // taille des lots pour les filtres `in(...)`

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Variable d'environnement manquante : ${name}`);
    process.exit(1);
  }
  return value;
}

function client(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        // Les clés sb_secret_* sont opaques, pas des JWT : PostgREST n'attend
        // que l'en-tête `apikey`.
        if (
          key.startsWith("sb_") &&
          headers.get("Authorization") === `Bearer ${key}`
        ) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Lit toutes les lignes d'une table, paginé par id croissant. */
async function readAll(
  db: SupabaseClient,
  table: string,
  select = "*",
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  let cursor: number | string | null = null;
  for (;;) {
    let q = db.from(table).select(select).order("id", { ascending: true }).limit(PAGE);
    if (cursor !== null) q = q.gt("id", cursor);
    const { data, error } = await q;
    if (error) throw new Error(`[${table}] lecture: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...(data as Record<string, unknown>[]));
    cursor = (data[data.length - 1] as Record<string, number | string>)["id"];
  }
  return rows;
}

/** Lit les lignes d'une table dont `column` appartient à `values`. */
async function readWhereIn(
  db: SupabaseClient,
  table: string,
  column: string,
  values: (number | string)[],
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (const part of chunks(values, CHUNK)) {
    let cursor: number | string | null = null;
    for (;;) {
      let q = db
        .from(table)
        .select("*")
        .in(column, part)
        .order("id", { ascending: true })
        .limit(PAGE);
      if (cursor !== null) q = q.gt("id", cursor);
      const { data, error } = await q;
      if (error) throw new Error(`[${table}] lecture: ${error.message}`);
      if (!data || data.length === 0) break;
      rows.push(...(data as Record<string, unknown>[]));
      cursor = (data[data.length - 1] as Record<string, number | string>)["id"];
      if (data.length < PAGE) break;
    }
  }
  return rows;
}

async function write(
  target: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  dryRun: boolean,
): Promise<void> {
  if (!dryRun) {
    for (const part of chunks(rows, PAGE)) {
      const { error } = await target.from(table).upsert(part, { onConflict: "id" });
      if (error) throw new Error(`[${table}] écriture: ${error.message}`);
    }
  }
  console.log(`  ${table}: ${rows.length} lignes ${dryRun ? "(dry-run)" : "✓"}`);
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const source = client(requireEnv("SOURCE_URL"), requireEnv("SOURCE_SERVICE_KEY"));
  const target = client(requireEnv("TARGET_URL"), requireEnv("TARGET_SERVICE_KEY"));

  console.log(`Transfert minimal${dryRun ? " (dry-run, aucune écriture)" : ""}`);

  // --- Tables utilisateur lues d'abord pour déterminer le cache référencé ---
  const profiles = await readAll(source, "profiles");
  const userRoles = await readAll(source, "user_roles");
  const userShows = await readAll(source, "user_shows");
  const watchStatus = await readAll(source, "watch_status");
  const showRatings = await readAll(source, "show_ratings");
  const importRuns = await readAll(source, "import_runs");

  const episodeIds = [
    ...new Set(watchStatus.map((r) => r["episode_id"] as number)),
  ];
  const episodes = await readWhereIn(source, "episodes", "id", episodeIds);

  const showIds = [
    ...new Set<number>([
      ...userShows.map((r) => r["show_id"] as number),
      ...showRatings.map((r) => r["show_id"] as number),
      ...episodes.map((r) => r["show_id"] as number),
    ]),
  ];
  const shows = await readWhereIn(source, "shows", "id", showIds);
  const seasons = await readWhereIn(source, "seasons", "show_id", showIds);

  console.log(
    `Cache référencé : ${shows.length} séries, ${seasons.length} saisons, ${episodes.length} épisodes`,
  );

  // --- Écriture dans l'ordre des dépendances FK ---
  await write(target, "shows", shows, dryRun);
  await write(target, "seasons", seasons, dryRun);
  await write(target, "episodes", episodes, dryRun);
  await write(target, "profiles", profiles, dryRun);
  await write(target, "user_roles", userRoles, dryRun);
  await write(target, "user_shows", userShows, dryRun);
  await write(target, "watch_status", watchStatus, dryRun);
  await write(target, "show_ratings", showRatings, dryRun);
  await write(target, "import_runs", importRuns, dryRun);

  console.log("\nContrôle des compteurs (tables utilisateur) :");
  for (const table of [
    "profiles",
    "user_roles",
    "user_shows",
    "watch_status",
    "show_ratings",
    "import_runs",
  ]) {
    const [{ count: from }, { count: to }] = await Promise.all([
      source.from(table).select("*", { count: "exact", head: true }),
      target.from(table).select("*", { count: "exact", head: true }),
    ]);
    const ok = dryRun || from === to;
    console.log(`  ${ok ? "✓" : "✗"} ${table}: source=${from} cible=${to}`);
    if (!ok) process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("\nÉchec du transfert minimal :", err);
  process.exit(1);
});
