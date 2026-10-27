# Infrastructure — référence technique

État de la production. Aucun secret dans ce fichier : les valeurs publiques
(URL Supabase, clé `sb_publishable_…`, `SITE_URL`) sont dans [`.env.example`](../.env.example)
et `wrangler.jsonc`.

## Parcours d'une requête

```
Navigateur
   │  tvtrackd.com
   ▼
OVH (registrar : nom de domaine, renouvellement annuel ; MX email mx1/2/3.mail.ovh.net)
   │  serveurs DNS délégués à Cloudflare
   ▼
Cloudflare
   ├─ DNS (zone tvtrackd.com, DNSSEC)
   ├─ Sécurité (AI Crawl Control, Redirect Rule www → racine)
   └─ Worker `tvtrackd` (TanStack Start SSR, plan gratuit)
          │  clé publishable (navigateur) / clé sb_secret (serveur)
          ▼
      Supabase (projet wrzexhpjsmddsbimvqaw)
          ├─ Postgres + RLS, Auth, Storage
          └─ Edge Functions ──► TMDb API (métadonnées, cache en base 24-48h)

Connexion Google : navigateur ─► Google OAuth ─► https://wrzexhpjsmddsbimvqaw.supabase.co/auth/v1/callback
                   ─► Supabase Auth ─► retour sur le Site URL (https://tvtrackd.com)
```

## Services

| Service                      | Rôle                                                                                                                                                                 | Où se règle quoi                                                                                                     | Coût                                |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| OVH                          | Registrar de `tvtrackd.com`, emails `@tvtrackd.com` éventuels (MX OVH)                                                                                               | Manager OVH : serveurs DNS (Cloudflare : `melody` / `weston.ns.cloudflare.com`), onglet DS Records                   | Renouvellement annuel du domaine    |
| Cloudflare DNS               | Zone `tvtrackd.com`. CNAME email OVH en « DNS only ». `AAAA www → 100::` proxied                                                                                     | Dashboard → DNS ; DNSSEC activé côté Cloudflare                                                                      | Gratuit                             |
| Cloudflare Worker `tvtrackd` | App SSR. Custom domain `tvtrackd.com`. `tvtrackd.ericlepatron.workers.dev` reste actif pour les tests                                                                | Worker → Domains ; `wrangler.jsonc` (vars publiques) ; secrets via `wrangler secret put`                             | Plan gratuit, 100 000 requêtes/jour |
| Cloudflare Rules / Bots      | Redirect Rule `www` → racine (301, query string conservée). `Meta-ExternalAgent` et `Bytespider` bloqués. Bot Fight Mode volontairement désactivé (aperçus de liens) | Dashboard → Rules ; AI Crawl Control                                                                                 | Gratuit                             |
| Supabase                     | Postgres, Auth, Edge Functions, Storage                                                                                                                              | Dashboard projet `wrzexhpjsmddsbimvqaw` ; `supabase/` dans le repo                                                   | Plan gratuit                        |
| Google Cloud                 | Client OAuth Web pour la connexion Google                                                                                                                            | Console → APIs & Services → Credentials / écran de consentement (scopes de base, publication en production en cours) | Gratuit                             |
| TMDb                         | Source des métadonnées                                                                                                                                               | Clé API côté edge functions                                                                                          | Gratuit                             |
| Notion                       | Feedback utilisateur (`api.notion.com`)                                                                                                                              | `NOTION_API_KEY` **pas encore configuré**, volontairement remis à plus tard                                          | Gratuit                             |
| GitHub                       | Code source. L'app lovable.dev n'a plus accès au repo                                                                                                                | Repo                                                                                                                 | Gratuit                             |

## Données et historique

- Le schéma a été appliqué depuis `docs/migration/schema-consolidated.sql`, et non en
  rejouant `supabase/migrations/`.
