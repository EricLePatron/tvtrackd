# Roadmap tvtrackd

Dossier produit + design : analyse de l'existant, benchmark concurrentiel, feuille de route priorisée. Produit à partir d'une analyse croisée du code réel (pas seulement des noms de fichiers), du benchmark TV Time / Betaseries / Trakt / Simkl / Serializd, et de CLAUDE.md.

Dernière mise à jour : 2026-07-03 (soir), après merge de la PR #7.

---

## Livré depuis ce dossier

### [PR #7](https://github.com/EricLePatron/tvtrackd/pull/7) — Refonte accueil : séparer "à voir maintenant" de "programme à venir" *(mergée)*

Corrige le bug racine du hero d'accueil (pouvait promouvoir un épisode pas encore sorti avec le même habillage qu'un épisode disponible). Sépare l'écran en Zone A ("à voir maintenant", un item par série, triée par urgence) et Zone B ("programme à venir", groupée par jour), ajoute un écran `/calendar` dédié et 4 états vides distincts avec une section découverte tendance TMDb en un tap.

Couvre les items **#4** et **#19** ci-dessous (marqués ✅). Deux bugs latents trouvés et corrigés en cours de route (QA + revue design) :
- Écrasement silencieux du statut d'une série déjà suivie via le suivi rapide de découverte.
- Bug de contraste `text-secondary`/`surface-elevated` sur le ticket héros et le compteur VHS (corrigé à ces deux endroits — les occurrences restantes ailleurs dans l'app sont l'item **#27**).

---

## 0. Alerte transversale

**"Nightframe" est hardcodé en dur dans le code, alors que le nom n'est pas tranché.** Le nom d'app affiché partout (titre de page, meta og:title, écran de connexion, et surtout le nom du fichier d'export JSON téléchargé par les utilisateurs) est **"Nightframe"** — un nom qui n'apparaît nulle part dans CLAUDE.md. "TVTrackd" est la piste réellement à l'étude, en attente de vérification de risque de marque. CLAUDE.md est explicite : ne pas committer de nom en dur tant que ce n'est pas arbitré.

Six occurrences dans le code (`__root.tsx`, `auth.tsx`, `index.tsx`, `profile.tsx`, `styles.css`). Correction peu coûteuse (une constante `APP_NAME`) mais chaque jour qui passe avec ce nom visible dans un fichier téléchargé par de vrais utilisateurs rapproche d'une marque de fait.

Trouvé indépendamment par l'agent produit et l'agent design lors de l'analyse initiale — voir item **#1**. **Toujours pas corrigé.**

---

## 1. État des lieux du MVP

### Ce qui tient déjà debout
Auth, recherche TMDb, fiche série avec cache, tracking épisode par épisode en optimistic UI, bibliothèque par statut, import/export CSV·JSON. Les tokens couleur et la typographie (Archivo/Inter/Plex Mono) sont fidèles au design system. Le hero "Ce soir" façon talon de billet est la meilleure exécution du concept dans tout le repo. Depuis PR #7 : l'écran d'accueil (Zone A/B) et l'écran calendrier dédié sont également solides.

### Ce qui manque ou est cassé
Le tracking de film n'existe pas réellement (seul le statut change, sans date ni rewatch). Le rewatch n'historise pas chaque visionnage malgré ce qu'annonce CLAUDE.md. L'import marque tout en "en cours" par défaut. Le compteur VHS garde une barre de progression générique en dessous du tween de chiffres. *(L'onboarding vide et le hero d'accueil ambigu, listés ici initialement, sont corrigés depuis PR #7.)*

---

## 2. Benchmark ciblé

| Mécanique | Ce qu'elle apporte | État tvtrackd | À faire |
|---|---|---|---|
| Notifications nouvel épisode | Rappel actif — sans ça l'app est passive | Absent | Email d'abord, push web ensuite |
| Import massif à l'inscription | Comble le vide day-1, capte les réfugiés TV Time | ✅ Livré (PR #7) | — |
| Réseau social léger | Découverte + pression sociale positive | Absent | Profil public en lecture seule d'abord, pas un vrai feed |
| Portabilité des données | Confiance — argument n°1 post-fermeture TV Time | Export JSON basique | Export versionné, mis en avant dès l'onboarding |
| Moteur de recommandation | Différenciateur n°1 possible vs Betaseries | Absent (découverte tendance TMDb livrée en attendant) | V1 simple à base de genres/équipe TMDb — fiable avant ambitieux |
| Gamification (badges, niveaux) | Petit dopamine régulier | Absent | À éviter tant que le socle n'est pas irréprochable |

**Ce qu'il faut éviter de copier** (leçon Betaseries) : gamification et notifications ne doivent pas être ajoutées "pour cocher la case" avant que le socle (fiabilité du tracking, exactitude de l'import, distinction statut/historique) soit irréprochable.

---

## 3. Feuille de route

Priorisation : impact sur la crédibilité de "remplaçant fiable de TV Time", pondéré par le risque d'abandon si l'item est absent, puis différenciation concurrentielle vs effort. Tags `[Produit]` / `[Design]`. Effort S/M/L.

### Court terme — J-12 à J+15 (autour du 15 juillet)

| # | Statut | Quoi | Pourquoi | Tags | Effort | Impact |
|---|---|---|---|---|---|---|
| 1 | ⬜ | Sortir "Nightframe" du code → constante `APP_NAME` | Bloquant avant tout lancement public — voir alerte transversale | Design | S | Moyen (bloquant) |
| 2 | ⬜ | Vérifier le format réel d'export TV Time / Betaseries et fiabiliser le parseur | Le parseur devine des noms de colonnes génériques sans confirmation du format réel — fonctionnalité de confiance n°1 | Produit | S | Très élevé |
| 3 | ⬜ | Corriger le statut par défaut à l'import (pas tout en "en cours") | Déduire "terminé" si l'historique couvre toutes les saisons connues | Produit | S | Élevé |
| 4 | ✅ | ~~Onboarding post-signup orienté import~~ | **Livré via PR #7** : l'état vide "aucune série suivie" affiche directement les CTA import/recherche + une grille de découverte tendance | Produit, Design | M | Très élevé |
| 5 | ⬜ | Implémenter le tracking des films (date, rewatch) | Promesse "séries et films" non tenue — aucune donnée créée dans `watch_status` pour un film | Produit | M | Élevé |
| 6 | ⬜ | Refaire les pages 404 / erreur en français, dans le design system | Actuellement en anglais, police système, sans le vocabulaire visuel | Design | S | Moyen |
| 7 | ⬜ | Renforcer le compteur VHS (retirer la barre de progression générique) | Élément signature du design system — la barre linéaire résiduelle est le pattern que CLAUDE.md interdit | Design | M | Élevé |
| 8 | ⬜ | Agrandir les cibles tactiles de "marquer vu" (32px → ≥44px) | Action la plus répétée de toute l'app | Design | S | Moyen |
| 9 | ⬜ | Anti-spoiler basique (masquer titre/résumé d'épisode non vu) | Différenciateur peu coûteux : TV Time et Betaseries sont tous deux faibles sur ce point | Produit | S | Moyen |
| 10 | ⬜ | Unifier les états de chargement sur le composant skeleton existant | 4 traitements différents selon l'écran, le composant skeleton existe déjà mais n'est utilisé nulle part | Design | M | Moyen |

### Moyen terme — 1 à 3 mois

| # | Statut | Quoi | Pourquoi | Tags | Effort | Impact |
|---|---|---|---|---|---|---|
| 11 | ⬜ | Notifications (email d'abord, push web ensuite) | Le calendrier existe mais reste passif | Produit | M | Très élevé |
| 12 | ⬜ | Export enrichi et versionné, mis en avant comme argument de marque | Aujourd'hui un dump JSON brut, discret en bas de profil | Produit, Design | S/M | Élevé |
| 13 | ⬜ | Historiser réellement le rewatch (une ligne par visionnage) | Le schéma documenté dans CLAUDE.md n'est pas celui implémenté | Produit | M | Moyen (fondation) |
| 14 | ⬜ | Badge de progression en overlay sur les posters | Les posters sont "nus" partout sauf sur la fiche détail | Design | M | Élevé |
| 15 | ⬜ | Moteur de recommandation v1 (genres/équipe TMDb, pas de ML) | Point faible le plus critiqué de Betaseries ("bot cassé une fois sur deux") | Produit | M | Élevé (différenciant) |
| 16 | ⬜ | Profil public optionnel en lecture seule (`/u/pseudo`) | Statut social minimal sans le coût d'un vrai réseau social | Produit | M | Moyen-Élevé |
| 17 | ⬜ | Numéro d'adhérent séquentiel sur le profil | Embryon déjà présent dans l'écran de connexion, non relié à un identifiant réel | Design | S/M | Moyen |
| 18 | ⬜ | Logique de diffusion weekly vs binge-drop dans le calendrier | Le calendrier traite tout épisode pareil aujourd'hui | Produit | S/M | Moyen |
| 19 | ✅ | ~~Vue calendrier mensuel optionnelle~~ | **Livré via PR #7** sous forme d'écran `/calendar` dédié (groupé jour/semaine, pas une grille mensuelle littérale) | Design | M | Moyen |
| 27 | ⬜ | Corriger les occurrences restantes du bug de contraste `text-secondary` | Trouvé et corrigé partiellement pendant PR #7 (ticket héros, compteur VHS) — persiste dans `show.$mediaType.$tmdbId.tsx` et `profile.tsx` | Design | S | Moyen |

### Long terme — différenciation

| # | Statut | Quoi | Pourquoi | Tags | Effort | Impact |
|---|---|---|---|---|---|---|
| 20 | ⬜ | "Relevé de nuit" — année en séries/films, partageable | Transforme le tracker en journal, façon "Spotify Wrapped" dans le vocabulaire vidéo-club | Produit, Design | M/L | Élevé (rétention) |
| 21 | ⬜ | "Coup de tampon" de fin de saison | Micro-animation cyan, rare et non répétée — moment de récompense visuelle | Design | M | Élevé |
| 22 | ⬜ | Étiquette de cassette personnalisable par série | Couleur restreinte, reprend le geste réel d'écrire sur une étiquette de VHS | Design | M | Moyen |
| 23 | ⬜ | Streak de nuits consécutives — chiffre seul, jamais un badge animé | Mécanique de rétention éprouvée chez TV Time, réexprimée sobrement | Produit, Design | M | Moyen |
| 24 | ⬜ | Reviews / notes courtes par épisode ou saison | Point fort Serializd — seulement une fois le socle irréprochable (phase 2 explicite CLAUDE.md) | Produit | M/L | Selon traction |
| 25 | ⬜ | Import "connecter mon compte Trakt" (OAuth) | Capte les power users Trakt sans export manuel | Produit | L | Selon demande |
| 26 | ⬜ | Scrobbling automatique streaming (équivalent Simkl) | Techniquement lourd, hors scope court terme confirmé par CLAUDE.md | Produit | L | Risque technique élevé |

---

## 4. Créer de l'appropriation, pas juste un remplacement

Remplacer TV Time fonctionnellement ne suffit pas à créer un attachement. Le gisement le plus cohérent avec "vidéo-club nocturne" est la personnalisation d'objets physiques implicites (cassette, ticket, étagère, carte de membre) plutôt que la gamification explicite (badges, points, niveaux).

1. **L'export comme argument de confiance actif** — Visible dès l'onboarding ("vos données ne seront jamais prises en otage"), format lisible et réimportable ailleurs, horodaté.
2. **Le compteur VHS étendu aux films** — Un "talon de ticket de cinéma" pour les films vus, avec date.
3. **Mémoire longitudinale personnelle** — "Il y a un an vous regardiez X", "votre année en séries" : différenciateur fort vs Betaseries qui reste très orienté état présent.
4. **Statut social minimal mais réel** — Un profil public optionnel et partageable, en lecture seule.
5. **Contrôle fin anti-spoiler** — Un des rares axes où TV Time et Betaseries sont tous deux faibles.

---

## 5. Arbitrages à trancher

- **Tracking films (#5) avant ou après notifications (#11) ?** Dépend de la répartition réelle série/film dans la base d'utilisateurs qui migrent de TV Time.
- **Notifications : push web ou email d'abord ?** Le push web est plus engageant mais demande un service worker ; l'email est plus simple à livrer vite.
- **Profil public : opt-in ou opt-out ?** CLAUDE.md insiste sur la granularité de partage comme principe UX — choix de positionnement de marque.
- **Reco (#15) avant ou après notifications (#11) ?** Compétences différentes (agrégation TMDb vs infra de notification) — dépend des ressources disponibles.

---

*Dossier complet (benchmark détaillé, mockups) : voir les artefacts produits en session. Analyses sources : `analyse-produit.md`, `analyse-design.md`, `deep-dive-accueil-produit.md`, `deep-dive-accueil-design.md`.*
