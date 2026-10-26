# Logo — symbole « volet de compteur »

Statut : proposition v1, non rendue visuellement par moi (aucun navigateur disponible) — ouvrir `preview.html` et valider à 16/32 px avant toute intégration.

## 1. Pistes explorées

| Piste | Idée | Verdict |
|---|---|---|
| A. Talon de billet | Rectangle à encoches latérales, chiffre au centre | Rejetée : « icône ticket » générique (cinéma, événementiel), ne dit rien du suivi |
| B. Cassette / bobines | Deux cercles + fenêtre | Rejetée : pastiche VHS littéral, interdit par CLAUDE.md |
| C. Play dans carré arrondi | Triangle ambre dans un carré sombre | Seule, c'est l'icône de n'importe quel lecteur vidéo : échoue au test du swap |
| **D. Volet de compteur** (retenue) | Fenêtre de compteur sombre (`--bg-surface-raised`) contenant un play ambre, coupé par une charnière horizontale façon afficheur à palettes (split-flap), + filet cyan de progression | Retenue |

## 2. Piste retenue

Une fenêtre arrondie `#1E2530` = le module du compteur signature. Dedans, un triangle « play » ambre `#FF8A3D` (en cours / prochain épisode), coupé en deux par une fine charnière transparente : le geste d'un afficheur mécanique qui s'apprête à tourner. Un filet cyan `#4DD9C4` en pied = la progression vue. Aucune lettre : le symbole ne dépend pas du nom.

Provenance (anti-ia-slop) :
- **Concept** : compteur mécanique du CLAUDE.md, traduit par la charnière de palette, sans cassette ni scanlines. La fenêtre est le même objet que le compteur dans l'UI : le logo et le produit partagent une pièce.
- **Marché** : sobriété = fiabilité perçue (post-TV Time, face à Betaseries). Une seule forme, deux couleurs, pas de mascotte ni d'accent « fun ».
- **Écart concurrentiel** : Letterboxd (3 points), TV Time (cartoon), Trakt (T/coche), Betaseries (wordmark) — aucun n'occupe « play + mécanique de compteur ».

Test du swap : on met le symbole sur un CRM — le play ambre en carré sombre pourrait passer, **mais la charnière + filet cyan n'ont aucun sens hors suivi de progression**. Résultat honnête : *moyennement fragile au swap*. Le play seul reste un cliché de catégorie ; la charnière est ce qui marque. Marqueurs du catalogue : pas de dégradé, glow, glassmorphism, ni des trois esthétiques interdites (fond sombre + ambre ET cyan, pas « accent unique »). Risque connu : proximité visuelle avec des icônes de lecteurs ; à surveiller dans une recherche d'antériorité (ci-dessous).

## 3. Fichiers