- Aucune donnée n'a été migrée depuis Lovable Cloud (ancien projet inaccessible).
  `scripts/migrate/*` et `docs/migration/RUNBOOK.md` sont historiques.

## Procédures

### Déployer le front

```bash
bun install
bun run deploy        # bun run build && wrangler deploy
```

`bunx wrangler login` une première fois. Les `VITE_*` sont injectées au build depuis `.env`.
`bun run preview` exécute le build dans workerd en local (secrets via `.dev.vars`, gitignoré).

### Déployer les edge functions

```bash
bunx supabase functions deploy <noms> --project-ref wrzexhpjsmddsbimvqaw
```

Les fonctions lisent la clé secrète via `SUPABASE_SECRET_KEYS` (injecté par Supabase) ou
`SB_SECRET_KEY` (voir `supabase/functions/_shared/admin.ts`).

### Poser ou faire tourner un secret

- **Worker** : `bunx wrangler secret put SUPABASE_SERVICE_ROLE_KEY` (valeur `sb_secret_…`),
  idem `NOTION_API_KEY` le moment venu. Un secret n'a pas besoin de redéploiement du code.
- **Supabase** : créer la nouvelle clé `sb_secret_…` dans Project Settings → API Keys, la poser
  dans le Worker, redéployer les fonctions si elles utilisent `SB_SECRET_KEY`
  (`bunx supabase secrets set SB_SECRET_KEY=… --project-ref wrzexhpjsmddsbimvqaw`), vérifier, puis
  révoquer l'ancienne.
- Les clés legacy JWT (anon / service_role) sont désactivées. Le legacy JWT secret est en cours de
  révocation, après rotation vers une clé de signature ECC P-256 (cause : fuite de l'ancienne clé
  service_role dans une capture d'écran).
- Ne jamais committer de secret ; `.env` et `.dev.vars` sont gitignorés.

### Changer de domaine ou ajouter une URL

1. `VITE_SITE_URL` (`.env`, injectée au build) et `SITE_URL` (`wrangler.jsonc` → `vars`).
2. Supabase → Auth → URL Configuration : Site URL (actuellement `https://tvtrackd.com`) et Redirect
   URLs (actuellement `https://tvtrackd.com/**`, `https://tvtrackd.ericlepatron.workers.dev/**`,
   `http://localhost:5173/**`).
3. Google Cloud → client OAuth → Authorized JavaScript origins (actuellement `localhost:5173`,
   l'URL workers.dev, `https://tvtrackd.com`). La Redirect URI reste
   `https://wrzexhpjsmddsbimvqaw.supabase.co/auth/v1/callback`.
4. Cloudflare : ajouter le Custom domain au Worker (Worker → Domains), vérifier la Redirect Rule `www`.
5. `bun run deploy`.

### Bloquer un crawler

Cloudflare → AI Crawl Control : passer le crawler en « Block ». Déjà bloqués : `Meta-ExternalAgent`
(150 000 requêtes/jour, a déclenché l'alerte de quota) et `Bytespider`. Ne pas activer Bot Fight Mode
(casse les aperçus de liens).

## Points de vigilance

- **Worker gratuit : 100 000 requêtes/jour.** Surveiller le trafic bot ; au-delà, le service est
  dégradé. Un passage au plan payant est la solution de repli.
- **Supabase gratuit** : 500 000 invocations d'edge functions par mois, base limitée à 500 Mo.
- **Deploy to production (intégration GitHub Supabase) : à laisser désactivé** tant que l'historique
  de migrations n'est pas aligné avec la base (le schéma vient de `schema-consolidated.sql`).
- **DNSSEC** : désactivé chez OVH avant la bascule des serveurs DNS, réactivé côté Cloudflare, avec un
  DS record déclaré chez OVH (onglet DS Records). La publication de ce DS peut être encore en cours :
  ne pas désactiver DNSSEC côté Cloudflare sans retirer d'abord le DS chez OVH, sous peine de rendre
  le domaine non résolvable.
