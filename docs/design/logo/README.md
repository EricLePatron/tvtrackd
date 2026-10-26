# Logo — symbole « volet de compteur »

Statut : proposition v1. Le favicon et l'icône d'app PWA sont intégrés (voir §5) ; le composant `Logo`, l'`og:image` et le wordmark restent à faire. Ouvrir `preview.html` pour la planche.

## 1. Pistes explorées

| Piste                              | Idée                                                                                                                                                                                 | Verdict                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| A. Talon de billet                 | Rectangle à encoches latérales, chiffre au centre                                                                                                                                    | Rejetée : « icône ticket » générique (cinéma, événementiel), ne dit rien du suivi |
| B. Cassette / bobines              | Deux cercles + fenêtre                                                                                                                                                               | Rejetée : pastiche VHS littéral, interdit par CLAUDE.md                           |
| C. Play dans carré arrondi         | Triangle ambre dans un carré sombre                                                                                                                                                  | Seule, c'est l'icône de n'importe quel lecteur vidéo : échoue au test du swap     |
| **D. Volet de compteur** (retenue) | Fenêtre de compteur sombre (`--bg-surface-raised`) contenant un play ambre, coupé par une charnière horizontale façon afficheur à palettes (split-flap), + filet cyan de progression | Retenue                                                                           |

## 2. Piste retenue