| Fichier | Usage |
|---|---|
| `symbol.svg` | Symbole couleur, utilisable sur fond clair et sombre (porte sa propre fenêtre) |
| `symbol-mono.svg` | Une couleur via `currentColor`, motif détouré (charnière, play, filet transparents) |
| `favicon.svg` | Simplifié 16–32 px : plein cadre, play agrandi, charnière 4 u, sans filet |
| `app-icon.svg` | 512×512 carré plein `#0B0E14`, symbole dans la safe zone 80 % (fenêtre 336 px) |
| `lockup-horizontal(.svg / -light.svg)` | Symbole + wordmark ; la version claire inverse fenêtre et texte en `#0B0E14` |
| `lockup-stacked(.svg / -light.svg)` | Version empilée (partage social, splash) |
| `wordmark.svg` / `wordmark-light.svg` | Texte seul |
| `preview.html` | Planche (charge les SVG voisins par `<img>` : l'ouvrir depuis ce dossier) |

**Wordmark PROVISOIRE** : « TVTrackd » dessiné en tracés géométriques (traits de 7 u, polygones) pour ne dépendre d'aucune police. Ce n'est PAS de l'Archivo Expanded : approximation extended-bold à retravailler une fois le nom tranché. Dans les lockups il est isolé dans `<g id="wm">` : remplacer ce groupe suffit. Les traits sont des `stroke` non convertis en contours : convertir en contours avant export print/impression si nécessaire.

## 4. Règles d'usage

- **Taille mini** : symbole 16 px (utiliser `favicon.svg` sous 32 px) ; lockup horizontal 96 px de large ; lockup empilé 80 px.
- **Zone de protection** : 1/4 de la hauteur de la fenêtre (soit ≈ 14 u sur la grille 64) de vide autour du symbole, 1/2 de x-height du wordmark entre symbole et texte dans le lockup horizontal.
- **Fonds** : symbole sur tout fond ; sur un fond proche de `#1E2530` (sombre moyen), utiliser `app-icon.svg` ou ajouter une marge `#0B0E14`. Wordmark clair sur sombre, `#0B0E14` sur clair.
- **Interdits** : changer les couleurs ou en ajouter ; dégradé, ombre, glow, contour ; étirer ; faire tourner/animer en boucle ; ajouter scanlines/bruit/cassette ; inverser ambre et cyan ; recouper la charnière avec autre chose ; utiliser le play seul sans fenêtre.
- Animation autorisée (optionnelle) : un seul « flip » de la moitié inférieure au premier chargement, respect de `prefers-reduced-motion`. Jamais en boucle.

## 5. Spec d'intégration pour tvtrackd-developer

État actuel : seul `public/favicon.ico` existe ; `__root.tsx` déclare `theme-color #0B0E14` et `<link rel="icon" href="/favicon.ico">` ; pas de manifest ni d'apple-touch-icon ; `APP_NAME` dans `src/lib/app-config.ts`.

1. **Assets à générer depuis ces SVG** (copier dans `public/`) :
   - `favicon.svg` (lien `rel="icon" type="image/svg+xml" sizes="any"`) ; conserver `favicon.ico` régénéré (16/32/48) depuis `favicon.svg` pour les anciens navigateurs.
   - `apple-touch-icon.png` 180×180 depuis `app-icon.svg` (fond plein, iOS arrondit seul).
   - `icon-192.png`, `icon-512.png` depuis `app-icon.svg` ; `icon-512-maskable.png` = même fichier (symbole déjà en safe zone 80 %) avec `purpose: maskable`.
   - `og-default.png` 1200×630 : fond `#0B0E14`, `lockup-stacked.svg` centré (~45 % de la hauteur), rien d'autre. Ne pas écraser les `og:image` de fiches (affiches TMDb).
2. **Manifest** `public/manifest.webmanifest` : `name`/`short_name` à lire depuis la config du nom (ne pas figer en dur : générer via route/endpoint ou script de build lisant `APP_NAME`), `background_color` et `theme_color` `#0B0E14`, `display: standalone`, icônes 192/512 `purpose: any` + 512 `maskable`. Lien `rel="manifest"` dans `__root.tsx`.
3. **Head** : `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`, `og:image` par défaut absolu via `SITE_URL`.
4. **Composant React `Logo`** (`src/components/brand/logo.tsx`) :
   - Props : `variant: "symbol" | "horizontal" | "stacked"`, `tone: "dark" | "light"` (fond sur lequel il pose), `size`, `className`, `title`.
   - Le symbole est inliné en JSX (SVG de `symbol.svg`) ; préfixer l'id du mask avec `useId()` pour éviter les collisions quand plusieurs logos sont dans la page.
   - Le wordmark n'est PAS le groupe SVG figé : rendre `APP_NAME` en texte (Archivo Expanded bold, déjà chargée) à côté du symbole en variantes horizontal/stacked dans l'UI ; le SVG tracé ne sert qu'aux assets statiques (og, store). Ainsi le changement de nom ne casse rien dans l'app.
   - `aria-hidden` si le nom est affiché à côté, sinon `role="img"` + `aria-label={APP_NAME}`.
   - Remplacer le texte nu `{APP_NAME}` de l'onboarding (`onboarding-carousel.tsx`) et les en-têtes par `Logo variant="horizontal"`.
5. **Vérifications** : lisibilité du favicon à 16 px sur onglet clair ET sombre ; aperçu masque rond/squircle Android et iOS ; Lighthouse PWA installable.

## 6. Points à arbitrer par l'utilisateur

1. Nom : « TV Tract » (votre message) vs « TVTrackd » (CLAUDE.md) vs autre — les assets statiques (og, wordmark) sont à refaire une fois tranché ; le symbole non.
2. Le play seul est un cliché de catégorie ; vous satisfait-il comme base ou veut-on une 2e piste sans triangle (ex. chiffre « 0|1 » en volet) ?
3. Wordmark : garder des lettres dessinées maison, ou commander un vrai lettrage dérivé d'Archivo Expanded.
4. Recherche d'antériorité sur le symbole (play + volet) avant dépôt, en plus de la vérification du nom (TMview/INPI).
5. Animation « flip » du premier chargement : oui/non.
