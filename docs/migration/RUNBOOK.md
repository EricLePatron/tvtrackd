# Runbook — migration vers un projet Supabase indépendant

Procédure d'exécution du plan de migration validé le 2026-08-20
(`.lovable/plan/migration-vers-un-projet-supabase-indépendant-2026-08-20.md`).

Objectif : basculer le backend de Lovable Cloud vers un projet Supabase possédé
en propre, sans perte de données ni régression fonctionnelle.

## État de la source au moment de l'audit

| Élément | Volume |
| --- | --- |
| Comptes `auth.users` | 7 (tous email/mot de passe, aucune identité Google) |
| `watch_status` | 22 782 |
| `user_shows` | 789 |
| `show_ratings`, `import_runs`, `profiles`, `user_roles` | faibles |
| `shows` (cache TMDb) | 433 237 |
| `episodes` (cache TMDb) | ~4,6 M |
| Migrations SQL versionnées | 28 |
| Edge Functions | 10 |

Le volume irremplaçable (comptes + historique) est très petit. Le gros volume
est du cache TMDb reconstructible : `--skip-cache` est une option valable si le
transfert est trop long, au prix d'un pic d'appels TMDb au redémarrage.

## Prérequis à fournir (hors Lovable)

1. Projet Supabase cible créé. Relever : URL du projet, clé publishable, clé
   service_role.
2. Identifiants OAuth Google (Google Cloud Console) — client ID + secret, avec
   l'URL de callback du nouveau projet en redirect autorisée.
3. Token d'intégration Notion, avec la base de feedback partagée avec
   l'intégration.

Ces valeurs passent par le stockage sécurisé de secrets, jamais par le chat ni
par un fichier committé.

## Étape 1 — Schéma

`docs/migration/bootstrap-schema.sql` est la concaténation ordonnée des 28
migrations du repo, avec un séparateur commenté par fichier. À exécuter tel
quel sur la base cible (SQL editor ou `psql`).

