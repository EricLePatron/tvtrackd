# Migration vers un projet Supabase indépendant

Objectif : sortir le backend de Lovable Cloud vers un projet Supabase possédé en propre, pour garantir la portabilité à long terme, sans perdre une ligne de données ni casser une fonctionnalité.

## État vérifié aujourd'hui

- 7 comptes utilisateurs, tous en email/mot de passe — aucune identité Google réellement créée pour l'instant.
- Données : 22 782 visionnages, 789 séries suivies, 433 237 séries en cache, 4,6 M d'épisodes en cache.
- 28 fichiers de migration SQL déjà versionnés dans le repo.
- 10 Edge Functions Deno versionnées dans le repo.
- Le frontend passe par un unique client généré (`src/integrations/supabase/*`) piloté par variables d'environnement.

Conséquence : le volume « précieux » (comptes + historique de visionnage) est minuscule ; le gros volume est du cache TMDb reconstructible. La migration est donc à faible risque.

## Ce qui se transfère tel quel

- Le schéma complet (tables, RLS, fonctions, triggers, schéma `private`) — rejouable depuis `supabase/migrations/`.
- Les données applicatives (`profiles`, `user_shows`, `watch_status`, `show_ratings`, `import_runs`, `user_roles`).
- Les 10 Edge Functions Deno, redéployables sans modification de code.
- Le secret TMDb.
- Tout le frontend : aucun changement de code, seulement des variables d'environnement.

## Ce qui doit être re-créé

| Élément | Aujourd'hui | Après |
|---|---|---|
| Comptes utilisateurs | Auth Lovable Cloud | Recréés via l'Admin API du nouveau projet, en conservant l'`id` UUID (indispensable : toutes les données y sont rattachées) |
| Connexion Google | Broker OAuth Lovable | Identifiants Google Cloud propres + provider Google configuré côté Supabase ; le code `lovable.auth.signInWithOAuth` est remplacé par `supabase.auth.signInWithOAuth` |
| Feedback → Notion | Passerelle connecteurs Lovable (`LOVABLE_API_KEY`) | Appel direct à l'API Notion avec un token d'intégration Notion perso |
| Server functions (`admin-metrics`, `feedback`) | Hébergées avec l'app | Inchangées — elles vivent dans le code, pas dans Supabase |
| Emails (digest quotidien à venir) | Lovable Email | Provider tiers (Resend) à brancher directement |

## Déroulé proposé

1. **Préparation** — création du projet Supabase cible, récupération de son URL et de ses clés.
2. **Schéma** — rejeu ordonné des 28 migrations sur la base cible, puis contrôle que RLS, grants, fonctions et triggers sont identiques.
3. **Données** — export/import table par table dans l'ordre des dépendances (`shows` → `seasons` → `episodes` → `profiles` → `user_shows` → `watch_status` → le reste), avec vérification des compteurs. Les triggers de recalcul de statut sont désactivés pendant l'import puis réactivés, pour éviter des recalculs parasites.
4. **Comptes** — recréation des 7 utilisateurs avec le même UUID via l'Admin API. Les mots de passe hashés ne sont pas exportables : chaque utilisateur reçoit un lien de réinitialisation. Sur 7 comptes, c'est acceptable ; si tu préfères zéro friction, on peut à la place ne pas migrer les comptes et repartir de zéro pour tous sauf le tien.
5. **Edge Functions** — redéploiement des 10 fonctions sur le nouveau projet + re-création du secret TMDb.
6. **Google + Notion** — création des identifiants OAuth Google, configuration du provider, adaptation de la page `/auth` ; remplacement de l'appel passerelle par l'API Notion directe.
7. **Bascule** — mise à jour des variables d'environnement du projet Lovable pour pointer sur le nouveau backend, puis vérification bout en bout : inscription, connexion, recherche, fiche série, marquage vu, bibliothèque, import, export, page admin.

## Détails techniques

- Les variables à basculer sont `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` (client) et `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (serveur). Les fichiers `src/integrations/supabase/client.ts`, `client.server.ts` et `auth-middleware.ts` les lisent déjà — ils ne sont donc pas à réécrire, mais ils sont marqués « auto-générés » : après bascule ils ne seront plus régénérés par Lovable et deviennent du code applicatif normal à maintenir.
- `src/integrations/lovable/index.ts` et la dépendance `@lovable.dev/cloud-auth-js` disparaissent au profit de `supabase.auth.signInWithOAuth("google", { redirectTo })`.
- `src/lib/feedback.functions.ts` cible aujourd'hui `connector-gateway.lovable.dev/notion/v1` ; il passera sur `api.notion.com/v1` avec un header `Notion-Version`.
- Le cache TMDb (4,6 M d'épisodes, 433 k séries) peut soit être transféré, soit laissé se reconstruire à la demande. Le transférer évite un pic d'appels TMDb au démarrage ; c'est l'option par défaut retenue.
- Point irréversible : Lovable Cloud ne peut pas être désactivé sur ce projet. Après bascule il reste attaché mais inutilisé — il faudra éviter que de futures modifications le réactivent implicitement (migrations, secrets).

## Ce dont j'ai besoin de toi

Ces étapes ne peuvent pas être faites depuis Lovable :

- Créer le projet Supabase et me fournir ses clés via le stockage sécurisé de secrets.
- Créer les identifiants OAuth Google dans Google Cloud Console.
- Créer un token d'intégration Notion et partager la base de feedback avec cette intégration.

## Hors périmètre

Aucun changement de design, de fonctionnalité ou de contenu. La migration doit être invisible pour l'utilisateur final, à l'exception de la réinitialisation de mot de passe.
