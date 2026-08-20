/**
 * Transfert MINIMAL vers la base cible quand elle ne peut pas héberger tout le
 * cache TMDb (ex. plan gratuit Supabase, 500 Mo — le cache complet fait ~433 k
 * séries + ~4,6 M épisodes et sature le disque).
 *
 * Au lieu de copier tout le cache, on ne copie que le sous-ensemble de
 * `shows` / `seasons` / `episodes` RÉFÉRENCÉ par les données utilisateur, puis
 * les tables utilisateur elles-mêmes. Le reste du cache se reconstruira tout
 * seul via les edge functions (get-show-details) au fil de l'usage.
 *
 * Pourquoi le sous-ensemble est obligatoire et pas seulement « --skip-cache » :
 * `user_shows.show_id` → `shows.id` et `watch_status.episode_id` → `episodes.id`
 * sont des clés étrangères NOT NULL. Charger les tables utilisateur sans les
 * lignes de cache correspondantes échoue en violation de FK.
 *
 * Prérequis sur la cible AVANT de lancer (voir docs/migration/RUNBOOK.md) :
 *   1. Base remontée / disque libéré (cache vidé : TRUNCATE ... CASCADE).
 *   2. Triggers de recalcul désactivés (watch_status/episodes/seasons/
 *      user_shows) — sinon des dizaines de milliers de recalculs.
 * APRÈS : réactiver les triggers + réaligner les séquences (setval).
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
const IN_CHUNK = 200; // taille des listes `id in (...)` pour rester sous la limite d'URL

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
        // que l'en-tête `apikey`, pas `Authorization: Bearer`.
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

/** Collecte l'ensemble des valeurs distinctes d'une colonne, en paginant par id. */
async function collectIds(
  db: SupabaseClient,
  table: string,
  column: string,
): Promise<Set<number>> {
  const ids = new Set<number>();
  let cursor = 0;
  for (;;) {
    const { data, error } = await db
      .from(table)
      .select(`id, ${column}`)
      .order("id", { ascending: true })
      .gt("id", cursor)
      .limit(PAGE_SIZE);
    if (error) throw new Error(`[${table}] lecture ${column}: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const row of data as unknown as Array<Record<string, number>>) {
      if (row[column] != null) ids.add(row[column]);
    }
    cursor = (data[data.length - 1] as unknown as Record<string, number>).id;
  }
  return ids;
}

/** Récupère des lignes complètes par lots d'`id in (...)`. */
async function fetchByIds(
  db: SupabaseClient,
  table: string,
  ids: number[],
): Promise<Array<Record<string, unknown>>> {
  const rows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK);
    const { data, error } = await db.from(table).select("*").in("id", chunk);
    if (error) throw new Error(`[${table}] fetchByIds: ${error.message}`);
    if (data) rows.push(...(data as Array<Record<string, unknown>>));
  }
  return rows;
}

/** Récupère des lignes complètes par lots de `show_id in (...)`. */
async function fetchByShowIds(
  db: SupabaseClient,
  table: string,
  showIds: number[],
): Promise<Array<Record<string, unknown>>> {
  const rows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < showIds.length; i += IN_CHUNK) {
    const chunk = showIds.slice(i, i + IN_CHUNK);
    const { data, error } = await db
      .from(table)
      .select("*")
      .in("show_id", chunk);
    if (error) throw new Error(`[${table}] fetchByShowIds: ${error.message}`);
    if (data) rows.push(...(data as Array<Record<string, unknown>>));
  }
  return rows;
}

async function upsertAll(
  db: SupabaseClient,
  table: string,
  rows: Array<Record<string, unknown>>,
  dryRun: boolean,
): Promise<void> {
  if (dryRun || rows.length === 0) {
    console.log(`  ${table}: ${rows.length} lignes${dryRun ? " (dry-run)" : ""}`);
    return;
  }
  for (let i = 0; i < rows.length; i += PAGE_SIZE) {
    const batch = rows.slice(i, i + PAGE_SIZE);
    const { error } = await db.from(table).upsert(batch, { onConflict: "id" });
    if (error) throw new Error(`[${table}] écriture: ${error.message}`);
  }
  console.log(`  ${table}: ${rows.length} lignes ✓`);
}

/** Transfert plein d'une petite table utilisateur (pagination keyset par id). */
async function transferUserTable(
  source: SupabaseClient,
  target: SupabaseClient,
  table: string,
  dryRun: boolean,
): Promise<void> {
  let cursor: number | null = null;
  let moved = 0;
  for (;;) {
    let query = source
      .from(table)
      .select("*")
      .order("id", { ascending: true })
      .limit(PAGE_SIZE);
    if (cursor !== null) query = query.gt("id", cursor);
    const { data, error } = await query;
    if (error) throw new Error(`[${table}] lecture: ${error.message}`);
    if (!data || data.length === 0) break;
    if (!dryRun) {
      const { error: writeError } = await target
        .from(table)
        .upsert(data, { onConflict: "id" });
      if (writeError)
        throw new Error(`[${table}] écriture: ${writeError.message}`);
    }
    moved += data.length;
    cursor = (data[data.length - 1] as Record<string, number>).id;
  }
  console.log(`  ${table}: ${moved} lignes ✓`);
}

async function count(db: SupabaseClient, table: string): Promise<number | null> {
  const { count: c } = await db
    .from(table)
    .select("*", { count: "exact", head: true });
  return c;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const source = client(
    requireEnv("SOURCE_URL"),
    requireEnv("SOURCE_SERVICE_KEY"),
  );
  const target = client(
    requireEnv("TARGET_URL"),
    requireEnv("TARGET_SERVICE_KEY"),
  );

  console.log(`Transfert minimal${dryRun ? " (dry-run, aucune écriture)" : ""}`);

  // 1. Quelles lignes de cache l'historique référence-t-il ? (côté source)
  console.log("\n1) Collecte des références (source) :");
  const showIds = await collectIds(source, "user_shows", "show_id");
  for (const id of await collectIds(source, "show_ratings", "show_id"))
    showIds.add(id);
  const episodeIds = await collectIds(source, "watch_status", "episode_id");
  console.log(
    `  ${showIds.size} séries référencées, ${episodeIds.size} épisodes référencés`,
  );

  // 2. Épisodes référencés + leurs séries parentes (episodes.show_id → shows.id)
  const episodeRows = await fetchByIds(source, "episodes", [...episodeIds]);
  for (const ep of episodeRows) {
    const sid = (ep as { show_id?: number }).show_id;
    if (sid != null) showIds.add(sid);
  }
  console.log(
    `  ${showIds.size} séries au total (avec parents des épisodes vus)`,
  );

  // 3. Séries + saisons référencées
  const showRows = await fetchByIds(source, "shows", [...showIds]);
  const seasonRows = await fetchByShowIds(source, "seasons", [...showIds]);

  // 4. Écriture du sous-ensemble de cache — ORDRE FK : shows → seasons → episodes
  console.log("\n2) Écriture du cache référencé (cible) :");
  await upsertAll(target, "shows", showRows, dryRun);
  await upsertAll(target, "seasons", seasonRows, dryRun);
  await upsertAll(target, "episodes", episodeRows, dryRun);

  // 5. Tables utilisateur — ORDRE FK strict (profiles/user_roles avant le reste)
  console.log("\n3) Tables utilisateur (cible) :");
  const userTables = [
    "profiles",
    "user_roles",
    "user_shows",
    "watch_status",
    "show_ratings",
    "import_runs",
  ];
  for (const t of userTables) {
    await transferUserTable(source, target, t, dryRun);
  }

  if (dryRun) return;

  // 6. Contrôle : les tables utilisateur doivent tomber au chiffre près.
  console.log("\n4) Contrôle des compteurs (tables utilisateur) :");
  for (const t of userTables) {
    const [from, to] = await Promise.all([count(source, t), count(target, t)]);
    const ok = from === to;
    console.log(`  ${ok ? "✓" : "✗"} ${t}: source=${from} cible=${to}`);
    if (!ok) process.exitCode = 1;
  }
  console.log(
    "\nCache transféré en sous-ensemble (non comparé au total source, c'est voulu).",
  );
}

main().catch((err) => {
  console.error("\nÉchec du transfert minimal :", err);
  process.exit(1);
});
