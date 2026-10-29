# Cartes de partage — spec design (épisode, série, semaine)

Périmètre : `src/lib/share-card.ts` (rendu canvas) et `src/components/share-watch-dialog.tsx` (workflow). Spec uniquement, implémentation = `tvtrackd-developer`.

> **Décisions produit (2026-10-27)** — priment sur le reste de ce document :
> - **Épisode** : la carte utilise l'**image de l'épisode** (still TMDb), pas l'affiche de la série.
> - **Série entière** : **abandonné**. Pas de carte « série », pas de bouton « Partager ma progression », pas de toast « Série terminée · Partager ».
> - **Fin de saison** : conservé et refait. Entrées : notification « Saison bouclée · Partager » au dernier épisode marqué, et icône de partage permanente à côté du compteur de la saison sur la fiche. Carte : affiche de la saison (2:3 entière), compteur `08/08` + `S02 · BOUCLÉE`, période de visionnage, temps ≈. Corrige le chevauchement du bandeau de la carte saison actuelle.
> - Cas retenus : **épisode**, **fin de saison** et **ma semaine**. Parcours de référence : artefact « Parcours de partage ».

Ancrage (anti-ia-slop) : la carte sert la **fierté** (compteur de progression) et la **mémoire** (ce que j'ai vraiment regardé), dans le ton « vidéo-club nocturne » sobre. Chaque carte est une pièce de preuve sociale du produit : elle doit se lire en miniature, sans bannière publicitaire.

---

## 1. Diagnostic de l'existant

### 1.1 Chevauchement titre / bandeau orange (bug confirmé, cause racine)
Pour une affiche 2:3, `frameH` est plafonné à 900 px. Hauteur totale de la pile : 118 + 900 + 46 + 60 + 30 + 200 + 132 = **1486 px**, pour une zone sûre de 1190 px (300 → 1490). `y` est donc clampé à 300 et le contenu descend jusqu'à ~1786.
Le CTA est positionné par `Math.min(y + 34, SAFE_BOTTOM - 118)`. Il est **remonté** à y = 1372 et se pose sur le titre (≈ 1394) et sur les pastilles badge/compteur. On ne voit donc pas non plus « SAISON 02 » dans la capture : il est masqué sous le bandeau.
Défaut de conception : la hauteur du média est décidée *avant* de connaître le budget restant, et le CTA est clampé au lieu que le média cède de la place. Fix : un solveur de layout (voir §3.1).

### 1.2 Autres défauts
| # | Constat | Gravité |
|---|---|---|
| 1 | Fond « flouté » : `ctx.filter = blur()` **n'est pas supporté par Safari/iOS** (la capture montre le titre de l'affiche net en ghost géant derrière). Il parasite la lecture et gonfle le PNG (1,2 Mo). | haute |
| 2 | Affiche 2:3 recadrée en 920×900 (`drawCover`) : le titre incrusté de l'affiche est coupé (« CAT'S EYES » rogné). | haute |
| 3 | Bandeau orange plein « TVTRACKD.COM » = bannière publicitaire, poids visuel supérieur au contenu. Double branding (en-tête + CTA). | haute |
| 4 | Compteur VHS signature absent : pastilles `ÉPISODE VU` / `S02E05` de 42 px, minuscules, sans fraction. « 8 épisodes vus » en Inter 34 muted = zéro émotion. | haute |
| 5 | Dégradé décoratif sur le visuel (interdit par CLAUDE.md) + double cadre fond flouté / frame. | moyenne |
| 6 | Marque en dur (`TVTRACKD`, `TVTRACKD.COM`, tagline FR) : viole la règle `APP_NAME` / `SITE_URL`. | moyenne |
| 7 | Contenu concentré dans 1190 px sur 1920 avec marges énormes : en miniature (feuille Instagram, capture 3) la carte paraît petite dans un grand fond sombre. | moyenne |
| 8 | Texte essentiel trop petit : chip 28 px, sous-titre 34 px, tagline 24 px (≈ 8,7 pt sur iPhone plein écran, ≈ 3 pt en miniature). | moyenne |

