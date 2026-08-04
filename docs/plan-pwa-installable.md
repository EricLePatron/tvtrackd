# Plan — PWA installable (solutions possibles)

> Item P0 « PWA installable » de `etude-etat-des-lieux-2026-08.md` (effort S). Étude croisée développeur (solutions techniques) + design (icône & UX d'installation). Phase 1 : plan uniquement, aucun code écrit.

## Recommandation en une ligne

**Solution (A) : manifest-only, sans service worker** — c'est le plus simple, ça satisfait les vrais critères d'installabilité, risque nul vis-à-vis du SSR/auth. Icône = **glyphe abstrait tiré du compteur VHS** (pas de cassette littérale). Prompt d'installation **sobre, déclenché après un signal d'engagement**, jamais au premier écran.

## Les 3 solutions techniques comparées

| | (A) Manifest-only | (B) `vite-plugin-pwa` (Workbox) | (C) Manifest + SW manuel |
|---|---|---|---|
| Apporte | Installable + splash + standalone | + offline partiel, update SW, base push web | + offline à scope maîtrisé |
| Effort | **Très faible (S)** — 1 JSON + balises `head()` | Moyen (piège d'intégration, voir ci-dessous) | Moyen-élevé (tout écrit à la main) |
| Risque cache × SSR × auth | **Nul** (aucune interception réseau) | Élevé — un SW mal scopé sert du contenu périmé sur `_authenticated/*` ou casse une redirection SSR | Maîtrisable mais présent |
| Réversibilité | **Totale** (retirer le fichier) | Moyenne (désinstaller le SW déjà en place chez les users) | Moyenne (idem) |
| « Fiable avant ambitieux » | Excellente | Mauvaise pour un 1er jet | OK seulement si besoin offline réel |

**Piège (B) spécifique à ce repo** : `vite-plugin-pwa` suppose un `index.html` statique transformé par Vite + une intégration SSR dédiée. Or ici le `<head>` est piloté par `head()` + `<HeadContent />` (TanStack Start), et le build passe par le preset nitro/Cloudflare embarqué dans `@lovable.dev/vite-tanstack-config` (config opaque). L'auto-injection manifest/SW risque de ne pas s'appliquer → il faudrait injecter le `<link rel="manifest">` et enregistrer le SW à la main, et valider l'absence de conflit avec le build Cloudflare. Effort réel > « S ».

→ **(B)/(C) écartées à ce stade.** L'offline n'est pas dans le scope de l'item, et un SW qui sert du stale sur les pages authentifiées est exactement le type de bug qui abîmerait le positionnement « fiable » vs Betaseries. À réévaluer seulement si un besoin offline explicite émerge (ex. consulter sa bibliothèque hors-ligne) — et alors (C) à scope strictement limité au shell public, pas (B) tel quel.

## Critères d'installabilité réels (ce qu'exige (A))

- **Chrome/Android** : manifest lié (`<link rel="manifest">`) avec `name`/`short_name`, icônes **192** & **512** (+ **maskable** recommandée), `start_url`, `display: standalone`, servi en HTTPS. Un **service worker n'est plus requis** pour l'installabilité de base. `beforeinstallprompt` permet un CTA custom.
- **iOS/Safari** : **pas de prompt automatique, jamais** — ajout manuel « Partager → Sur l'écran d'accueil ». Le manifest est partiellement lu depuis iOS 16.4+, sinon repli sur les meta Apple : `apple-touch-icon` (180×180, **opaque, sans alpha**), `apple-mobile-web-app-capable="yes"`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`.

**À communiquer honnêtement** : la PWA donne la « présence sur l'écran d'accueil » en 1 clic sur Android, mais reste **manuelle sur iOS** quelle que soit la solution — ne pas présenter iOS comme résolu au même niveau qu'Android.

## Où ça vit dans le repo (solution A)

- `public/manifest.webmanifest` (nouveau) — `name`/`short_name`/`display: standalone`/`start_url: "/"`/`theme_color`/`background_color`/`icons[]`. **`name`/`short_name` dérivés de `APP_NAME`, jamais en dur** : soit un route-handler qui génère le JSON en lisant `APP_NAME`, soit un littéral commenté pointant `app-config.ts` comme source à resynchroniser (à trancher en impl).
- `public/icons/` (nouveau) — icônes fournies par le design (voir plus bas).
- `src/routes/__root.tsx` — ajouts dans `head()` : `link rel="manifest"`, `link rel="apple-touch-icon"`, meta `apple-mobile-web-app-*`.
- **Pas de service worker** dans ce lot.

## Direction design — l'icône & le thème installé

**Icône = glyphe « Tally »**, abstraction du **compteur VHS** (l'élément signature `vhs-counter.tsx`), pas de la cassette (déjà flaggée anti-slop) :
- fond plein `#0B0E14` (pas de dégradé, pas de halo de fond), coin arrondi ~18 % (cohérent `rounded-xl`).
- deux barres arrondies empilées : **cyan `#4DD9C4`** (plus longue, « vu ») au-dessus d'une **ambre `#FF8A3D`** (plus courte, « en cours »), glow local à la barre cyan uniquement — jamais un chiffre lisible, jamais une cassette.
- **Test anti-slop** : swappé sur un autre produit, les barres cyan/ambre n'auraient aucun sens → soudé au concept.

**Assets à livrer** : 192 & 512 (`any`), 192 & 512 (`maskable`, glyphe dans la zone de sécurité ~80 %), `apple-touch-icon` 180 (opaque), favicon 16/32 (+ SVG). Dark-only, pas de variante claire.

**Thème installé** : `theme_color` **et** `background_color` = `#0B0E14` (= la meta déjà en place). iOS `status-bar-style: black` (opaque), `display: standalone` (barre système visible), pas de lock d'orientation. **Splash = auto-génération OS** à partir de (background_color + icône 512 + nom) — pas de matrice d'`apple-touch-startup-image` à maintenir. Splash animé « mise sous tension » = raffinement v2.

## UX du moment d'installation

- **Jamais au premier écran.** Déclencher après un **signal d'engagement réel** : premier épisode marqué vu, ou import réussi (le moment où « ne plus perdre mes données » résonne le plus). Premier atteint gagne.
- **Une seule fois**, refus/affichage stocké en `localStorage`, **aucune récurrence** (un nag répété = friction qui use la confiance).
- **Garde-fous** : ne rien montrer si déjà en `display-mode: standalone`, ni sur desktop Chrome (l'omnibox a déjà l'affordance).
- **Forme** : feuille basse au-dessus de la bottom nav (pas une modale bloquante), grammaire carte existante (near-void, filet 1px, `rounded-xl`), 1 CTA ambre « Ajouter à l'écran d'accueil » + fermer discret, reveal existant (`useReducedMotion`).
- **Android** : écoute `beforeinstallprompt`, le CTA déclenche `prompt()`. **iOS** : même carte au même moment, mais instructions « Partager → Sur l'écran d'accueil » (icônes lucide share/plus déjà standard), pas de bouton natif.

## Priorisation

**MVP du chantier P0** : jeu d'icônes (Tally) + `manifest.webmanifest` + meta iOS + bandeau d'install custom (Android prompt + variante instructions iOS, une fois, sur engagement).
**À différer** : splash animé sur mesure, screenshots manifest (dialog desktop Chrome), badge de notif sur l'icône (dépend du chantier notifications).

## Voie d'implémentation

Dev courant (ajout de fichiers/balises, pas de refonte visuelle) → **Claude Code** selon `CLAUDE.md`. Lovable non nécessaire ici.

## Points à ne pas deviner

- Nom final (`APP_NAME`) et domaine (`SITE_URL`) non tranchés → pas de littéral en dur dans le manifest.
- Décider si on profite de ce lot pour migrer les littéraux « tvtrackd » déjà en dur dans `__root.tsx` (title/og/JSON-LD) vers `APP_NAME` (aujourd'hui documenté comme hors-scope délibéré) — à trancher explicitement.
- Exports d'icônes = dépendance à la production des assets design.

## Checklist

- [ ] Produire les icônes (192/512 any + maskable, apple-touch 180 opaque, favicon).
- [ ] `public/manifest.webmanifest` avec `name`/`short_name` reliés à `APP_NAME`.
- [ ] Balises `head()` dans `__root.tsx` (manifest, apple-touch-icon, meta apple-*).
- [ ] Bandeau d'install (Android `beforeinstallprompt` + variante iOS), déclenché sur engagement, une fois.
- [ ] Test réel : Chrome Android (prompt) + Safari iOS (ajout manuel, rendu standalone).
- [ ] Aucun service worker dans ce lot.
