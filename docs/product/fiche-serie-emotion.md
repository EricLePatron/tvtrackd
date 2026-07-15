# Fiche série émotionnelle — note produit

Base de travail pour la refonte de `src/routes/_public/show.$mediaType.$tmdbId.tsx`. Angle produit uniquement — aucune implémentation, aucune modification de code dans ce document. Destiné à être lu en parallèle par design et marketing.

---

## 1. Le job-to-be-done émotionnel de cette page

La fiche série actuelle répond bien au JTBD **fonctionnel** ("dis-moi où j'en suis et permets-moi de cocher"). Elle ne répond pas encore au JTBD **émotionnel**, qui est le vrai différenciateur stratégique de tvtrackd d'après la thèse du projet (CLAUDE.md, section "Pourquoi ce projet existe") :

> TV Time ferme avec deux semaines de préavis. Ses 25M d'utilisateurs ne perdent pas une app, ils perdent une **mémoire** : des années de "j'ai regardé ça avec telle personne, à telle période de ma vie". Betaseries a la marque mais échoue sur la fiabilité technique de cette mémoire (désarchivage cassé, sync ratée).

Trois émotions concrètes à servir sur cette page précise, hiérarchisées par pertinence pour la thèse :

1. **Fierté de la progression** — "j'ai avancé, je vois où j'en suis d'un coup d'œil, c'est net et ça défile comme un compteur". C'est déjà l'intention du VhsCounter — il faut l'élever au rang de pièce maîtresse émotionnelle de la page, pas juste un widget technique noyé entre le bouton Suivre et la liste d'épisodes.
2. **Mémoire durable / nostalgie** — "je suis avec cette série depuis [date], j'y ai passé [X heures], voilà mon parcours". C'est l'émotion la plus alignée avec la thèse anti-TV-Time : on ne vend pas juste un tracker, on vend un **journal qui ne disparaîtra jamais**. Chaque affichage de cette mémoire est un rappel implicite de la promesse de fiabilité/pérennité — sans jamais avoir besoin de le dire en toutes lettres.
3. **Anticipation** — "mon prochain épisode m'attend, comme un programme TV du soir". Déjà présent (bloc "Prochain épisode" + "Reprendre"), mais traité comme une ligne de texte discrète alors que c'est un moment fort du concept "vidéo-club nocturne" (cf. direction design, motif "talon de billet/étiquette de cassette" déjà utilisé sur le hero Accueil via `HeroTicket`, `src/routes/_public/index.tsx`).

Une quatrième émotion — **fierté sociale / reconnaissance par les pairs** (ce que font Serializd/Letterboxd avec les reviews et les followers) — est délibérément **hors périmètre** de cette refonte : le social/reviews est acté "phase 2" dans CLAUDE.md, et il n'y a aujourd'hui aucune donnée sociale dans le schéma (pas de table reviews, pas de followers). Ne pas la simuler avec du faux contenu (cf. section 4).

---

## 2. Benchmark émotionnel concurrentiel

Note de fiabilité : les éléments ci-dessous relèvent de ma connaissance générale de ces produits (fonctionnement établi sur plusieurs années), pas d'une vérification en direct de l'UI actuelle au 13/07/2026 — TV Time notamment ferme ce mois-ci et son UI n'est plus forcément representative/consultable. Si une formulation précise ("tu as passé X jours") doit être citée telle quelle en marketing/copywriting, je recommande une vérification WebSearch ciblée avant publication. Ce qui suit est fiable au niveau du **principe produit**, pas au niveau du pixel.

