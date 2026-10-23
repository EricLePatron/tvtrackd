// Client Supabase "admin" (bypass RLS) partagé par les edge functions qui en
// ont besoin (get-show-details, import-history, export-data).
//
// Clé utilisée, par ordre de priorité :
//   1. SB_SECRET_KEY            : secret de fonction posé à la main
//                                 (`supabase secrets set SB_SECRET_KEY=sb_secret_...`).
//                                 Le préfixe SUPABASE_ est réservé, d'où ce nom.
//   2. SUPABASE_SECRET_KEYS     : injecté automatiquement par Supabase, objet JSON
//                                 { "<nom>": "sb_secret_..." } ; on lit la clé "default".
//   3. SUPABASE_SERVICE_ROLE_KEY: clé legacy (JWT). FALLBACK TRANSITOIRE, avec
//                                 avertissement. À supprimer une fois le legacy JWT
//                                 secret révoqué.
//
// supabase-js 2.112.2 (épinglé, identique à l'app web / bun.lock) accepte les
// clés `sb_secret_` mais, pour REST/Auth, les renvoie aussi en
// `Authorization: Bearer` (non-JWT). On reproduit donc le shim fetch de
// src/integrations/supabase/client.server.ts : la clé ne part que dans `apikey`
// (les `Authorization: Bearer <jwt utilisateur>` explicites, ex. getUser(token),
// sont conservés). On ne monte pas la version : 2.112.2 est déjà validé côté web.
import { createClient } from "npm:@supabase/supabase-js@2.112.2";

function readSecretKey(): string {
  const explicit = Deno.env.get("SB_SECRET_KEY");
  if (explicit) return explicit;

  const keysJson = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (keysJson) {
    try {
      const keys = JSON.parse(keysJson) as Record<string, string>;
      if (keys.default) return keys.default;
    } catch (err) {
      console.error("[admin] SUPABASE_SECRET_KEYS illisible", err);
    }
  }

  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) {
    console.warn(
      "[admin] Clé secrète nouvelle génération introuvable (SB_SECRET_KEY / SUPABASE_SECRET_KEYS) : " +
        "repli sur SUPABASE_SERVICE_ROLE_KEY (legacy). À corriger avant de révoquer le legacy JWT secret.",
    );
    return legacy;
  }

  throw new Error("Aucune clé secrète Supabase disponible pour le client admin");
}

function withApiKeyOnly(key: string): typeof fetch {
  const isOpaque = key.startsWith("sb_secret_") || key.startsWith("sb_publishable_");
  return (input, init) => {
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    if (isOpaque && headers.get("Authorization") === `Bearer ${key}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

const secretKey = readSecretKey();

export const admin = createClient(Deno.env.get("SUPABASE_URL")!, secretKey, {
  global: { fetch: withApiKeyOnly(secretKey) },
  auth: { persistSession: false, autoRefreshToken: false },
});
