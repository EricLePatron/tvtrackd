# Plan technique + prompt Lovable — Notifications e-mail « nouvel épisode »

> Le **QUOI** (spec produit) vit dans `docs/spec-notifications-email-nouvel-episode.md`. Ce document porte le **COMMENT** : l'architecture la plus simple, ce qu'il faut créer, le prompt Lovable prêt à coller, les risques, et les décisions ouvertes.

## Avertissement à trancher d'abord — Lovable vs Claude Code

`CLAUDE.md` dit : « Lovable n'est rouvert que pour une refonte visuelle large » et « Claude Code ne doit pas retoucher Lovable pour du dev courant ». Or migration + edge function + cron + Resend, c'est exactement du **dev backend courant** → normalement le périmètre de Claude Code, pas de Lovable.

- **Techniquement, les deux voies produisent la même architecture** (Cron → edge function → Resend). La différence est organisationnelle : qui écrit le code.
- **Voie Lovable** (demandée) : intégration Resend « one-click » rodée, mais Lovable ignore les conventions fines du repo (RLS nommées, pattern service role, `HOME_TIMEZONE`) → nécessite un prompt très cadré (fourni ci-dessous) pour ne pas dupliquer/casser l'existant, et se diffe/relit moins bien qu'une PR Claude Code.
- **Voie Claude Code** : cohérence garantie, review-able comme le reste, respecte `CLAUDE.md` à la lettre.

**À confirmer par le porteur** : envoyer le prompt Lovable, ou faire implémenter directement par Claude Code (même archi). Le reste de ce doc sert dans les deux cas.

## Architecture la plus simple (identique dans les deux voies)

```
Cron Job Supabase (1×/jour, heure fixe)
 └─► edge function `notify-new-episodes` (service role, protégée par secret)
      1. SQL : épisodes air_date = aujourd'hui (Europe/Paris) pour séries suivies
         (user_shows.status IN a_voir/en_cours), non vus (pas de watch_status),
         non déjà notifiés (pas de notification_log), user opt-in
      2. regroupe par user → 1 digest / user (jamais 1 mail / épisode)
      3. e-mail lu via admin.auth.admin.getUserById() (auth.users, service role)
      4. envoi via Resend (fetch POST, pas de SDK)
      5. INSERT notification_log (ON CONFLICT DO NOTHING) = dédup + preuve d'envoi
```

Pourquoi c'est « le plus simple » : aucune nouvelle donnée métier (réutilise `episodes.air_date`, `user_shows`, `watch_status`), un seul cron quotidien, une seule table (`notification_log` sert de dédup ET de log), Resend = un `fetch`.

## Ce qu'il faut créer

1. **Migration** (`supabase/migrations/2026080X_email_notifications.sql`, style RLS existant) :
   - `profiles.email_notifications_enabled boolean NOT NULL DEFAULT false` (opt-in — voir décision #1)
   - `profiles.unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid()`
   - table `notification_log(user_id, episode_id, sent_at, UNIQUE(user_id, episode_id))`, RLS SELECT propriétaire, write = service role
2. **Edge function** `notify-new-episodes` — avec un mode `dry_run` (calcule sans envoyer ni logger) **non négociable** pour tester avant le premier envoi réel.
3. **Edge function** `unsubscribe-notifications` — désactive l'opt-in via `unsubscribe_token`, sans auth (le token EST l'autorisation).
4. **Route publique** `src/routes/unsubscribe.tsx` (modèle `src/routes/legal/`).
5. **Toggle** dans `profile.tsx` (Switch shadcn existant, RLS `profiles_update_own` déjà couvrante).
6. **Secrets** Supabase : `RESEND_API_KEY`, `NOTIFY_CRON_SECRET` (jamais committés).

## Prompt Lovable — prêt à coller

Voir la version complète en fin de ce document (bloc ``` ```). Points clés : référence le schéma exact, impose les conventions des edge functions existantes (`export-data`, `public-calendar`), digest quotidien, opt-in `DEFAULT false`, dédup `notification_log`, `dry_run`, désabonnement par token, expéditeur + heure laissés en **placeholders explicites** (à ne pas deviner).

## Risques & garde-fous

- **Délivrabilité / domaine non tranché** : Resend exige un domaine vérifié (SPF/DKIM). Tant que le nom de domaine n'est pas arbitré, sandbox Resend en test uniquement, **jamais d'envoi réel** → bloquant pour le lancement, pas pour le dev.
- **Fuseaux** : le cron raisonne en UTC, dérive d'1h entre CET/CEST — à documenter ou recalculer l'heure cible dans la fonction.
- **Idempotence** : `INSERT … ON CONFLICT DO NOTHING` obligatoire (un double run ne doit jamais produire un double mail).
- **Coût Resend** : palier gratuit limité (~100/j) — surveiller à mesure que l'opt-in grossit.
- **Secrets en dur** : Lovable code parfois des valeurs par défaut en dur — vérifier après génération.
- **QA** : la migration ne doit toucher aucune policy existante (`git diff` = 0 sur les migrations existantes), lint/typecheck propres, edge functions existantes intactes.

