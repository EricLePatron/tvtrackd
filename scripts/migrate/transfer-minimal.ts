/**
 * Transfert MINIMAL : ne copie que le patrimoine irremplaçable + le strict
 * sous-ensemble de cache TMDb qu'il référence.
 *
 * Contexte : le cache complet (~433 k séries, ~4,6 M épisodes) sature le disque
 * d'un projet Supabase gratuit (500 Mo). Or il est reconstructible depuis TMDb.
 * On ne transfère donc que :
 *   - les tables utilisateur (profiles, user_roles, user_shows, watch_status,
 *     show_ratings, import_runs) — le vrai patrimoine ;
 *   - les seules lignes de `shows` / `seasons` / `episodes` référencées par ces
 *     tables, pour satisfaire les clés étrangères
 *     (user_shows.show_id → shows.id, watch_status.episode_id → episodes.id).
 * Le reste du cache se reconstruit tout seul à l'usage (get-show-details).
 *
 * Prérequis : le schéma est déjà appliqué sur la cible (bootstrap-schema.sql) et
 * les comptes auth recréés avec les mêmes UUID (transfer-users.ts). Les triggers
 * de recalcul de statut doivent être DÉSACTIVÉS pendant l'import (voir RUNBOOK
 * étape 3) et réactivés après, avec réalignement des séquences.
 *
 * Usage :
 *   SOURCE_URL=... SOURCE_SERVICE_KEY=... \
 *   TARGET_URL=... TARGET_SERVICE_KEY=... \
 *   bun scripts/migrate/transfer-minimal.ts [--dry-run]
 *
 * Idempotent : upsert sur la clé primaire, relançable sans doublon.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const PAGE_SIZE = 1000;
const IN_BATCH = 200; // taille des lots pour les filtres .in(...) (longueur d'URL)

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
        // que l'en-tête `apikey`, pas `Authorization: Bearer <clé>`.
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

/** Lit toutes les lignes d'une table en paginant sur `id` (keyset stable). */
async function readAll(
  db: SupabaseClient,
  table: string,
  columns = "*",
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  let cursor: number | null = null;
  for (;;) {
    let q = db
      .from(table)
      .select(columns)
      .order("id", { ascending: true })
      .limit(PAGE_SIZE);
    if (cursor !== null) q = q.gt("id", cursor);
    const { data, error } = await q;
    if (error) throw new Error(`[${table}] lecture: ${error.message}`);
    if (!data || data.length === 0) break;
    const page = data as unknown as Record<string, unknown>[];
    rows.push(...page);
    cursor = (page[page.length - 1] as { id: number }).id;
  }
  return rows;
}

/** Récupère les lignes d'une table dont `col` ∈ ids, par lots. */
async function readByIds(
  db: SupabaseClient,
  table: string,
  col: string,
  ids: number[],
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < ids.length; i += IN_BATCH) {
    const batch = ids.slice(i, i + IN_BATCH);
    const { data, error } = await db.from(table).select("*").in(col, batch);
    if (error) throw new Error(`[${table}] lecture .in(${col}): ${error.message}`);
    if (data) rows.push(...(data as unknown as Record<string, unknown>[]));
  }
  return rows;
}

/** Upsert par lots sur la cible. */
async function writeAll(
  db: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict = "id",
): Promise<void> {
  for (let i = 0; i < rows.length; i += PAGE_SIZE) {
    const batch = rows.slice(i, i + PAGE_SIZE);
    const { error } = await db.from(table).upsert(batch, { onConflict });
    if (error) throw new Error(`[${table}] écriture: ${error.message}`);
  }
}

function uniqueNums(values: unknown[]): number[] {
  const set = new Set<number>();
  for (const v of values) if (typeof v === "number") set.add(v);
  return Array.from(set);
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const source = client(requireEnv("SOURCE_URL"), requireEnv("SOURCE_SERVICE_KEY"));
  const target = client(requireEnv("TARGET_URL"), requireEnv("TARGET_SERVICE_KEY"));

  console.log(`Transfert minimal${dryRun ? " (dry-run, aucune écriture)" : ""}`);

  // 1. Tables utilisateur (patrimoine) — lues intégralement depuis la source.
  const profiles = await readAll(source, "profiles");
  const userRoles = await readAll(source, "user_roles");
  const userShows = await readAll(source, "user_shows");
  const watchStatus = await readAll(source, "watch_status");
  const showRatings = await readAll(source, "show_ratings");
  const importRuns = await readAll(source, "import_runs");
  console.log(
    `  utilisateur — profiles:${profiles.length} user_roles:${userRoles.length} ` +
      `user_shows:${userShows.length} watch_status:${watchStatus.length} ` +
      `show_ratings:${showRatings.length} import_runs:${importRuns.length}`,
  );

  // 2. Épisodes référencés par l'historique (FK watch_status.episode_id).
  const episodeIds = uniqueNums(watchStatus.map((r) => r.episode_id));
  const episodes = await readByIds(source, "episodes", "id", episodeIds);

  // 3. Séries référencées : suivies + notées + parents des épisodes vus
  //    (FK user_shows.show_id / show_ratings.show_id / episodes.show_id).
  const showIds = uniqueNums([
    ...userShows.map((r) => r.show_id),
    ...showRatings.map((r) => r.show_id),
    ...episodes.map((r) => r.show_id),
  ]);
  const shows = await readByIds(source, "shows", "id", showIds);

  // 4. Saisons des séries référencées (confort UI ; aucune FK ne l'exige).
  const seasons = await readByIds(source, "seasons", "show_id", showIds);

  console.log(
    `  cache référencé — shows:${shows.length} seasons:${seasons.length} ` +
      `episodes:${episodes.length} (sur ${episodeIds.length} épisodes distincts vus)`,
  );

  if (dryRun) {
    console.log("\nDry-run : rien écrit.");
    return;
  }

  // 5. Écriture sur la cible, dans l'ordre des dépendances de clés étrangères.
  await writeAll(target, "shows", shows);
  await writeAll(target, "seasons", seasons);
  await writeAll(target, "episodes", episodes);
  await writeAll(target, "profiles", profiles);
  await writeAll(target, "user_roles", userRoles);
  await writeAll(target, "user_shows", userShows);
  await writeAll(target, "watch_status", watchStatus);
  await writeAll(target, "show_ratings", showRatings);
  await writeAll(target, "import_runs", importRuns);

  // 6. Contrôle des compteurs sur les tables utilisateur : doivent tomber juste.
  console.log("\nContrôle des compteurs (tables utilisateur) :");
  const userTables = [
    "profiles",
    "user_roles",
    "user_shows",
    "watch_status",
    "show_ratings",
    "import_runs",
  ];
  for (const t of userTables) {
    const [{ count: from }, { count: to }] = await Promise.all([
      source.from(t).select("*", { count: "exact", head: true }),
      target.from(t).select("*", { count: "exact", head: true }),
    ]);
    const ok = from === to;
    console.log(`  ${ok ? "✓" : "✗"} ${t}: source=${from} cible=${to}`);
    if (!ok) process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("\nÉchec du transfert minimal :", err);
  process.exit(1);
});