| App | Ce qui crée de l'émotion sur leur fiche série/film | On reprend | On évite |
|---|---|---|---|
| **TV Time** | Hero backdrop plein écran immersif ; compteur "temps passé avec cette série" agrégé et mis en avant ; badges/achievements de complétion ; ton ludique et coloré | Le backdrop immersif comme point d'entrée émotionnel ; le compteur de temps passé comme statistique personnelle valorisante | Le ton cartoonesque et la gamification tous azimuts (badges) — CLAUDE.md est explicite : on garde la chaleur, pas le cartoonesque. Les badges gratuits façon "succès Xbox" risquent de sonner comme du remplissage artificiel si posés sans réflexion sur leur sens |
| **Serializd** | Diary par épisode/saison avec date et note ; grille d'épisodes cochés façon carnet ; reviews communautaires visibles sur la fiche | La logique de "carnet" (déjà en germe avec le compteur VHS) ; l'idée qu'un épisode coché a une trace temporelle | Le diary + reviews complet — nécessite une table `reviews`/notes qui n'existe pas encore, acté backlog phase 2 dans CLAUDE.md |
| **Letterboxd** | Backdrop cinématographique très soigné, rating en étoiles proéminent, "watched by X people", earliest/latest logged, mise en scène quasi affiche de film | Le soin visuel du hero (poster + backdrop composés comme une affiche) | Le rating communautaire agrégé façon "watched by X%" — suppose une masse critique d'utilisateurs qu'on n'a pas au lancement ; afficher un chiffre creux (ex. "regardé par 3 personnes") serait contre-productif |
| **Trakt** | Historique de scrobbles horodaté ("last watched", "plays"), stats précises (minutes, plays), mais présentation très dense/tableau | La rigueur de la donnée (chaque action a un sens précis, pas de faux-semblant) | La densité utilitaire pure — c'est justement l'anti-modèle du "immersif/émotionnel" qu'on cherche ici ; Trakt est fonctionnel mais froid, exactement ce qu'on veut dépasser sur ce point précis |
| **Betaseries** (repère négatif, pas benchmark émotionnel positif) | — | — | La page fiche série de Betaseries est datée visuellement et son statut d'archivage casse la continuité de l'historique affiché (point déjà identifié dans CLAUDE.md). Rappel utile : la fiabilité perçue de la mémoire affichée sur cette page (jamais un chiffre qui se contredit après une action) est elle-même un facteur émotionnel — la confiance est une émotion |

**Insight transverse** : les apps qui créent le plus d'émotion (TV Time, Letterboxd) le font en **agrégeant du temps et de la progression personnelle en un seul chiffre marquant**, présenté visuellement fort (hero, gros caractères), pas en accumulant des widgets. Les apps qui paraissent froides (Trakt) exposent la même donnée mais en tableau dense sans hiérarchie visuelle. La leçon pour tvtrackd : **on a déjà la bonne donnée (watch_status, user_shows) et le bon élément signature (VhsCounter) — le travail est un travail de hiérarchie et de mise en scène, pas de nouvelle feature.**

---

## 3. Hiérarchie de page recommandée

Ordre proposé, du plus émotionnel (haut de page, premier écran) au plus fonctionnel (bas de page) :

1. **Hero backdrop immersif** — remplace le header compact actuel (poster 112px + ligne de texte). Plein-bleed `backdrop_path`, dégradé vers `--bg-void`, poster + titre + tagline composés par-dessus. C'est le moment "on entre dans l'univers de la série", équivalent du hero Letterboxd/TV Time.
2. **"Ton histoire avec cette série"** (nouveau bloc, uniquement si `userShow` existe) — le cœur émotionnel de la refonte : depuis quand suivie, progression VHS mise en valeur, temps investi. Détail en section suivante.
3. **Prochain épisode / reprise** — déjà présent, à élever visuellement au niveau du motif "talon de billet" déjà utilisé sur le hero Accueil (`HeroTicket`), pour cohérence de langage visuel entre les deux écrans où l'anticipation est le sujet.
4. **Bouton Suivre / statut** (pour un visiteur non-suiveur) — reste présent mais redescend d'un cran narratif : avant de suivre, on veut d'abord "ressentir" la série (hero + synopsis), pas être sommé de s'engager immédiatement.
5. **Synopsis, genres, note TMDb, networks, plateformes de diffusion** — bloc factuel, position médiane, inchangé dans l'esprit.
6. **Saisons / épisodes avec compteur VHS et liste** — cœur fonctionnel de l'app, doit rester très accessible et rapide (friction de logging = métrique clé, cf. CLAUDE.md), mais peut vivre sous les blocs émotionnels sans perte d'usage puisque l'action de cocher reste identique.
7. **Rail "Similaires"** — inchangé, position basse, rôle de découverte plutôt qu'émotion.

### Les 2-3 moments d'émotion à amplifier en priorité pour ce MVP de refonte

