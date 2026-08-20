# Migration vers le projet Supabase indépendant — exécution

Le projet cible `ynmzxlnodjxcylvddety` est joignable : l'API admin répond, la base est vierge, et les clés (URL, service_role, publishable) sont déjà stockées côté secrets. La connexion Postgres directe reste indisponible (mot de passe non renseigné), donc les étapes purement SQL passent par le SQL Editor du projet cible.

## Ce que tu fais (hors Lovable)

1. **Schéma** — ouvrir `docs/migration/bootstrap-schema.sql` dans l'éditeur de code, copier l'intégralité, exécuter dans le SQL Editor du projet cible. Un seul run.
2. Me confirmer que le run est passé sans erreur.

## Ce que je fais ensuite

### Étape A — Contrôle du schéma
Vérification via l'API du projet cible : les 9 tables attendues, RLS active partout, présence du schéma `private` (il porte `has_role`, dont dépendent toutes les policies admin).

### Étape B — Comptes utilisateurs
Exécution de `scripts/migrate/transfer-users.ts` (dry-run puis réel). Les 7 comptes sont recréés avec le même UUID, email confirmé. Les mots de passe ne sont pas exportables : le script génère un lien de réinitialisation par compte, que je te transmets pour diffusion.

### Étape C — Données
Désactivation des triggers de recalcul sur la cible (SQL à exécuter, je te fournis le bloc), puis `scripts/migrate/transfer-data.ts` dans l'ordre des dépendances, paginé et idempotent, avec comparaison des compteurs source/cible.

Volumes : le patrimoine irremplaçable est petit (789 `user_shows`, 22 782 `watch_status`, notes, imports, profils). Le gros volume est du cache TMDb reconstructible (433 k `shows`, ~4,6 M `episodes`) — transférable, ou ignorable avec `--skip-cache` au prix d'un pic d'appels TMDb au redémarrage.

Puis réactivation des triggers et **réalignement des séquences** — sans lui, le premier « marquer vu » échoue en violation de clé primaire.

### Étape D — Edge Functions
Redéploiement des 10 fonctions de `supabase/functions/` sur la cible et recréation du secret `TMDB_API_KEY`. Aucun changement de code.

### Étape E — Google et Notion
- `/auth` passe de `@lovable.dev/cloud-auth-js` à `supabase.auth.signInWithOAuth("google")` ; le provider Google doit être activé sur la cible avec des identifiants Google Cloud à toi.
- `src/lib/feedback.functions.ts` passe de la passerelle Lovable à `api.notion.com/v1/pages` avec un token d'intégration Notion.

Ces deux bascules cassent la production si elles sont faites avant que les identifiants existent : elles se font dans la même fenêtre que l'étape F.

### Étape F — Bascule et recette
Repointage des variables client (`VITE_SUPABASE_*`) et serveur (`SUPABASE_*`) sur le projet cible, puis recette bout en bout : auth, recherche, fiche série, marquage vu, bibliothèque, calendrier, import/export, notation, feedback, `/admin`, SEO.

## Détails techniques

- `client.ts`, `client.server.ts` et `auth-middleware.ts` lisent déjà les variables d'environnement : aucun n'est à réécrire. Ils perdent en revanche leur statut de fichier auto-généré et deviennent du code à maintenir (notamment le shim `fetch` pour les clés opaques `sb_*`).
- Décision à prendre au moment de l'étape C : transférer le cache TMDb ou le laisser se reconstruire.
- Point irréversible rappelé : Lovable Cloud reste attaché au projet même après la bascule.
