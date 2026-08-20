/**
 * Recréation des comptes utilisateurs sur la base cible en conservant leur
 * UUID — prérequis absolu : toutes les données applicatives (user_shows,
 * watch_status, show_ratings, profiles, user_roles) sont rattachées à cet id.
 *
 * Étape 4 du runbook — voir docs/migration/RUNBOOK.md. À exécuter AVANT
 * transfer-data.ts.
 *
 * Les hashs de mots de passe ne sont pas exportables via l'API : les comptes
 * sont recréés sans mot de passe utilisable et chaque utilisateur reçoit un
 * lien de réinitialisation (généré à la fin, à envoyer manuellement — 7
 * comptes aujourd'hui).
 *
 * Usage :
 *   SOURCE_URL=... SOURCE_SERVICE_KEY=... \
 *   TARGET_URL=... TARGET_SERVICE_KEY=... \
 *   bun scripts/migrate/transfer-users.ts [--dry-run]
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Variable d'environnement manquante : ${name}`);
    process.exit(1);
  }
  return value;
}

function admin(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
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

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const source = admin(
    requireEnv("SOURCE_URL"),
    requireEnv("SOURCE_SERVICE_KEY"),
  );
  const target = admin(
    requireEnv("TARGET_URL"),
    requireEnv("TARGET_SERVICE_KEY"),
  );

  const { data, error } = await source.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) throw new Error(`listUsers source: ${error.message}`);

  console.log(`${data.users.length} comptes à recréer${dryRun ? " (dry-run)" : ""}`);

  const resetLinks: Array<{ email: string; link: string }> = [];

  for (const user of data.users) {
    if (!user.email) {
      console.warn(`  ⚠ ${user.id} sans email — ignoré`);
      continue;
    }
    if (dryRun) {
      console.log(`  · ${user.email} (${user.id})`);
      continue;
    }

    const { error: createError } = await target.auth.admin.createUser({
      // L'UUID est repris à l'identique : c'est la clé de jointure de toutes
      // les données applicatives.
      id: user.id,
      email: user.email,
      email_confirm: true,
      user_metadata: user.user_metadata ?? {},
    });

    // Un compte déjà présent (relance du script) n'est pas une erreur.
    if (createError && !/already/i.test(createError.message)) {
      throw new Error(`createUser ${user.email}: ${createError.message}`);
    }

    const { data: linkData, error: linkError } =
      await target.auth.admin.generateLink({
        type: "recovery",
        email: user.email,
      });
    if (linkError) {
      console.warn(`  ⚠ lien de réinitialisation ${user.email}: ${linkError.message}`);
    } else if (linkData.properties?.action_link) {
      resetLinks.push({
        email: user.email,
        link: linkData.properties.action_link,
      });
    }

    console.log(`  ✓ ${user.email}`);
  }

  if (resetLinks.length > 0) {
    console.log(
      "\nLiens de réinitialisation à transmettre (ne pas committer) :",
    );
    for (const { email, link } of resetLinks) {
      console.log(`  ${email}\n    ${link}`);
    }
  }
}

main().catch((err) => {
  console.error("\nÉchec de la migration des comptes :", err);
  process.exit(1);
});