Une fenêtre arrondie `#1E2530` = le module du compteur signature. Dedans, un triangle « play » ambre `#FF8A3D` (en cours / prochain épisode), coupé en deux par une fine charnière (transparente dans `symbol.svg` et `favicon.svg`, peinte en `#0B0E14` dans les icônes d'app) : le geste d'un afficheur mécanique qui s'apprête à tourner. Un filet cyan `#4DD9C4` en pied = la progression vue. Aucune lettre : le symbole ne dépend pas du nom.

Provenance (anti-ia-slop) :

- **Concept** : compteur mécanique du CLAUDE.md, traduit par la charnière de palette, sans cassette ni scanlines. La fenêtre est le même objet que le compteur dans l'UI : le logo et le produit partagent une pièce.
- **Marché** : sobriété = fiabilité perçue (post-TV Time, face à Betaseries). Une seule forme, deux couleurs, pas de mascotte ni d'accent « fun ».
- **Écart concurrentiel** : Letterboxd (3 points), TV Time (cartoon), Trakt (T/coche), Betaseries (wordmark) — aucun n'occupe « play + mécanique de compteur ».

Test du swap : on met le symbole sur un CRM — le play ambre en carré sombre pourrait passer, **mais la charnière + filet cyan n'ont aucun sens hors suivi de progression**. Résultat honnête : _moyennement fragile au swap_. Le play seul reste un cliché de catégorie ; la charnière est ce qui marque. Marqueurs du catalogue : pas de dégradé, glow, glassmorphism, ni des trois esthétiques interdites (fond sombre + ambre ET cyan, pas « accent unique »). Risque connu : proximité visuelle avec des icônes de lecteurs ; à surveiller dans une recherche d'antériorité (ci-dessous).

## 3. Fichiers

| Fichier                                | Usage                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `symbol.svg`                           | Symbole couleur, utilisable sur fond clair et sombre (porte sa propre fenêtre)                                                                                                                                                                                                                                                    |
| `symbol-mono.svg`                      | Une couleur via `currentColor`, motif détouré (charnière, play, filet transparents)                                                                                                                                                                                                                                               |
| `favicon.svg`                          | Simplifié 16–32 px : tuile arrondie rx 14, coins transparents, play agrandi, charnière 4 u, sans filet                                                                                                                                                                                                                            |
| `app-icon.svg`                         | Icône d'app plein cadre, viewBox 64, 100 % opaque : fond `#1E2530`, contenu (play + filet cyan) à l'échelle 0,88 et inscrit dans le cercle de diamètre 80 % (rayon 25,6 u), charnière de 2,4 u peinte en `#0B0E14`, centrée sur le play (iOS refuse la transparence). Source de `apple-touch-icon.png` et `icon-512-maskable.png` |
| `app-icon-any.svg`                     | Variante `purpose: any` : même contenu (échelle 0,88, charnière 2,4 u peinte `#0B0E14`) sur une tuile arrondie rx 14/64 aux coins transparents (PNG RGBA). Source de `icon-192.png` et `icon-512.png`                                                                                                                             |
| `lockup-horizontal(.svg / -light.svg)` | Symbole + wordmark ; la version claire inverse fenêtre et texte en `#0B0E14`                                                                                                                                                                                                                                                      |
| `lockup-stacked(.svg / -light.svg)`    | Version empilée (partage social, splash)                                                                                                                                                                                                                                                                                          |
| `wordmark.svg` / `wordmark-light.svg`  | Texte seul                                                                                                                                                                                                                                                                                                                        |
| `preview.html`                         | Planche (charge les SVG voisins par `<img>` : l'ouvrir depuis ce dossier)                                                                                                                                                                                                                                                         |

**Wordmark PROVISOIRE** : « TVTrackd » dessiné en tracés géométriques (traits de 7 u, polygones) pour ne dépendre d'aucune police. Ce n'est PAS de l'Archivo Expanded : approximation extended-bold à retravailler une fois le nom tranché. Dans les lockups il est isolé dans `<g id="wm">` : remplacer ce groupe suffit. Les traits sont des `stroke` non convertis en contours : convertir en contours avant export print/impression si nécessaire.

## 4. Règles d'usage

- **Taille mini** : symbole 16 px (utiliser `favicon.svg` sous 32 px) ; lockup horizontal 96 px de large ; lockup empilé 80 px.
- **Zone de protection** : 1/4 de la hauteur de la fenêtre (soit ≈ 14 u sur la grille 64) de vide autour du symbole, 1/2 de x-height du wordmark entre symbole et texte dans le lockup horizontal.
- **Fonds** : symbole sur tout fond ; sur un fond proche de `#1E2530` (sombre moyen), utiliser `app-icon.svg` ou ajouter une marge `#0B0E14`. Wordmark clair sur sombre, `#0B0E14` sur clair.
- **Interdits** : changer les couleurs ou en ajouter ; dégradé, ombre, glow, contour ; étirer ; faire tourner/animer en boucle ; ajouter scanlines/bruit/cassette ; inverser ambre et cyan ; recouper la charnière avec autre chose ; utiliser le play seul sans fenêtre.
- Animation autorisée (optionnelle) : un seul « flip » de la moitié inférieure au premier chargement, respect de `prefers-reduced-motion`. Jamais en boucle.

> Note antériorité : lors de la recherche d'antériorité, vérifier aussi la proximité avec l'icône Plex (forme ambre sur fond sombre), en plus des icônes de lecteurs vidéo.

## 5. Intégration (état réel)

### Fait

- **Fichiers dans `public/`** : `favicon.svg` (copie nettoyée de `docs/design/logo/favicon.svg`, charnière transparente), `favicon.ico` (16/32/48), `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png` (`purpose: any`) et `icon-512-maskable.png` (`purpose: maskable`). `icon-192.png` et `icon-512.png` (`any`) sont rendus depuis `app-icon-any.svg` (RGBA, coins transparents) ; `icon-512-maskable.png` et `apple-touch-icon.png` sont rendus depuis `app-icon.svg` (plein cadre, RGB opaques).
- **Manifest** : servi dynamiquement par la route `src/routes/manifest[.]webmanifest.ts` sur `/manifest.webmanifest` (`application/manifest+json`). `name` et `short_name` valent `APP_NAME` (`src/lib/app-config.ts`), `display: standalone`, `background_color` et `theme_color` `#0B0E14`. Pas de service worker (donc pas de mode hors ligne).
- **Head** (`src/routes/__root.tsx`) : `rel="icon"` svg + ico, `apple-touch-icon`, `rel="manifest"`, `theme-color`, `apple-mobile-web-app-title` (`APP_NAME`).

### Régénérer les PNG et l'ICO

`scripts/generate-icons.mjs` rend `app-icon.svg`, `app-icon-any.svg` et `favicon.svg` dans `public/`. Il demande Playwright + Chromium, volontairement non déclarés dans `package.json` :

```
# soit installer Playwright
bun add -d playwright && bunx playwright install chromium
node scripts/generate-icons.mjs

# soit réutiliser une installation existante
NODE_PATH=/chemin/vers/node_modules node scripts/generate-icons.mjs
```

Sans Playwright, le script s'arrête avec un message d'erreur explicatif. `public/favicon.svg` n'est pas généré : le recopier à la main depuis `favicon.svg` (sans `width`/`height`/`role`/`aria-label`) si la source change.

### Reste à faire

1. **Composant React `Logo`** (`src/components/brand/logo.tsx`) :
   - Props : `variant: "symbol" | "horizontal" | "stacked"`, `tone: "dark" | "light"`, `size`, `className`, `title`.
   - Symbole inliné en JSX (`symbol.svg`), id du mask préfixé via `useId()`.
   - Wordmark rendu en texte `APP_NAME` (Archivo Expanded bold), pas le groupe SVG figé, pour que le changement de nom ne casse rien.
   - `aria-hidden` si le nom est affiché à côté, sinon `role="img"` + `aria-label={APP_NAME}`.
   - Remplacer le texte nu `{APP_NAME}` de l'onboarding (`onboarding-carousel.tsx`) et les en-têtes.
2. **`og:image` par défaut** : `og-default.png` 1200×630 (fond `#0B0E14`, `lockup-stacked.svg` centré, ~45 % de la hauteur) + `og:image` absolu via `SITE_URL`. À faire une fois le nom tranché (wordmark provisoire). Ne pas écraser les `og:image` des fiches (affiches TMDb).
3. **Nettoyage des « tvtrackd » en dur dans `__root.tsx`** (title, description, author, `og:site_name`, JSON-LD) : les faire lire `APP_NAME` quand le nom est tranché.
4. **Tests non faits** : installation sur un iOS/Android réel, build Cloudflare (contenu de `.output/public`).

## 6. Points à arbitrer par l'utilisateur

1. Nom : « TV Tract » (votre message) vs « TVTrackd » (CLAUDE.md) vs autre — les assets statiques (og, wordmark) sont à refaire une fois tranché ; le symbole non.
2. Le play seul est un cliché de catégorie ; vous satisfait-il comme base ou veut-on une 2e piste sans triangle (ex. chiffre « 0|1 » en volet) ?
3. Wordmark : garder des lettres dessinées maison, ou commander un vrai lettrage dérivé d'Archivo Expanded.
4. Recherche d'antériorité sur le symbole (play + volet) avant dépôt, en plus de la vérification du nom (TMview/INPI).
5. Animation « flip » du premier chargement : oui/non.