### 1.3 Workflow (dialogue)
- Titre « Partager en story » alors que 3 des 4 actions n'en sont pas. La description reprend la légende avec un emoji 📺, ce qui prend de la place sans rien apporter.
- Aperçu plafonné à `max-h-[48vh]` : sur iPhone la carte est minuscule dans un dialogue qui laisse 40 % d'espace vide.
- CTA primaire avec icône Instagram, mais sur iOS le geste mène à la feuille de partage système (4 taps : Partager → Instagram → Story → Suivant). Le libellé promet plus qu'il ne tient.
- `copyText()` est appelé **après** `await navigator.share` : sur iOS l'activation utilisateur est consommée, la copie du lien échoue silencieusement. Et aucun retour utilisateur après un partage natif réussi.
- Bouton « Image » : `<a download>` ouvre un aperçu de fichier sur iOS Safari (le code le sait déjà pour Instagram, mais pas pour ce bouton).
- Spinner nu pendant la génération : saut de mise en page à l'arrivée de l'image.
- Un seul format (9:16). Une story importée comme « Publication » est recadrée (capture 3 : IG recadre au centre).

---

## 2. Principes communs

**Formats** : Story 1080×1920 (défaut), Publication 4:5 1080×1350 (recommandé plutôt que 1:1 : plein cadre dans le fil IG ; 1:1 en option, mêmes tokens).
**Marges** : 72 px latérales (contenu 936 px).
**Règle d'or de recadrage** : tout le contenu vit dans l'intersection *zone sûre story* (y 300 → 1490) ∩ *recadrage 4:5 centré* (y 285 → 1635), donc **y 300 → 1490**. Ainsi la même story survit à « Publication » et « Reel » (capture 3).
**Lisibilité miniature** : essentiel ≥ 40 px (≈ 14 pt plein écran), micro-labels ≥ 26 px et jamais porteurs d'information unique.
**Fond** : `--bg-void` #0B0E14 plat. Ambiance optionnelle : visuel réduit à ~27×48 px puis étiré avec lissage (flou garanti sans `ctx.filter`, compatible Safari), alpha 0.35 sous une couche void 0.80. Pas de dégradé, pas de saturate.
**Cartes** : fond `rgba(255,255,255,0.03)` ou `--bg-surface-raised` #1E2530 pour le module compteur, filet 1 px `rgba(242,237,228,0.10)`, rayon 32 px (≈ 12 px à l'échelle téléphone, dans la fourchette 8-12 px de CLAUDE.md).
**Pas d'emoji** dans la carte. Pas de scanlines, bruit ni icône cassette.

### 2.1 Typographie (tous les nombres en IBM Plex Mono)
| Rôle | Police | Taille | Couleur |
|---|---|---|---|
| Eyebrow | Plex Mono 500, tracking 0.22em, capitales | 26 | `--text-muted` (état en cyan si « vu ») |
| Chiffre dominant | Plex Mono 600 | 128 (semaine : 220) | `--accent-cyan` |
| Total `/08` | Plex Mono 500 | 64 | muted |
| Code `S02 · E05` | Plex Mono 600 | 40 | `--accent-amber` |
| Titre série | Archivo Expanded 700 | 72 (fit → 44, 1 ligne, ellipse) | `--text-primary` |
| Sous-titre | Inter 400 | 36 | muted |
| Marque | Archivo 700, tracking 0.12em | 30 | `--text-primary` |
| Host | Plex Mono 500 | 26 | muted |

Sémantique des couleurs = celle de la fiche : fraction vue en cyan (« vu »), code S·E ambre (prochain / en cours). Les chiffres sont l'unique signal fort de chaque carte.