## Décisions ouvertes (le porteur tranche)

| # | Décision | Options | Reco |
|---|---|---|---|
| 1 | Opt-in par défaut | Opt-in (`DEFAULT false`, RGPD-safe) vs opt-out (`DEFAULT true`, adoption max) | **Opt-in** (marché FR / RGPD ; le domaine n'est pas prêt donc pas d'urgence à maximiser). 1 ligne à changer pour basculer. Avis juridique conseillé si opt-out. |
| 2 | Heure d'envoi | 18h Europe/Paris (écho « Ce soir ») vs 08h (matin) | **18h** — cohérent avec le hero d'accueil et laisse le temps de regarder le soir même. Paramétrable. |
| 3 | Périmètre statut | `en_cours` seul vs `+ a_voir` | **`en_cours` seul** au MVP, `a_voir` en v1.1 selon volume. |
| 4 | Expéditeur / domaine | dépend du nom de domaine non tranché | Placeholder explicite tant que non tranché — **bloquant envoi réel**. |
| 5 | Lovable vs Claude Code | voir avertissement en tête | À confirmer. |

---

## Bloc prompt Lovable (copier tel quel, ajuster les [PLACEHOLDERS])

```
Contexte : tvtrackd est un tracker de séries (TanStack Start + Supabase Postgres/Auth/Edge Functions + TMDb). Le schéma existant (NE PAS le modifier ni le recréer, seulement l'étendre) :

- profiles(id uuid → auth.users, username, avatar_url, created_at)
- shows(id, tmdb_id, media_type, title, poster_path, overview, first_air_date, status, cached_at)
- seasons(id, show_id, season_number, episode_count)
- episodes(id, show_id, season_number, episode_number, title, air_date date, overview)
- user_shows(id, user_id, show_id, status: a_voir/en_cours/termine/abandonne/archive) — UNIQUE(user_id, show_id), RLS auth.uid() = user_id
- watch_status(id, user_id, episode_id, watch_count, watched_at, watched_at_approximate) — UNIQUE(user_id, episode_id), RLS auth.uid() = user_id
- L'e-mail de l'utilisateur est dans auth.users, PAS dans profiles. Pour le lire il faut du service role (admin.auth.admin.getUserById(userId)), jamais exposé côté client.

Convention des edge functions existantes (à respecter à l'identique, voir supabase/functions/export-data/index.ts et supabase/functions/public-calendar/index.ts comme référence de style) :
- import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"
- const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
- CORS partagé via supabase/functions/_shared/cors.ts (corsHeaders)
- Réponses JSON via Response.json(...), erreurs loguées avec console.error("[nom-fonction]", err) puis status 500

Objectif : envoyer un e-mail digest quotidien "nouveaux épisodes disponibles aujourd'hui" aux utilisateurs opt-in, pour les épisodes de leurs séries suivies (user_shows.status IN ('a_voir','en_cours')) qui sont sortis aujourd'hui (episodes.air_date = date du jour, fuseau Europe/Paris) et pas encore marqués vus (aucune ligne watch_status pour ce user_id/episode_id).

À créer :

1. Migration SQL (nouveau fichier dans supabase/migrations/, même style que les migrations existantes : GRANT explicites + RLS nommée xxx_own) :
   - ALTER TABLE profiles ADD COLUMN email_notifications_enabled boolean NOT NULL DEFAULT false ; (opt-in, PAS opt-out par défaut)
   - ALTER TABLE profiles ADD COLUMN unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid() ;
   - CREATE TABLE notification_log (id serial primary key, user_id uuid references auth.users(id) on delete cascade, episode_id int references episodes(id) on delete cascade, sent_at timestamptz default now(), UNIQUE(user_id, episode_id)) — RLS activée, SELECT réservé au propriétaire (auth.uid() = user_id), aucun INSERT/UPDATE/DELETE pour authenticated (uniquement service_role).
   - Ne touche à AUCUNE autre table ni policy existante.

2. Edge function supabase/functions/notify-new-episodes/index.ts, appelée quotidiennement par un Cron Job Supabase (à configurer à 18h00 Europe/Paris — ajuste l'heure UTC du cron selon heure d'été/hiver, ou documente la limite si non géré automatiquement) :
   - Protégée par un secret partagé (nouveau secret NOTIFY_CRON_SECRET, vérifié via un header custom) — pas d'endpoint public appelable librement.
   - Supporte un paramètre dry_run=true (query param ou variable d'env NOTIFY_DRY_RUN) qui calcule tout mais N'ENVOIE AUCUN mail et n'écrit rien dans notification_log — juste un retour JSON listant ce qui aurait été envoyé. Indispensable pour tester avant activation réelle.
   - Sélectionne, en service role, les couples (user_id, episode) éligibles : show suivi (a_voir/en_cours), episodes.air_date = aujourd'hui (Europe/Paris, PAS UTC brut — calcule "aujourd'hui" avec Intl.DateTimeFormat côté Deno, comme le fait déjà src/lib/schedule.ts côté client, pour rester cohérent avec ce que l'utilisateur voit dans l'app), pas déjà dans watch_status, pas déjà dans notification_log, et profiles.email_notifications_enabled = true.
   - Regroupe par user_id (un seul mail digest par utilisateur, listant toutes ses séries/épisodes du jour — jamais un mail par épisode).
   - Récupère l'e-mail de chaque utilisateur via admin.auth.admin.getUserById(userId).
   - Envoie via l'API Resend (fetch direct vers https://api.resend.com/emails, pas de SDK nécessaire), avec le secret RESEND_API_KEY (nouveau secret, à ajouter — ne PAS deviner ni committer l'expéditeur : utilise une variable NOTIFY_FROM_EMAIL, ex. "notifications@[DOMAINE_À_CONFIRMER]", laissée en placeholder explicite tant que le domaine définitif n'est pas tranché).
   - Après envoi réussi (hors dry_run), insère les lignes correspondantes dans notification_log avec ON CONFLICT DO NOTHING pour ne jamais renvoyer le même épisode deux fois au même utilisateur (idempotence si le cron est relancé).
   - Template e-mail HTML simple et sobre : fond sombre proche de #0B0E14, accent #FF8A3D, texte clair, polices web-safe (pas de webfont custom dans le mail — les clients mail les chargent mal), objet type "Ce soir : un nouvel épisode de {série}" (ou "Ce soir : N séries suivies ont un nouvel épisode"), liste "Ce soir au programme" avec titre de série + numéro d'épisode (format "S02 · E06"), un seul CTA vers l'app, et en pied de mail un lien de désabonnement vers https://[DOMAINE]/unsubscribe?token={unsubscribe_token de l'utilisateur}.

3. Edge function supabase/functions/unsubscribe-notifications/index.ts : reçoit un token en query param, met à jour profiles.email_notifications_enabled = false pour le profil dont unsubscribe_token correspond, retourne une confirmation JSON simple. Pas d'authentification requise (le token EST l'autorisation) mais valide qu'un token vide/invalide ne fait rien planter.

4. Route front src/routes/unsubscribe.tsx (page publique, non authentifiée, sur le modèle des pages simples de src/routes/legal/) : lit le paramètre ?token= de l'URL, appelle unsubscribe-notifications, affiche un message de confirmation clair ("Vous ne recevrez plus de notifications par e-mail").

5. Dans src/routes/_authenticated/profile.tsx, ajoute un switch "Recevoir un e-mail pour les nouveaux épisodes disponibles" qui lit/écrit profiles.email_notifications_enabled (déjà couvert par la policy RLS profiles_update_own existante, pas de nouvelle policy nécessaire) — utilise le composant Switch de shadcn/ui déjà utilisé ailleurs dans le projet, pas un nouveau composant.

Contraintes impératives :
- Ne modifie AUCUN fichier existant en dehors de profile.tsx (ajout du switch) et de la création des nouveaux fichiers listés ci-dessus.
- Ne casse aucune RLS existante, ne touche à aucune policy autre que celles créées ici.
- N'introduis pas de nouvelle couleur d'accent, police, ou pattern de composant hors de ceux déjà utilisés dans le projet.
- Ne devine pas le domaine d'expéditeur ni l'heure exacte du cron si ambigu — laisse-les en variable/placeholder explicite documenté en commentaire.
- Version minimale acceptable si le temps presse : uniquement l'edge function notify-new-episodes + la migration + le secret Resend + le dry_run, SANS la page unsubscribe (le lien de désabonnement peut alors pointer vers un mailto/support en attendant) — dans ce cas laisse un commentaire TODO explicite dans le template mail.

Lignes à ajuster si la cadence change :
- Heure du cron (18h00 Europe/Paris) — dans la config du Cron Job Supabase.
- Fenêtre "aujourd'hui" (episodes.air_date = date du jour) — clause WHERE de notify-new-episodes/index.ts.
- Contenu du template mail — section génération HTML de notify-new-episodes/index.ts.
```

## Checklist de mise en place

1. Trancher Lovable vs Claude Code (avertissement en tête).
2. Confirmer le domaine d'envoi (ou sandbox Resend en test seulement).
3. Créer la clé Resend + ajouter `RESEND_API_KEY` et `NOTIFY_CRON_SECRET` en secrets Supabase.
4. Envoyer le prompt Lovable (ou implémenter via Claude Code).
5. Tester en `dry_run` sur un compte réel avant d'activer le cron.
6. Activer le cron, surveiller volume / erreurs Resend / plaintes spam.
7. QA : RLS intacte, lint/typecheck OK, toggle profil + désabonnement fonctionnels.