**a) Hero backdrop immersif** — *faisable immédiatement avec le schéma existant.* La colonne `shows.backdrop_path` existe déjà (migration `20260710065208_...sql`) et est déjà remontée par l'edge function `get-show-details` (`supabase/functions/get-show-details/index.ts:110`) — mais elle n'est ni typée dans `ShowRow` ni affichée dans la route actuelle (`src/routes/_public/show.$mediaType.$tmdbId.tsx:84-98` et `497-502` n'utilisent que `poster_path`). C'est un gain "gratuit" : la donnée est déjà cachée et servie, il n'y a qu'un travail de type + UI à faire. Point de vigilance produit : prévoir un état de repli soigné (dégradé de couleur de marque, pas un backdrop cassé/vide) pour les fiches sans `backdrop_path` — TMDb ne le fournit pas toujours, notamment sur du contenu récent ou peu documenté.

**b) "Ton histoire avec cette série"** — *faisable immédiatement avec le schéma existant, aucune migration requise.* Composé de données déjà en base :
   - "Tu suis cette série depuis [date]" → `user_shows.created_at` existe déjà (migration `20260703094535_...sql:68`), non exploité actuellement sur cette page.
   - Progression → déjà calculée (`watched`/`episodes.length`), juste à remonter en tête de page plutôt qu'en bas, dans une variante mise en avant du VhsCounter (le composant a déjà une variante `hero` pensée pour ce genre d'usage, `src/components/vhs-counter.tsx:36`).
   - "≈ X heures passées avec cette série" → même heuristique déjà utilisée sur `/profile` (`AVG_EPISODE_MIN = 42`, `src/routes/_authenticated/profile.tsx:15,58`), appliquée au nombre d'épisodes vus *de cette série précise* plutôt qu'à l'ensemble du compte. Cohérent avec l'existant, aucune nouvelle donnée nécessaire — mais reste une **estimation à assumer comme telle dans le libellé** ("≈"), pas un chiffre présenté comme exact (cf. section 4, garde-fou anti-remplissage-marketing).
   
   Point de vigilance à trancher en amont du design : ce bloc n'a de sens que pour un utilisateur qui suit déjà la série (`userShow` non nul). Pour un visiteur non connecté ou non-suiveur, il faut soit le masquer entièrement, soit — option à débattre avec le reste de l'équipe — proposer une version "vide" incitative ("Suis cette série pour commencer ton historique"), sur le modèle du hero anonyme déjà pratiqué sur l'accueil (`fabricated watched/total` documenté dans `vhs-counter.tsx:27-34`). Je recommande la première option (masquer) pour éviter un ton "gamifié artificiellement" avant tout engagement réel de l'utilisateur — trade-off à valider avec vous puisqu'il touche à l'acquisition, pas seulement à la rétention.

