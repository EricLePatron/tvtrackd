/**
 * Transfert des données applicatives de la base source (Lovable Cloud) vers
 * la base cible (projet Supabase indépendant).
 *
 * Étape 3 du runbook — voir docs/migration/RUNBOOK.md.
 *
 * Usage :
 *   SOURCE_URL=... SOURCE_SERVICE_KEY=... \
 *   TARGET_URL=... TARGET_SERVICE_KEY=... \
 *   bun scripts/migrate/transfer-data.ts [--skip-cache] [--dry-run]
 *
 * Les deux clés sont des service_role keys : elles contournent RLS, ce qui est
 * indispensable pour lire/écrire les lignes de tous les utilisateurs. Elles ne
 * doivent jamais être committées ni loguées.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type TableSpec = {
  /** Nom de la table dans public. */
  name: string;
  /** Colonne(s) de conflit pour l'upsert idempotent. */
  onConflict: string;
  /** Colonne utilisée pour paginer de façon stable (doit être triable et unique). */
  cursor: string;
  /** Cache TMDb reconstructible : ignoré avec --skip-cache. */
  cache?: boolean;
};

/**
 * Ordre strict des dépendances de clés étrangères. Ne pas réordonner :
 * `episodes` référence `shows`, `watch_status` référence `episodes`, etc.
 * `profiles` / `user_roles` supposent que les comptes auth ont déjà été
 * recréés (étape 4 du runbook, transfer-users.ts) avec les mêmes UUID.
 */
const TABLES: TableSpec[] = [
  { name: "shows", onConflict: "id", cursor: "id", cache: true },
  { name: "seasons", onConflict: "id", cursor: "id", cache: true },
  { name: "episodes", onConflict: "id", cursor: "id", cache: true },
  { name: "profiles", onConflict: "id", cursor: "id" },
  { name: "user_roles", onConflict: "id", cursor: "id" },
  { name: "user_shows", onConflict: "id", cursor: "id" },
  { name: "watch_status", onConflict: "id", cursor: "id" },
  { name: "show_ratings", onConflict: "id", cursor: "id" },
  { name: "import_runs", onConflict: "id", cursor: "id" },
];

const PAGE_SIZE = 1000;

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
        // Les clés sb_secret_* sont opaques, pas des JWT : PostgREST refuse
        // l'en-tête Authorization: Bearer <clé> et n'attend que `apikey`.
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

async function transferTable(
  source: SupabaseClient,
  target: SupabaseClient,
  spec: TableSpec,
  dryRun: boolean,
): Promise<void> {
  let cursor: number | string | null = null;
  let moved = 0;

  for (;;) {
    let query = source
      .from(spec.name)
      .select("*")
      .order(spec.cursor, { ascending: true })
      .limit(PAGE_SIZE);
    if (cursor !== null) query = query.gt(spec.cursor, cursor);

    const { data, error } = await query;
    if (error) throw new Error(`[${spec.name}] lecture: ${error.message}`);
    if (!data || data.length === 0) break;

    if (!dryRun) {
      const { error: writeError } = await target
        .from(spec.name)
        .upsert(data, { onConflict: spec.onConflict });
      if (writeError)
        throw new Error(`[${spec.name}] écriture: ${writeError.message}`);
    }

    moved += data.length;
    cursor = (data[data.length - 1] as Record<string, number | string>)[
      spec.cursor
    ];
    process.stdout.write(`\r  ${spec.name}: ${moved} lignes`);
  }

  process.stdout.write(`\r  ${spec.name}: ${moved} lignes ✓\n`);
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const skipCache = process.argv.includes("--skip-cache");

  const source = client(
    requireEnv("SOURCE_URL"),
    requireEnv("SOURCE_SERVICE_KEY"),
  );
  const target = client(
    requireEnv("TARGET_URL"),
    requireEnv("TARGET_SERVICE_KEY"),
  );

  const specs = TABLES.filter((t) => !(skipCache && t.cache));

  console.log(
    `Transfert de ${specs.length} tables${dryRun ? " (dry-run, aucune écriture)" : ""}${
      skipCache ? " — cache TMDb ignoré" : ""
    }`,
  );

  for (const spec of specs) {
    await transferTable(source, target, spec, dryRun);
  }

  console.log("\nContrôle des compteurs :");
  for (const spec of specs) {
    const [{ count: from }, { count: to }] = await Promise.all([
      source.from(spec.name).select("*", { count: "exact", head: true }),
      target.from(spec.name).select("*", { count: "exact", head: true }),
    ]);
    const ok = from === to;
    console.log(
      `  ${ok ? "✓" : "✗"} ${spec.name}: source=${from} cible=${to}`,
    );
    if (!ok) process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("\nÉchec du transfert :", err);
  process.exit(1);
});
