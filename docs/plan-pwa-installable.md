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

## Prompt Lovable — solution A (prêt à coller)

```
Contexte : tvtrackd est un tracker de séries (TanStack Start SSR + Vite + React 19 + Supabase, déployé via Cloudflare). Objectif : rendre l'app INSTALLABLE en PWA, solution minimale SANS service worker (pas d'offline, pas de cache — on veut juste l'ajout à l'écran d'accueil et le lancement en standalone). Ne crée AUCUN service worker, n'installe PAS vite-plugin-pwa, ne modifie PAS vite.config.ts.

Contraintes de repo à respecter :
- Le <head> est géré par la fonction head() de createRootRouteWithContext dans src/routes/__root.tsx (meta/links), rendu via <HeadContent /> — il n'y a pas d'index.html statique. Ajoute donc les balises PWA dans head(), pas ailleurs.
- APP_NAME et SITE_URL vivent dans src/lib/app-config.ts. Le nom d'app et le domaine ne sont PAS tranchés juridiquement : n'écris JAMAIS "tvtrackd" en dur dans les nouveaux fichiers, dérive le nom de APP_NAME.
- Design system dark-only : fond #0B0E14, accent CTA ambre #FF8A3D, accent cyan #4DD9C4, texte #F2EDE4. N'introduis aucune nouvelle couleur, police ou pattern de composant. Réutilise le composant Switch/Button/Sheet de shadcn déjà présents, les icônes lucide-react déjà utilisées, et le hook useReducedMotion existant.

À réaliser :

1. ICÔNES (public/icons/) — génère un jeu d'icônes d'app à partir de ce glyphe abstrait (NE dessine PAS de cassette VHS ni d'écran de TV ni de triangle "play" — ce sont des clichés à éviter) :
   - fond plein #0B0E14, coin arrondi ~18% du canvas, aucun dégradé, aucun halo derrière le glyphe ;
   - au centre, deux barres arrondies horizontales empilées : la barre du haut en cyan #4DD9C4 (plus longue, ~55% de la largeur utile), la barre du bas en ambre #FF8A3D (plus courte, ~35%), fine séparation entre les deux, léger glow uniquement sur la barre cyan ;
   - jamais de chiffre lisible, le glyphe reste abstrait.
   Exporte : icon-192.png (192x192, purpose any), icon-512.png (512x512, any), icon-192-maskable.png et icon-512-maskable.png (purpose maskable : glyphe contenu dans une zone de sécurité ~80% du canvas, fond void bord à bord), apple-touch-icon.png (180x180, OPAQUE sans transparence, ne pas pré-arrondir), et remplace le favicon par défaut (32x32/16x16, + version SVG si possible). (Ces icônes sont des placeholders acceptables ; le jeu final viendra du design — garde des noms de fichiers stables.)

2. MANIFEST — crée public/manifest.webmanifest avec : name et short_name dérivés de APP_NAME (voir note ci-dessous), start_url "/", scope "/", display "standalone", theme_color "#0B0E14", background_color "#0B0E14", lang "fr", et le tableau icons pointant vers les fichiers ci-dessus (avec purpose "any" et "maskable" corrects). N'AJOUTE PAS de clé orientation (pas de lock). 
   Note name/short_name : comme un .webmanifest statique ne peut pas importer APP_NAME, préfère générer ce manifest via un server route/handler qui lit APP_NAME et renvoie le JSON avec Content-Type application/manifest+json ; si tu pars sur un fichier statique, mets une valeur cohérente avec APP_NAME et un commentaire renvoyant vers src/lib/app-config.ts comme source de vérité à resynchroniser.

3. BALISES dans head() de src/routes/__root.tsx (ne casse pas les meta existantes, dont theme-color #0B0E14 déjà présente) :
   - links : { rel: "manifest", href: "/manifest.webmanifest" }, { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" } ;
   - meta : { name: "apple-mobile-web-app-capable", content: "yes" }, { name: "apple-mobile-web-app-status-bar-style", content: "black" }, { name: "apple-mobile-web-app-title", content: <valeur APP_NAME> }.

4. BANDEAU D'INSTALLATION — crée un composant (ex. src/components/pwa-install-prompt.tsx) monté dans l'app shell, avec ces règles IMPÉRATIVES :
   a. NE JAMAIS afficher le bandeau si l'app est DÉJÀ INSTALLÉE / lancée en mode app. Détecte-le par : window.matchMedia("(display-mode: standalone)").matches === true OU (navigator.standalone === true) [cas iOS]. Si l'un des deux est vrai, le composant ne rend rien du tout.
   b. Écoute l'événement "appinstalled" sur window : dès qu'il se déclenche, masque immédiatement le bandeau ET persiste un flag localStorage ("pwa-installed") pour ne plus jamais le montrer, même après réouverture dans le navigateur.
   c. Écoute "beforeinstallprompt" (Android/Chrome) : preventDefault(), stocke l'événement différé ; le CTA du bandeau appellera .prompt() puis exploitera userChoice.
   d. Déclenchement : NE PAS montrer au premier écran ni sur un timer. N'afficher qu'après un SIGNAL D'ENGAGEMENT réel — expose un moyen (ex. un petit helper/localStorage flag "pwa-engaged" positionné) déclenché après le premier épisode marqué vu (voir src/hooks/use-mark-watched.ts) OU après un import réussi. Le bandeau apparaît seulement une fois ce flag présent.
   e. Fréquence : afficher UNE SEULE FOIS. Si l'utilisateur ferme/refuse ("Plus tard"), persiste-le en localStorage ("pwa-prompt-dismissed") et ne le remontre jamais, ni dans la session ni aux visites suivantes.
   f. Ne pas afficher sur desktop Chrome (où l'omnibox propose déjà l'installation) : n'affiche le variant Android que si l'événement beforeinstallprompt a été capté (mobile), sinon rien.
   g. iOS (Safari, non-standalone, pas de beforeinstallprompt) : au même déclencheur d'engagement, affiche le MÊME bandeau mais avec un contenu d'INSTRUCTIONS en deux étapes ("Appuyez sur Partager, puis « Sur l'écran d'accueil »") en réutilisant les icônes lucide share/plus — pas de bouton actionnable puisque iOS n'a pas d'API. Détecte iOS Safari non-standalone de façon simple (userAgent iOS + navigator.standalone !== true).
   h. Forme visuelle : une feuille basse (Sheet/carte) positionnée AU-DESSUS de la bottom nav, PAS une modale bloquante. Grammaire carte existante (fond near-void, filet 1px, rounded-xl). Un seul CTA fort en ambre "Ajouter à l'écran d'accueil" (Android) + un lien discret "Plus tard". Reveal via l'animation existante, en respectant useReducedMotion. N'introduis aucune nouvelle couleur ni animation.

Contraintes finales :
- Ne modifie aucun fichier existant hormis src/routes/__root.tsx (balises head), le montage du bandeau dans l'app shell, et éventuellement un point d'appel du flag d'engagement dans le flux "marquer vu"/"import". Tout le reste = nouveaux fichiers.
- Aucun service worker, aucun cache, aucune interception réseau (le produit est SSR + auth Supabase : on ne veut RIEN qui puisse servir du contenu périmé).
- Teste que : sur Chrome Android le bandeau apparaît après engagement et déclenche l'installation ; après installation (ou en mode standalone) le bandeau NE réapparaît JAMAIS ; sur iOS Safari les instructions s'affichent une fois ; sur desktop rien d'intrusif.
```

## Checklist

- [ ] Produire les icônes (192/512 any + maskable, apple-touch 180 opaque, favicon).
- [ ] `public/manifest.webmanifest` avec `name`/`short_name` reliés à `APP_NAME`.
- [ ] Balises `head()` dans `__root.tsx` (manifest, apple-touch-icon, meta apple-*).
- [ ] Bandeau d'install (Android `beforeinstallprompt` + variante iOS), déclenché sur engagement, une fois.
- [ ] Test réel : Chrome Android (prompt) + Safari iOS (ajout manuel, rendu standalone).
- [ ] Aucun service worker dans ce lot.
