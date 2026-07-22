# Étude UX tvtrackd — Analyse croisée (dev + produit + design) sur les écrans réels

> ⚠️ **Base double.** Les insights utilisateurs proviennent d'une **recherche simulée** (panel fictif de 100 profils construits à partir des personas de `CLAUDE.md`) — les chiffres « X/100 » sont des signaux qualitatifs de priorisation, **pas des mesures terrain**. En revanche, l'état du produit décrit ici provient d'une **lecture réelle du code** par l'agent développeur (chemins de fichiers à l'appui) et de captures réelles de la home. Cette version remplace les vagues précédentes « à l'aveugle » : plusieurs risques qu'elles anticipaient n'existent pas dans le code.

---

## 0. Ce que la lecture du code change (myth-busting)

Trois « gros » problèmes des vagues simulées **n'existent pas dans la réalité du code** :

| Ancienne alerte | Réalité du code | Source |
|---|---|---|
| Countdown trompeur pour les « en retard » (ex-P0) | **Impossible par construction** : `resolveHomeState()` (`src/lib/schedule.ts:643-654`) route tout `readyCount>0` vers le `HeroTicket`, jamais vers la carte compte à rebours. Le « prochain épisode dans X j » est toujours une **sortie future** (`nextCountdown()` exige `air_date > today`), mutuellement exclusive d'un épisode déjà sorti. | Dev |
| Pas de confirmation avant démarquage de masse (ex-P0) | **Déjà là** : `AlertDialog` « action irréversible » sur démarquage saison/série (`season-toggle.tsx:57-92`, `show-toggle.tsx:38-72`). Le marquage positif reste sans friction (cohérent avec l'optimistic UI). | Dev / Produit |
| Home mono-signal, cas mixte (46/100) en angle mort | **Déjà couvert** : l'état `normal` empile la zone backlog (`HeroTicket` + rails « Reprendre »/« À commencer ») **et** la zone anticipation (« Programme à venir ») sur le même écran, sur des données disjointes (`air_date ≤ today` vs `> today`, aucun double-comptage). | Produit |

**Deux écarts avec le CLAUDE.md à acter :**
- **Rewatch vestigial** : `watch_status` a une contrainte `UNIQUE (user_id, episode_id)` et l'`upsert` réécrit toujours `watch_count: 1` ; décocher = `DELETE` complet. En pratique c'est un **booléen vu/pas-vu**, pas « une ligne par visionnage » comme documenté. Aucun historique de rewatch consultable.
- **Écran `/admin`** présent dans le code mais absent du découpage des features du CLAUDE.md.

---

## 1. La home est conditionnelle — 5 états

`resolveHomeState()` dispatche selon `(followedActiveCount, readyCount, upcomingCount)` :

| État | Rendu | Pour qui |
|---|---|---|
| `no_shows` | `NoShowsPanel` (import / recherche) | Aucune série suivie |
| `all_caught_up` | `AllCaughtUpBanner` (carte pleine teintée cyan) | Rien à voir, rien de programmé |
| `upcoming_only` | **`NothingNowCountdownTicket`** — la carte de la capture | À jour, une sortie future connue |
| `ready_only` | `HeroTicket` + rails, `NothingScheduledNotice` en dessous | Backlog, rien de programmé après |
| `normal` | `HeroTicket` + rails **+** « Programme à venir » | Backlog **et** sorties futures |

Le versant backlog (`HeroTicket`) porte un compteur watched/total en Plex Mono cyan + barre, un bouton « Marquer comme vu » en 1 clic, et un badge ambre « Ce soir » / « En retard · Nj ». Le marquage depuis la home est optimiste et conçu pour les rafales (`use-mark-watched.ts`).

---

## 2. Diagnostic de l'écran « à jour » (upcoming_only)

Le problème est **concentré dans un seul bloc** — la carte compte à rebours — qui cumule 4 défauts. Le reste (timeline « Programme à venir ») est propre, hiérarchisé et passe le test anti-slop. Point central : **la carte réutilise littéralement le composant d'empty-state du cas « aucune série suivie »** (mêmes classes `border border-dashed border-border bg-transparent`, `empty-states.tsx`) — d'où sa lecture « vide/cassé/skeleton » (31/100 en simulation). Le même fichier contient pourtant déjà `AllCaughtUpBanner`, un état positif traité en **carte pleine teintée** : la bonne référence existe à côté.

| Constat (écran « à jour ») | Signal simulé | Nature |
|---|---|---|
| Ambiguïté « ma série vs grille TV générale » | 27/100 → ~6/100 | **Largement résolue** par le sous-titre possessif « Vos prochaines diffusions » |
| Décrochage en état vide | 21/33 → ~9/33 | **Nettement atténué** par le compte à rebours + message rassurant |
| Carte pointillée lue comme « vide/cassé » | 31/100 | Nouveau — réutilisation du langage d'empty-state (confirmé code) |
| Dissonance overline « CE SOIR » ↔ « rien à regarder ce soir » | 24/100 | Nouveau — eyebrow codé en dur (`index.tsx:240`), jamais conditionnel à l'état |
| Carte countdown non cliquable | 31/100 tentent de taper | Nouveau — `<div>` statique, seule carte nommant une série sans lien |
| Troncature « House of the... » | 22/100 | `line-clamp-1` sur les titres de la timeline (`day-rail.tsx:93`) |
| Compteur VHS absent de la home | 13/100 | Logique (rien à compter) mais occasion manquée : le **nb de jours** est un chiffre réel noyé dans un label 11px |

**Anti-slop** : la timeline tient le concept ; la carte countdown, sans le digit signature, est un conteneur d'empty-state générique (« prochaine séance/échéance dans 4 j » marcherait sur n'importe quelle app). Mettre le nombre de jours en gros digit Plex Mono la ferait échouer le swap de marque — c.-à-d. la rendrait spécifique.

---

## 3. Tableau unifié re-priorisé (dev + produit + design)

| Prio | Évolution | Angle | Fichiers | Effort |
|---|---|---|---|---|
| **P0** | Sortir la carte countdown du vocabulaire « pointillé/vide » → carte pleine teintée ambre (calquer `AllCaughtUpBanner`) | Design | `empty-states.tsx` | Faible |
| **P0** | Eyebrow conditionnel à l'état (fin de la contradiction « CE SOIR » ↔ « rien à regarder ce soir ») | Design | `index.tsx`, `screen-header.tsx` | Faible-moyen |
| **P1** | Mettre en scène le **nb de jours en gros digit Plex Mono** (grammaire compteur) — ramène la signature sur l'écran le plus vu ET distingue la carte du vide | Design | `empty-states.tsx` | Moyen |
| **P1** | Rendre la carte countdown **cliquable** vers la fiche série | Design | `empty-states.tsx` | Faible |
| **P1** | `line-clamp-2` sur les titres de la timeline (fin de « House of the... ») | Design | `day-rail.tsx:93` | Quasi nul |
| **P1** | **Undo léger (toast + Annuler)** après un marquage accidentel (unitaire ou groupé) — la mécanique de rollback optimiste existe déjà, à câbler sur demande utilisateur | Produit | `use-mark-watched.ts` | Faible-moyen |
| **P1** | Test de non-régression sur l'invariant `resolveHomeState` (`readyCount>0` ⇒ jamais `upcoming_only`) | Produit | `schedule.ts` (logique déjà pure/testable) | Très faible |
| **P2** | « Marquer le reste de la saison » accessible depuis la home / l'onglet **En cours** de la bibliothèque (bulk aujourd'hui seulement sur la fiche série) | Produit | `library.tsx`, réutilise `toggleSeason` | Moyen |
| **P2** | Clarifier l'actionnabilité de « +N autres épisodes prévus » (vrai lien `/calendar` ou statu quo) | Design | `upcoming-section.tsx:46` | Faible |
| **P3** | **Rewatch** : trancher — assumer le booléen dans le CLAUDE.md, ou en faire un chantier (différenciateur vs Trakt/Letterboxd) | Produit | schéma `watch_status` | Élevé si chantier |
| **P3** | Résumé chiffré « X séries en retard · Y sorties cette semaine » pour les très multi-séries | Produit | `index.tsx` (agrégats déjà calculés) | Faible |
| **P3** | Hiérarchie dates/codes Plex Mono — contraste mesuré **AA OK** (~4.9-6.2:1), c'est un sujet de hiérarchie de lecture, pas de contraste (reco a11y précédente **rétrogradée**) | Design | `day-rail.tsx`, `upcoming-section.tsx` | Faible |
| **Arb.** | `HeroTicket` réimplémente son compteur à la main au lieu du hook partagé `useRollingNumber` → dette design-system | Design/Dev | `index.tsx:579-662`, `use-rolling-number.ts` | Moyen |
| **Clos** | Countdown trompeur · confirmation démarquage groupé · cas mixte | — | déjà résolus dans le code | — |