### 2.2 Compteur VHS signature (version statique)
Reprise de la grammaire de `VhsCounter variant="detail"`, mise à l'échelle ×4 pour la carte : module `--bg-surface-raised`, 936 × 232, rayon 32, filet 1 px, padding 40. Gauche : fraction `05` (128 px cyan) + `/08` (64 px muted), baseline commune. Droite, alignée à droite : code `S02 · E05` (40 px ambre) puis micro-label 24 px (`EN COURS` / `SAISON BOUCLÉE`). Pied du module : barre fine 6 px, rayon 3, piste `rgba(139,146,163,0.15)`, remplissage cyan, sans dégradé. Un seul glow léger permis : `textShadow` cyan 0.35 comme l'existant (pas d'autre effet). Pas d'animation (image statique), l'incrément vit dans l'app.
Si la fraction n'est pas calculable (film, données absentes), le module affiche `S02 · E05` en 128 px ambre sans barre. **Jamais de fraction inventée.**

### 2.3 Branding (pied, discret, une seule fois)
Pas de bandeau, pas de tagline, pas d'en-tête de marque. Pied de carte y 1432 → 1490 (58 px) : barre ambre 10×40 (rayon 5), à 24 px `APP_NAME.toUpperCase()` Archivo 30, puis à droite alignée la valeur `new URL(SITE_URL).host` en Plex Mono 26 muted. Aucune chaîne en dur : `APP_NAME` et `SITE_URL` de `src/lib/app-config.ts`. Le CTA est porté par le sticker lien d'Instagram (lien déjà copié) et non par l'image.

---

## 3. Gabarits

### 3.1 Contrat de layout (pour le dev)
Mesurer d'abord tous les blocs de texte, calculer le budget restant, puis donner au média la hauteur résiduelle (borne min/max), jamais l'inverse. Aucun élément ne doit être repositionné par `Math.min`. Test unitaire : pour chaque gabarit × format, `bottom(dernier bloc) ≤ 1490` et aucune boîte ne s'intersecte. Titre long : fit jusqu'à 44 px puis ellipse (déjà le cas). Charger explicitement `document.fonts.load("700 72px Archivo")` et `"600 128px 'IBM Plex Mono'"` avant le rendu : `fonts.ready` ne charge pas une graisse non encore utilisée à l'écran.

### 3.2 A. Épisode vu (Story, 1080×1920)
| Zone | y | Détail |
|---|---|---|
| Réservé IG | 0 → 300 | fond seul |
| Eyebrow | 330 → 358 | `ÉPISODE VU` cyan + date du visionnage muted (si `watched_at` connu) |
| Still 16:9 | 392 → 919 | 936×527, rayon 32, filet, **sans dégradé** |
| Module compteur | 967 → 1199 | fraction saison vue/total (`05/08`) + `S02 · E05` |
| Titre série | 1251 → 1331 | Archivo 72 |
| Titre épisode | 1343 → 1391 | Inter 36 muted, 1 ligne |
| Pied marque | 1432 → 1490 | §2.3 |

Entrée de données supplémentaire : `progress {watched, total}` (déjà disponible sur la fiche : `watchedCount`, `eps.length`).

### 3.3 B. Série entière (terminée / en cours)
L'affiche est **affichée entière** en 2:3, plus de recadrage.
| Zone | y | Détail |
|---|---|---|
| Eyebrow | 330 → 358 | `SÉRIE TERMINÉE` (cyan) ou `EN COURS · SAISON 2` (ambre) |
| Affiche | 392 → 1022 | x 72, 420×630, rayon 28, filet |
| Colonne droite | 392 → 1022 | x 532, largeur 476. Titre Archivo 64/68, 4 lignes max (fit → 48) ; méta Inter 32 muted (« 3 saisons ») ; **ancré en bas** : `1ER ÉPISODE VU` (mono 24) + date mono 40, seulement si la donnée existe |
| Module compteur | 1078 → 1310 | fraction épisodes vus/total (taille fit 128 → 88 pour 3 chiffres). Terminée : label `TERMINÉE` cyan. En cours : droite = `PROCHAIN` + `S02 · E06` ambre (anticipation) |
| Ligne temps | 1350 → 1398 | `≈ 38 H 20 DE VISIONNAGE` Plex Mono 34, uniquement si calculé à partir de durées réelles (préfixe `≈` si estimé) |
| Pied marque | 1432 → 1490 | |

### 3.4 C. Ma semaine (NOUVEAU)
**Fenêtre** : 7 jours glissants (J-6 → aujourd'hui), plage affichée en eyebrow `20 → 26 OCT.`. Évite une carte vide le lundi. Option ultérieure : semaine ISO.
**Données montrées** (toutes calculées depuis `watch_status.watched_at`) : nb d'épisodes (dominant), temps total `≈` (sommes des durées d'épisodes connues), nb de séries distinctes, activité par jour, affiches des séries les plus regardées avec leur compte. **Pas** de : genre favori, « personnalité », percentile (« top 5 % »), classement 1-2-3, comparaison avec la semaine précédente (sauf donnée réelle, v2), badge ou titre généré.
| Zone | y | Détail |
|---|---|---|
| Eyebrow | 330 → 358 | `MA SEMAINE` + plage de dates |
| Module compteur | 392 → 692 | 936×300. Gauche : `23` Plex 600 220 px cyan, label `ÉPISODES` mono 26. Séparateur filet vertical. Droite (x 640) : `9 H 40` mono 56 avec label `TEMPS ≈`, puis `6` mono 56 avec label `SÉRIES`. Le 220 px domine, le reste à 56 px = un seul signal fort |
| Frise 7 jours | 744 → 924 | 7 colonnes 108 px, gouttière 30 (7×108 + 6×30 = 936). Barres cyan, hauteur proportionnelle au max (24 → 112 px, rayon 6) ; jour à 0 = tick 4 px `rgba(139,146,163,0.3)`. Lettres L M M J V S D en mono 26 muted. Pas d'axe, pas de valeurs |
| Affiches | 980 → 1304 | jusqu'à 4 × 216×324 (rayon 20), gouttière 24, ordre = épisodes vus décroissant. Si > 4 séries : 4e case = `+3` mono sur `--bg-surface-raised` |
| Comptes | 1318 → 1352 | `×9` mono 32 sous chaque affiche |
| Pied marque | 1432 → 1490 | |

États : 0 épisode → bouton absent ; 1-2 séries → affiches alignées à gauche, même taille ; 1-3 épisodes → module inchangé (la sobriété prime, pas de flatterie).
Test du swap : une app de fitness pourrait avoir « 23 séances » et une frise 7 jours, mais pas le module compteur VHS ni des affiches + `S02 · E05` ; la carte casse au swap, donc ancrée.

### 3.5 Variantes de format
| | Story 9:16 | Publication 4:5 | Carré 1:1 (option) |
|---|---|---|---|
| Canvas | 1080×1920 | 1080×1350 | 1080×1080 |
| Contenu | y 300 → 1490 | y 72 → 1278 | y 64 → 1016 |
| Marges latérales | 72 | 72 (le fil 3:4 de la grille rogne ~34 px/côté) | 64 |
| Eyebrow | oui | oui | non |
| Épisode | spec §3.2 | still 936×527 y112, module 232 y679, titre y951, sous-titre y1043, pied y1218 | still réduite 800×450, module 200, sous-titre supprimé |
| Série | §3.3 | affiche 360×540 y112, module 232 y692, ligne temps y964, pied y1218 | affiche 330×495 à gauche, module sous la colonne droite |
| Semaine | §3.4 | module 260 y112, frise 150 y412, affiches 210×315 (gouttière 32) y602, comptes y931, pied y1218 | frise supprimée, affiches 3 max |
Le reste vertical est réparti entre les blocs (+40 px max par intervalle), pied toujours en bas.

---

## 4. Workflow de partage

1. **Entrées** : épisode (ligne d'épisode vu, inchangé) ; série (bouton « Partager ma progression » sur la fiche, quand la série est terminée ou en cours avec ≥ 1 épisode vu ; la saison terminée garde son bouton, avec carte B en mode saison) ; semaine (bouton « Partager ma semaine » dans Stats/Profil).
2. **Contenant** : bottom-sheet sur mobile (réutiliser un composant drawer s'il existe dans `src/components/ui`, sinon `DialogContent` ancré en bas), dialogue centré sur desktop. Titre court **« Partager »** (plus « Partager en story »).
3. **Format** : contrôle segmenté `Story` / `Publication` au-dessus de l'aperçu (défaut Story, choix mémorisé). Régénération au changement.
4. **Aperçu** : ratio réel du format, hauteur jusqu'à 60 vh (largeur contenue), squelette de même ratio pendant la génération (pas de spinner nu). `alt` descriptif : « Cat's Eyes, saison 2, 5 épisodes sur 8 vus ».
5. **Action primaire** : `Partager` (icône Share2, pas le logo Instagram), hauteur 56. Dessous, microcopy 12 px muted : « Choisissez Instagram puis Story ». Le lien est copié **avant** `navigator.share` (dans le geste) et confirmé par un toast « Lien copié, à coller en sticker ».
6. **Secondaires** (rangée de 3, cibles 44 px) : `Enregistrer` (sur iOS via partage système, pas `<a download>`), `X`, `Copier la légende + lien`. La légende s'affiche en une ligne muted sous l'aperçu, sans emoji obligatoire dans l'UI.
7. **Réassurance** : aucune. Pas de texte rassurant sur les données ici (hors-sujet à cet endroit).
8. Export : privilégier JPEG 0.92 (fond opaque) ou conserver PNG ; objectif < 400 Ko (le fond plat + l'absence de dégradé y contribuent déjà). Instagram recompresse de toute façon.
9. Accessibilité : focus visible, `aria-busy` pendant la génération, `prefers-reduced-motion` n'a pas d'effet (aucune animation).

### Changements d'API suggérés
`ShareCardInput` devient une union discriminée `kind: "episode" | "show" | "week"` + `format: "story" | "post" | "square"`. Chaque `kind` reçoit uniquement des données réelles (`progress`, `firstWatchedAt`, `week: {episodes, minutes, minutesIsEstimate, shows[], perDay[7]}`). Le champ libre `counter: string` disparaît au profit de champs typés.

---

## 5. Notes de provenance (anti-slop)
- **Module compteur sur la carte** : ancré au concept (signature VHS) ; sans lui la carte devient « affiche + titre + bannière », interchangeable avec n'importe quel tracker.
- **Suppression du bandeau orange** : ancré au marché (la fiabilité perçue, pas la pub) ; une bannière plein cadre est un réglage de template.
- **Frise 7 jours + affiches avec comptes** : ancré à la mémoire (ce qu'on a réellement regardé) et à l'écart concurrentiel (BetaSeries : stats inventées/remplissage). Chaque pixel est une donnée calculée.
- **Écarté volontairement (marqueurs « Wrapped »)** : dégradés, grands aplats de couleur, titres de personnalité, classement podium, percentile, confetti, emoji, glassmorphism, stats rondes non sourcées.
- Les trois esthétiques par défaut de CLAUDE.md sont évitées : deux accents à rôle sémantique (pas « noir + un accent acid »), pas de serif, pas de broadsheet.

**Vérifications restantes pour le dev** : rendu réel de Plex Mono 600 / Archivo en canvas sur iOS Safari ; largeur « Expanded » (`ctx.fontStretch`) si la variable-font est servie ; test visuel sur les trois feuilles IG (Story, Publication, Reel).