**c) Micro-célébration de fin de saison** — *faisable immédiatement, pas de nouvelle donnée, mais nécessite un peu de logique d'état côté UI (pas de nouvelle table).* Quand le dernier épisode non-vu d'une saison passe à "vu" (via `toggleWatched` individuel ou via `toggleSeason` groupé, cf. `show.$mediaType.$tmdbId.tsx:257-418`), déclencher un feedback bref et sobre (toast + micro-animation sur le VhsCounter, qui a déjà une animation de "bump" à l'incrément, `vhs-counter.tsx:53-71`) plutôt qu'un simple changement d'état silencieux. C'est le moment "j'ai fini une saison" — un jalon naturel et déjà présent dans la donnée (il suffit de comparer l'état avant/après mutation), qui ne demande aucune nouvelle colonne ni table.

### Ce qui nécessiterait de nouvelles données (backlog, pas ce MVP)

- **Temps réel passé (vs estimation à 42 min/épisode)** — nécessiterait de stocker le `runtime`/`episode_run_time` TMDb (aucune colonne actuelle sur `shows` ou `episodes` pour ça), plus un changement de l'edge function `get-show-details` pour le récupérer. Amélioration de précision, pas un prérequis pour l'émotion — l'estimation actuelle suffit pour ce MVP.
- **Date de première découverte distincte de la dernière date de visionnage** — point de vigilance schéma à signaler explicitement : CLAUDE.md décrit `watch_status` comme "une ligne par visionnage, pas un booléen... pour gérer les rewatchs nativement", mais la table réellement créée (`supabase/migrations/20260703094535_..._.sql:80-86`) est **une seule ligne par (user_id, episode_id)** avec un compteur `watch_count` et un `watched_at` unique, écrasé à chaque nouveau visionnage (upsert `onConflict: "user_id,episode_id"`, cf. `addRewatch` dans la route, lignes 311-332). Concrètement : la date du **premier** visionnage n'est pas conservée une fois qu'un rewatch a eu lieu — seule la date du dernier survit. Un module "tu as découvert cet épisode le [date]" façon diary Letterboxd/Serializd n'est donc fiable **que pour les épisodes jamais revisionnés**, et deviendrait faux ou trompeur pour les autres. Ce n'est pas bloquant pour ce MVP (on ne construit pas de diary maintenant), mais c'est un écart réel entre l'intention documentée dans CLAUDE.md et l'implémentation actuelle, à trancher explicitement avant toute feature "journal" future : soit on ajoute une table d'événements (une ligne par visionnage, conforme à l'intention initiale), soit on assume que `watch_status` reste un compteur agrégé et on adapte le langage produit en conséquence (jamais promettre "date de découverte" si elle peut être fausse).
- **Reviews, notes personnelles, activité des amis sur la série** — hors scope confirmé par CLAUDE.md (phase 2 social/reviews), aucune table `reviews`/`follows` existante. Ne pas les simuler.

---

## 4. Ce qu'on NE fait PAS (garde-fous)

- **Ne jamais simuler de la donnée sociale ou communautaire absente.** Pas de "regardé par X personnes", pas de faux avis, pas de compteur d'amis tant qu'il n'y a pas de table sociale réelle. C'est exactement le type de remplissage marketing cassé reproché à Betaseries (bot de recommandation qui rate une fois sur deux) — mieux vaut une page honnête et sobre qu'une page qui bluffe et se fait démasquer au premier chargement vide.
- **Ne jamais présenter une estimation comme un fait exact.** Le "≈ X heures" doit rester explicitement approximatif dans le libellé (déjà la convention sur `/profile`, à conserver). Un chiffre qui se contredit ou paraît "faux" casse la confiance plus vite qu'il ne crée de l'attachement — la fiabilité perçue de la donnée est elle-même, comme noté en section 2, un facteur émotionnel (c'est la thèse anti-Betaseries).
- **Ne pas sacrifier la vitesse de logging au profit de l'émotion.** Le compteur VHS et la liste d'épisodes restent l'outil de travail quotidien : aucun des ajouts émotionnels (hero, bloc "ton histoire", micro-célébration) ne doit ajouter de latence perçue ou de clic supplémentaire au geste de cocher un épisode. Optimistic UI reste non négociable (principe déjà acté dans CLAUDE.md).
- **Ne pas ajouter de gamification tous azimuts (badges, séries de streaks, classements) sur cette page.** Le risque d'artificialité est réel si ces mécaniques sont posées sans réflexion — CLAUDE.md est explicite sur le fait de garder la chaleur du ton TV Time sans reprendre son cartoonesque. Si une mécanique de ce type est un jour désirée, elle mérite sa propre note produit dédiée (avec ses propres trade-offs de rétention vs artificialité), pas un ajout improvisé dans cette refonte.
- **Ne pas introduire de nouvel accent couleur ou de nouveau pattern de composant** pour "faire immersif" — le hero backdrop doit composer avec les tokens existants (`--bg-void`, dégradés vers ce fond, `--accent-amber`/`--accent-cyan` déjà réservés à leurs usages actuels) plutôt qu'introduire une nouvelle couleur signature, conformément à la direction design de CLAUDE.md.
- **Ne pas complexifier `watch_status` dans le cadre de cette refonte "page" pour résoudre le point b) ci-dessus (date de première découverte).** C'est un sujet de modèle de données qui dépasse le périmètre d'une refonte de page et mérite sa propre décision, pas un correctif improvisé en cours de route design.

---

## Résumé actionnable

| Priorité | Moment d'émotion | Faisabilité | Donnée requise |
|---|---|---|---|
| 1 | Hero backdrop immersif | Immédiate | `shows.backdrop_path` — déjà en base et déjà servi par `get-show-details`, juste absent du typage/UI de la route |
| 2 | "Ton histoire avec cette série" (depuis quand, progression, ≈ heures) | Immédiate | `user_shows.created_at` + `watch_status` (déjà exploités ailleurs) — aucune migration |
| 3 | Micro-célébration de fin de saison | Immédiate | Logique d'état sur mutation existante, VhsCounter déjà animé |
| Backlog | Temps réel (vs estimation 42 min) | Nécessite migration | `episode_run_time` TMDb à stocker |
| Backlog | Diary "date de découverte" fiable même après rewatch | Nécessite décision de modèle de données | Table d'événements par visionnage (conforme à l'intention initiale de CLAUDE.md, non implémentée telle quelle aujourd'hui) |
| Hors scope | Reviews, activité sociale/amis | Phase 2 actée | Tables `reviews`/`follows` inexistantes |