Le script est **idempotent** : toutes les créations sont gardées (`CREATE TABLE
IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
`CREATE OR REPLACE TRIGGER`/`FUNCTION`, `DROP POLICY IF EXISTS` avant chaque
`CREATE POLICY`, contraintes `UNIQUE` et type `app_role` gardés via un bloc
`DO`). Nécessaire parce que les snapshots régénérés par Lovable rejouent du DDL
déjà présent (ex. `manual_override`, `import_runs`, `user_roles`, triggers de
recalcul, tous dupliqués entre migrations) : sans ces gardes, le run échoue à la
première collision et le SQL editor annule tout dans sa transaction implicite.
Le script peut donc être relancé sans risque après un run partiel. Vérifié en
local : deux exécutions consécutives passent sans erreur, sur base fraîche puis
en rejeu.

Contrôles ensuite, sur la cible :

```sql
-- Tables attendues : episodes, import_runs, profiles, seasons, show_ratings,
-- shows, user_roles, user_shows, watch_status
select table_name from information_schema.tables where table_schema='public' order by 1;

-- RLS active partout
select relname, relrowsecurity from pg_class
where relnamespace='public'::regnamespace and relkind='r' order by 1;

-- Policies, fonctions, triggers
select tablename, policyname from pg_policies where schemaname='public' order by 1,2;
select proname from pg_proc where pronamespace in ('public'::regnamespace,'private'::regnamespace) order by 1;
select tgname from pg_trigger where not tgisinternal order by 1;
```

Le schéma `private` (qui héberge `has_role`) doit exister : il est créé par la
migration de durcissement sécurité et conditionne toutes les policies admin.

## Étape 2 — Comptes utilisateurs

À faire **avant** les données : `profiles`, `user_shows`, `watch_status`,
`show_ratings`, `import_runs` et `user_roles` référencent `auth.users(id)`.

```bash
SOURCE_URL=... SOURCE_SERVICE_KEY=... \
TARGET_URL=... TARGET_SERVICE_KEY=... \
bun scripts/migrate/transfer-users.ts --dry-run

# puis sans --dry-run
```

Le script recrée chaque compte avec le **même UUID**, confirme l'email, et
génère un lien de réinitialisation par utilisateur (les hashs de mots de passe
ne sont pas exportables via l'API). Ces liens s'affichent en fin d'exécution et
sont à transmettre manuellement. Le script est idempotent : un compte déjà
présent est ignoré sans erreur.

## Étape 3 — Données

Les triggers de recalcul de statut réagissent aux insertions dans
`watch_status`, `episodes`, `seasons` et `shows`. Les désactiver pendant
l'import évite des dizaines de milliers de recalculs inutiles et un statut
transitoire incohérent.

```sql
-- Sur la cible, AVANT le transfert
alter table public.watch_status disable trigger watch_status_recompute_status;
alter table public.episodes     disable trigger episodes_recompute_status;
alter table public.seasons      disable trigger seasons_recompute_status;
alter table public.shows        disable trigger shows_recompute_status;
alter table public.user_shows   disable trigger user_shows_manual_override_recompute;
```

```bash
SOURCE_URL=... SOURCE_SERVICE_KEY=... \
TARGET_URL=... TARGET_SERVICE_KEY=... \
bun scripts/migrate/transfer-data.ts --dry-run

# puis sans --dry-run (ajouter --skip-cache pour ignorer shows/seasons/episodes)
```

Le script pagine par 1000 lignes, upsert sur la clé primaire (relançable sans
doublon), respecte l'ordre des dépendances et compare les compteurs
source/cible à la fin. Un écart fait sortir le script en code 1.

```sql
-- Sur la cible, APRÈS le transfert
alter table public.watch_status enable trigger watch_status_recompute_status;
alter table public.episodes     enable trigger episodes_recompute_status;
alter table public.seasons      enable trigger seasons_recompute_status;
alter table public.shows        enable trigger shows_recompute_status;
alter table public.user_shows   enable trigger user_shows_manual_override_recompute;

-- Réaligner les séquences des tables à id entier (sinon les prochains INSERT
-- entrent en collision avec les id importés)
select setval(pg_get_serial_sequence('public.shows','id'),        coalesce(max(id),1)) from public.shows;
select setval(pg_get_serial_sequence('public.seasons','id'),      coalesce(max(id),1)) from public.seasons;
select setval(pg_get_serial_sequence('public.episodes','id'),     coalesce(max(id),1)) from public.episodes;
select setval(pg_get_serial_sequence('public.user_shows','id'),   coalesce(max(id),1)) from public.user_shows;
select setval(pg_get_serial_sequence('public.watch_status','id'), coalesce(max(id),1)) from public.watch_status;
select setval(pg_get_serial_sequence('public.import_runs','id'),  coalesce(max(id),1)) from public.import_runs;
```

Ce réalignement de séquences est le point le plus facile à oublier et le plus
visible en production : sans lui, le premier « marquer vu » échoue en violation
de clé primaire.

## Étape 4 — Edge Functions

Redéployer les 10 fonctions de `supabase/functions/` sur le projet cible
(`supabase functions deploy <nom>`), puis recréer les secrets qu'elles lisent :

- `TMDB_API_KEY` — utilisée par `search-media`, `get-show-details`,
  `trending-media`, `new-releases-media`, `public-calendar`, `similar-media`,
  `show-credits`, `person-credits`, `import-history`.
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — injectées automatiquement par
  Supabase, rien à faire.

Aucune modification de code n'est nécessaire dans ces fonctions.

## Étape 5 — Google et Notion

**Google.** `src/integrations/lovable/index.ts` et la dépendance
`@lovable.dev/cloud-auth-js` sont retirés ; la page `/auth` passe sur
`supabase.auth.signInWithOAuth("google", { options: { redirectTo } })`, avec
`redirectTo` sur une URL publique de même origine. Le provider Google doit être
activé côté projet cible avec les identifiants Google Cloud.

**Notion.** `src/lib/feedback.functions.ts` cible aujourd'hui
`connector-gateway.lovable.dev/notion/v1` avec `LOVABLE_API_KEY` +
`NOTION_API_KEY`. Il passe sur `https://api.notion.com/v1/pages`, avec
`Authorization: Bearer <token Notion>` et `Notion-Version: 2022-06-28`. Le
corps de la requête (propriétés Name / Select / Description / Date) reste
identique.

Ces deux changements cassent la production s'ils sont faits avant que les
identifiants correspondants n'existent : ils se font dans la même fenêtre que
la bascule des variables d'environnement.

## Étape 6 — Bascule

Variables à repointer sur le projet cible :

| Portée | Variables |
| --- | --- |
| Client | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` |
| Serveur | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |

`src/integrations/supabase/client.ts`, `client.server.ts` et
`auth-middleware.ts` lisent déjà ces variables : aucun de ces fichiers n'est à
réécrire. En revanche ils portent l'en-tête « fichier auto-généré » : après la
bascule ils ne sont plus régénérés et deviennent du code applicatif normal, à
maintenir à la main (notamment le shim `fetch` pour les clés `sb_*`).

## Étape 7 — Recette

À vérifier bout en bout sur le nouveau backend :

- [ ] Inscription email + confirmation
- [ ] Connexion email et connexion Google
- [ ] Réinitialisation de mot de passe (les 7 comptes migrés)
- [ ] Recherche de séries (TMDb)
- [ ] Fiche série : casting, plateformes, similaires, prochains épisodes
- [ ] Marquer un épisode vu → compteur VHS, statut de la série recalculé
- [ ] Bibliothèque : les 4 statuts, désarchivage
- [ ] Calendrier public et calendrier connecté
- [ ] Import d'un ZIP TV Time + page de détail d'un import
- [ ] Export JSON
- [ ] Notation 5 étoiles
- [ ] Formulaire de feedback → page créée dans Notion
- [ ] Page `/admin` accessible au seul compte admin
- [ ] Sitemap, robots.txt, métadonnées SEO des fiches

## Points de vigilance

- Lovable Cloud reste attaché au projet après la bascule (la désactivation est
  irréversible et n'est pas proposée) : il faut éviter que de futures
  modifications le réactivent implicitement — ne plus passer par l'outil de
  migration Lovable, mais par les migrations du repo appliquées sur la cible.
- Le cache TMDb transféré conserve `cached_at` : les entrées expirées se
  rafraîchiront naturellement au TTL, sans intervention.
- Les liens de réinitialisation générés à l'étape 2 sont des credentials :
  ne jamais les committer ni les coller dans un canal non privé.