**Backlog hors périmètre de cet écran, toujours valides** (vagues précédentes) : notifications push différenciées par état, dry-run + barre de progression à l'import, auth sociale Google/Apple, export CSV, affinage du matching TMDb, moteur de reco/découverte, messaging de réassurance sur la pérennité.

---

## 4. Deux décisions produit à trancher

1. **Rewatch** : assumer le modèle booléen actuel (mise à jour de la doc) ou le construire vraiment ? Arbitrage de positionnement — socle fiable vs richesse façon Letterboxd. Segment concerné : cinéphile-critique / collectionneur de data.
2. **Point d'entrée du marquage groupé** : garder la home minimaliste (« talon de billet ») et loger l'action dans l'onglet *En cours* de la bibliothèque, ou accepter une 2ᵉ affordance de marquage sur la home ?

---

## 5. Lecture d'ensemble

L'app est nettement plus avancée que ne le suggéraient les études « à l'aveugle » : l'essentiel des risques structurels (home différenciée, filet sur le démarquage, cas mixte) est déjà traité dans le code. Ce qui reste tient surtout à **2 correctifs design P0 à faible effort** — la carte countdown qui se lit comme un écran cassé, et la contradiction de wording « CE SOIR » / « rien ce soir » — directement contradictoires avec le positionnement « on exécute correctement là où Betaseries échoue ». Ils doivent passer avant tout merge qui retoucherait cet écran.

---

### Limites

Les insights utilisateurs restent une simulation, à confirmer par une vraie recherche primaire (8-12 entretiens sur migrant TV Time / déçu BetaSeries / binger, + test d'utilisabilité modéré sur les écrans hero, import et home par état). Les faits techniques, eux, sont issus d'une lecture directe du code (fichiers cités) et non simulés.
