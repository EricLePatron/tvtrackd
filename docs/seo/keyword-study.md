# Étude de mots-clés SEO — tvtrackd

**Date** : 2026-07-22 (J+7 après la fermeture de TV Time, 15 juillet 2026)
**Marché prioritaire** : francophone (SERP google.fr), avec des requêtes anglophones à forte intention de migration en secondaire.
**Auteur** : agent SEO — livrable d'analyse, aucune implémentation. Les besoins techniques sont listés en fin de document à destination de `tvtrackd-developer`, `marketing-communication-expert`, `entertainment-product-expert`, `entertainment-design-expert`.

> Convention de ce document : `[OBSERVÉ]` = constaté directement (SERP réelle via WebSearch/WebFetch, ou lecture du code) ; `[ESTIMATION]` = ordre de grandeur assumé, jamais un chiffre de volume précis inventé ; `[NOM DE MARQUE]` = passage dont la formulation finale dépend de l'arbitrage "TVTrackd" en cours — à reformuler quand tranché.

---

## 0. Résumé exécutif

Le produit tvtrackd est bien positionné produit-wise pour la fenêtre TV Time (import GDPR TV Time/Betaseries livré, calendrier des sorties livré, fiches TMDb livrées), mais **il n'existe aujourd'hui aucune page publique indexable qui porte l'argumentaire "alternative à TV Time"**. C'est le constat le plus important de cet audit, confirmé à la fois par la lecture du code (`src/routes`) et par `MARKETING.md` lui-même ("il n'existe toujours pas de landing page dédiée"). Pendant ce temps, la presse FR (Numerama, Journal du Geek, JustGeek, PureBreak, Stars Actu, Conciergerie du Geek…) a publié entre le 2 et le 15 juillet des articles "alternatives à TV Time" qui recommandent systématiquement **Betaseries** par défaut, et deux petits acteurs (Kino, Moviebase) ont déjà publié du contenu dédié ("Exporter ses données TV Time avant le 15 juillet 2026") — la fenêtre SEO est ouverte mais se referme, et tvtrackd n'y est présent nulle part `[OBSERVÉ]`.

Second constat majeur : les fiches série/film (le gisement SEO le plus massif, des milliers d'URLs potentielles) ont actuellement un **title tag, une meta description et un JSON-LD génériques et strictement identiques d'une fiche à l'autre** ("Série sur tvtrackd — fiche détaillée" au lieu du titre réel de la série). C'est un problème de duplicate content on-page qui neutralise ce gisement tant qu'il n'est pas corrigé — voir §2.

Troisième constat : le produit a déjà, en base et en composants, les données pour capter deux clusters à fort trafic aujourd'hui dominés par AlloCiné/JustWatch — "où regarder [série]" (`watch_providers`, composant `WhereToWatch`) et "séries comme/similaires à [série]" (`SimilarRail`, TMDb similar) — mais ces blocs sont rendus uniquement côté client dans un onglet/drawer, invisibles pour un crawler et absents du title/meta. C'est un quick win potentiel à effort réduit (pas de nouvelle feature, correction on-page + SSR).

---

## 1. Méthode et garde-fous

- Recherches réelles menées le 2026-07-22 via WebSearch sur les SERP FR : "TV Time ferme 15 juillet 2026 alternative française", "alternative TV Time gratuite français tracker séries", "exporter données TV Time avant fermeture", "betaseries avis bugs lenteur 2026", "où regarder série streaming France", "séries similaires à", "explication fin série casting résumé", "meilleures séries 2026 France". Les URLs et constats cités comme `[OBSERVÉ]` viennent de ces recherches.
- Aucun outil de volume de mots-clés (Ahrefs/Semrush/GSC branché) n'était disponible pendant cette étude — toute mention de volume est explicitement qualifiée `[ESTIMATION]` en ordre de grandeur (faible/moyen/élevé/très élevé), jamais en chiffre absolu.
- Code inspecté avant toute recommandation : `src/routes/**` (routes publiques, `_authenticated`, `sitemap.xml.ts`, `__root.tsx`), `public/robots.txt`, `vite.config.ts`, `MARKETING.md`, `ROADMAP.md`, composants `show/similar-rail.tsx`, `where-to-watch.tsx`, `lib/app-config.ts`.
- Nom de marque : toutes les recommandations ci-dessous utilisent `[NOM DE MARQUE]` (ou l'équivalent produit `APP_NAME`) plutôt que "TVTrackd" en dur, conformément à CLAUDE.md. Le domaine actuellement codé en dur (`https://tvtrackd.com` dans `__root.tsx` et `sitemap.xml.ts`) dépend du même arbitrage — signalé en §2.
- RLS : aucune recommandation ci-dessous ne propose d'indexer une bibliothèque utilisateur, un profil privé, ou une donnée `user_shows`/`watch_status`. Le seul contenu "profil" évoqué (§4, backlog `#16` profil public `/u/pseudo`) est un profil **opt-in explicitement public**, pas une fuite RLS.
- Duplicate content TMDb : chaque recommandation de fiche série/film ci-dessous distingue ce qui vient tel quel de TMDb (à ne pas dupliquer sans valeur ajoutée) de ce qui est unique à tvtrackd (statut de diffusion en direct, calendrier des prochains épisodes, progression communautaire, disponibilité streaming agrégée, angle éditorial).

---

## 2. Audit technique express (préalable non négociable)

Avant tout plan de contenu : ce que le crawl voit réellement aujourd'hui.

| # | Constat | Preuve | Impact SEO | Priorité | Action → qui |
|---|---|---|---|---|---|
| T1 | **Title/meta/JSON-LD des fiches série/film sont génériques**, identiques pour toutes les fiches d'un même `mediaType` ("Série sur tvtrackd — fiche détaillée", `name` JSON-LD = "Série sur tvtrackd") au lieu du titre réel (`show.title`) | `src/routes/_public/show.$mediaType.$tmdbId.tsx`, fonction `head()` — ne reçoit que `params` (mediaType, tmdbId), pas les données TMDb | **Critique.** Des milliers de fiches potentielles partagent le même title tag → Google traite ça comme du duplicate/thin content massif, aucune fiche ne peut ranker sur le nom de la série/du film | P0 | `tvtrackd-developer` : passer par un `loader` de route (fetch server-side de `get-show-details` ou lecture directe de `shows`) pour que `head()` dispose du titre réel, du synopsis TMDb et du poster, et régénérer title/description/OG/JSON-LD à partir de ces données réelles |
| T2 | **Contenu de la fiche potentiellement absent du HTML initial** : la page ne définit pas de `loader`, les données (`show`, `seasons`, `episodes`, cast, similaires, disponibilité) arrivent via `useQuery` déclenché au montage client | Aucune occurrence de `loader:`/`beforeLoad` dans les routes publiques (`grep` sur `src/routes` : seuls `_authenticated/route.tsx` et `admin.tsx` en ont) | **Élevé.** Même si Googlebot exécute le JS (indexation en deux vagues), le contenu réellement utile (synopsis, casting, "où regarder", "séries similaires") risque de n'être visible qu'en seconde vague, plus lent et moins fiable qu'un rendu SSR direct | P0 | `tvtrackd-developer` : confirmer avec TanStack Start si un `loader` route peut pré-fetch et hydrater `get-show-details` côté serveur (SSR réel), pas seulement le `head()`. Prioriser au moins pour show/season/episode/cast/watch-providers, les données publiques structurantes |
| T3 | **Sitemap statique de 8 URLs fixes**, aucune fiche série/film, aucune page éditoriale | `src/routes/sitemap[.]xml.ts` : `ENTRIES` codé en dur | **Élevé.** Le gisement de fiches (potentiellement des milliers) n'est même pas soumis au crawl via sitemap — dépendance à la découverte organique de liens internes seule | P0 | `tvtrackd-developer` : générer un sitemap dynamique (paginé si besoin, index de sitemaps) à partir de la table `shows` (cache TMDb), en n'incluant que les fiches avec contenu suffisant (voir T6) |
| T4 | **`/calendar` n'a aucun contenu indexable pour un visiteur anonyme** — seulement un encart "Connexion requise" | `src/routes/_public/calendar.tsx` lignes 48-56 : branche `!user` → CTA de connexion uniquement | **Élevé.** "calendrier séries", "calendrier des sorties" sont des requêtes informationnelles à bon volume `[ESTIMATION : moyen-élevé]` que Googlebot (anonyme par définition) ne peut pas satisfaire sur cette page telle quelle | P1 | `tvtrackd-developer` + `entertainment-product-expert` : décider d'un contenu public par défaut sur `/calendar` (ex. calendrier des sorties les plus attendues toutes séries confondues, sans connexion — TMDb `airing_today`/`on_the_air`), la vue personnalisée restant réservée aux connectés |
| T5 | **La meilleure copie "TV Time ferme / récupérez vos données" existe déjà mais est gated derrière l'auth** (`/_authenticated/import`) — confirmé aussi par `MARKETING.md` : "il n'existe toujours pas de landing page dédiée" | `src/routes/_authenticated/import.tsx` lignes 26-39, `MARKETING.md` ligne 3 | **Critique**, voir cluster A/B en §3 — c'est l'angle mort n°1 de toute la stratégie SEO fenêtre TV Time | P0 | Contenu à co-construire `marketing-communication-expert` + brief on-page ci-dessous ; implémentation route publique → `tvtrackd-developer` |
| T6 | **Risque de thin content sur les fiches à très faible remplissage** (série TMDb avec juste titre + poster, sans overview ni providers) | Cache `shows`/`seasons`/`episodes`, TTL 24-48h — aucune règle de qualité minimale avant indexation observée | Moyen | P2 | `tvtrackd-developer` : règle de `noindex` conditionnel (ou exclusion du sitemap) pour les fiches sans overview ni providers ni saisons connues |
| T7 | Pas de `hreflang` — cohérent avec un site mono-langue FR aujourd'hui | `__root.tsx` : `<html lang="fr">`, pas de balises alternates | Faible aujourd'hui | P3 (à revisiter si version EN) | Pas d'action immédiate — noter pour plus tard si une version anglophone est livrée |
| T8 | `robots.txt` correct (`Allow: /`) et référence bien le sitemap | `public/robots.txt` | — | — | Rien à faire, juste garder synchronisé avec T3 |
| T9 | Le domaine `https://tvtrackd.com` est codé en dur dans `__root.tsx` (JSON-LD, OG) et `sitemap.xml.ts` (`BASE_URL`), alors que le nom/domaine n'est pas encore arbitré | `__root.tsx` lignes 4, 101-121 ; `sitemap[.]xml.ts` ligne 4 | Moyen — cohérent avec l'alerte transversale déjà loggée dans `ROADMAP.md` (`APP_NAME` non généralisé partout) | P1 | `tvtrackd-developer` : centraliser dans une variable de config (à côté de `APP_NAME`) ; ne pas committer d'URL finale tant que le domaine n'est pas tranché — **décision à fort impact, à présenter à l'utilisateur, pas à trancher seul** |
| T10 | `WhereToWatch` et `SimilarRail` existent et exploitent déjà des données réelles (TMDb watch/providers, TMDb similar) mais sont rendus dans des sous-composants client-only, sans résumé textuel exposé dans le head/JSON-LD | `src/components/where-to-watch.tsx`, `src/components/show/similar-rail.tsx` | Élevé — gisement de trafic gratuit (voir §4, opportunités O1/O3) déjà data-ready, juste pas exposé au crawl | P1 | `tvtrackd-developer` : une fois T1/T2 réglés (loader SSR), inclure un résumé texte "Disponible sur X, Y, Z" et "Si vous avez aimé A, B, C" dans le HTML serveur, pas seulement dans le drawer/carrousel interactif |

**Conséquence méthodologique** : tant que T1–T3 et T5 ne sont pas traités, aucune stratégie de contenu SEO catalogue ou éditorial n'a d'effet mesurable — ils passent avant tout le reste de ce document en termes de séquencement (voir §7 Roadmap).

---

## 3. Volet 1 — Mots-clés déjà alignés avec le produit actuel

Le produit fait aujourd'hui : tracking épisode par épisode avec rewatchs, calendrier des sorties, import CSV/JSON/zip GDPR (TV Time + Betaseries), export JSON, fiches série/film TMDb avec statuts de bibliothèque, disponibilité streaming (watch providers), casting, titres similaires. Les clusters ci-dessous s'appuient strictement sur cette réalité.

### Cluster A — Fermeture de TV Time (le plus chaud, fenêtre en cours de refermeture)

*Intention* : informationnelle → transactionnelle. *Fenêtre* : critique, l'essentiel du volume de recherche est déjà passé (pic autour du 15/07) mais une traîne subsiste plusieurs semaines (retardataires, gens qui découvrent la fermeture après coup) `[OBSERVÉ dans les SERP : articles datés du 2 au 15/07 encore en première page le 22/07]`.

| Mot-clé pilier | Longue traîne | Intention | Difficulté estimée | Alignement business | Page cible | Angle différenciant |
|---|---|---|---|---|---|---|
| tv time ferme | "tv time ferme quand", "pourquoi tv time ferme", "tv time fermeture date" | Informationnelle | Élevée `[OBSERVÉ : presse tech FR bien installée — Numerama, JDG, JustGeek, PureBreak, Stars Actu]` | Élevé (capte l'intention day-1) | **Page à créer** : landing "TV Time ferme le 15 juillet 2026 — ce qu'il faut faire" | Factuel d'abord (date, contexte Whip Media/Blue Torch), puis pont vers l'export/import — pas un article opportuniste |
| exporter données tv time | "récupérer historique tv time", "export gdpr tv time", "tv time export zip" | Informationnelle → transactionnelle | Moyenne (Kino, Moviebase, Frandroid déjà dessus `[OBSERVÉ]`) | Très élevé — c'est exactement le guide déjà rédigé dans `/_authenticated/import` | **Page à créer** (rendre public un dérivé de `import.tsx`) | Angle "mémoire durable" du CLAUDE.md : pas juste un guide d'export générique, mais le point d'entrée direct vers l'import 1-clic |
| alternative tv time | "alternative tv time gratuite", "alternative tv time français", "que faire après fermeture tv time" | Transactionnelle/comparative | Élevée `[OBSERVÉ : Betaseries cité par défaut dans quasi tous les articles presse]` | Très élevé | **Page à créer** : "Alternative à TV Time en français" | Se positionner sur la fiabilité technique (vs Betaseries) + export dès le premier jour, pas juste "on remplace TV Time" |
| importer tv time dans une autre app | "importer mon historique tv time", "migrer de tv time vers" | Transactionnelle, forte intention | Faible-moyenne (peu de contenu dédié à l'exécution technique, la plupart des articles restent superficiels) | Très élevé — feature déjà livrée | Landing publique d'import (dérivée de `import.tsx`) | Détail concret des formats supportés (zip GDPR, CSV Betaseries) — preuve d'exécution vs discours marketing |
| j'ai perdu mes données tv time / tv time données supprimées | — | Pain point, post-fermeture | Faible (peu couvert, plus niche) | Moyen (utilisateurs qui n'ont pas anticipé — petit volume mais forte détresse/conversion) | FAQ dédiée sur la landing alternative | Ton rassurant + honnête ("si vous n'avez pas exporté à temps, voici ce qu'il reste possible de faire") |

### Cluster B — Alternative à Betaseries / comparatifs

*Intention* : comparative/transactionnelle. *Fenêtre* : durable (pas liée à un pic).

| Mot-clé pilier | Longue traîne | Intention | Difficulté | Alignement business | Page cible | Angle différenciant |
|---|---|---|---|---|---|---|
| betaseries avis / betaseries bug | "betaseries lent", "betaseries ne fonctionne pas", "betaseries se déconnecte" | Pain point | Faible-moyenne `[OBSERVÉ : forum Betaseries lui-même truffé de plaintes de lenteur/bugs de synchro en 2026]` | Très élevé — c'est la thèse produit exacte du CLAUDE.md | **Page à créer** : "Betaseries est lent ? Une alternative qui marche" | Jamais dénigrant nommément et de façon agressive (cohérent avec le principe marketing "rester factuel") — comparatif honnête de fonctionnalités, pas de procès d'intention |
| alternative betaseries | "meilleur que betaseries", "betaseries vs trakt", "betaseries vs [nom de marque]" | Comparative | Moyenne | Élevé | Page comparatif dédiée | Tableau fiabilité technique + export + design, pas de surenchère de fonctionnalités |
| trakt en français / simkl français | "trakt vs betaseries", "simkl avis français" | Navigationnelle/comparative | Faible (peu de contenu FR dédié — Trakt/Simkl restent anglophones) | Moyen (public plus technique, alignement partiel avec le positionnement "grand public" visé) | Article éditorial "Trakt, Simkl, Betaseries : lequel choisir en français ?" | Se positionner explicitement comme le choix "fiable + FR + sans friction technique", entre Betaseries (marque mais buggé) et Trakt/Simkl (solides mais anglophones/techniques) |

### Cluster C — Mémoire durable / export (argument produit central)

*Intention* : informationnelle → transactionnelle. Fenêtre durable, renforcée par le traumatisme TV Time.

| Mot-clé pilier | Longue traîne | Intention | Difficulté | Alignement business | Page cible | Angle différenciant |
|---|---|---|---|---|---|---|
| exporter mes séries vues | "sauvegarder historique séries", "export json séries vues" | Informationnelle | Faible | Élevé | Page/section éditoriale "Vos données ne vous quittent jamais" | Positionner l'export comme un argument day-1 (pas un service après-vente de crise, contrairement à TV Time) — reprend `ROADMAP.md` point #12 |
| ne pas perdre historique séries | "tracker séries sans risque de perdre mes données" | Pain point | Faible | Élevé | Même page | Message de confiance explicite, aligné avec le ton "vidéo-club nocturne" (mémoire, pas gadget) |

### Cluster D — Usage tracker générique (grand public, pas que hardcore trackers)

*Intention* : navigationnelle/informationnelle. Fenêtre durable, volume plus large mais concurrence plus dure (Betaseries a la marque).

| Mot-clé pilier | Longue traîne | Intention | Difficulté | Alignement business | Page cible | Angle différenciant |
|---|---|---|---|---|---|---|
| tracker série / suivi série | "app pour suivre ses séries", "site pour marquer les épisodes vus" | Navigationnelle/informationnelle | Élevée (Betaseries capte historiquement ce terme en FR) | Élevé | Page d'accueil (déjà en place) | Le hero "Ce soir" + compteur VHS est un différenciateur visuel réel — à mettre en avant dans le title/meta actuel (déjà fait, cf. `index.tsx`) |
| marquer épisode vu | "comment marquer un épisode comme vu", "compter les épisodes vus" | Informationnelle, bas de l'entonnoir produit | Faible | Élevé | Fiche série (une fois T1/T2 réglés) | Le compteur "façon VHS" est un vrai signe distinctif produit à documenter en FAQ/page d'aide |
| calendrier des sorties séries | "calendrier séries à venir", "quand sort le prochain épisode" | Informationnelle, usage récurrent | Moyenne (JustWatch, Betaseries, AlloCiné déjà présents) | Élevé — feature déjà livrée et bien exécutée (`UpcomingSchedule`) | `/calendar` — **bloqué par T4** | Le calendrier par série suivie + compte à rebours ("Dans 3 sem.") est déjà une bonne UX, juste invisible aux crawlers aujourd'hui |
| suivre plusieurs séries en même temps / bibliothèque séries | "organiser mes séries à voir" | Informationnelle | Faible-moyenne | Élevé | Page d'accueil/pages d'aide | Statuts à_voir/en_cours/terminé/abandonné/archivé, désarchivage qui fonctionne réellement (contrairement à Betaseries) — argument produit concret et vérifiable |

### Cluster E — Fiches série/film (longue traîne massive, une fois T1–T3 corrigés)

*Intention* : navigationnelle (nom de série précis) → informationnelle (statut, épisodes, casting). Fenêtre durable, volume cumulé potentiellement très élevé (longue traîne sur des milliers de titres) `[ESTIMATION]`.

| Mot-clé pilier (patron) | Longue traîne type | Intention | Difficulté | Alignement business | Page cible | Angle différenciant vs TMDb brut |
|---|---|---|---|---|---|---|
| "[titre série]" seul | "[titre série] saison X", "[titre série] épisode X date de sortie" | Navigationnelle | Variable par titre (faible sur les titres de niche, très élevée sur les blockbusters, dominés par AlloCiné/Wikipedia/IMDb) | Élevé sur la longue traîne cumulée | Fiche série (`/show/tv/:tmdbId`) | Statut de diffusion en direct + calendrier des prochains épisodes propre à la série + progression communautaire — pas juste le synopsis TMDb recopié |
| "[titre série] combien de saisons" | "[titre série] nombre d'épisodes" | Informationnelle | Faible-moyenne | Moyen | Fiche série | Donnée déjà en base (`seasons.episode_count`), à exposer clairement dans le H1/contenu structuré, pas seulement dans l'UI de tracking |

**Note de vigilance duplicate content (rappel §1)** : sur ce cluster, ne jamais se contenter de reproduire l'`overview` TMDb comme unique contenu — toujours l'entourer d'éléments propres à tvtrackd (statut live, calendrier, disponibilité, similaires, progression) pour constituer une page à valeur ajoutée réelle, condition pour que Google la traite comme un contenu original plutôt qu'un miroir de TMDb/thetvdb/IMDb.

---

## 4. Volet 2 — Opportunités du domaine séries non couvertes → feature associée

Pour chaque opportunité : la requête, ce qui ranke déjà (concurrence réelle observée), la feature à construire pour se positionner légitimement, l'impact/effort, et le lien backlog CLAUDE.md/ROADMAP.md quand pertinent.

| # | Opportunité (requêtes) | Ce qui ranke aujourd'hui `[OBSERVÉ]` | Feature à construire | Aligné avec le produit actuel ? | Impact | Effort | Backlog lié |
|---|---|---|---|---|---|---|
| O1 | **"où regarder [série]"**, "[série] streaming", "[série] netflix/disney+/prime" | JustWatch (dominant), AlloCiné | **Déjà en grande partie construit** (`watch_providers`, composant `WhereToWatch`) — il manque l'exposition SEO (SSR + résumé texte + éventuellement une page dédiée par plateforme, ex. "séries disponibles sur Netflix FR") | Oui, quasiment livré | Élevé | Faible (correction on-page, cf. T2/T10) — une page listicle par plateforme serait un effort M supplémentaire | — |
| O2 | **"quand sort la saison X de [série]"**, "date de sortie saison prochaine", décompte de sortie | AlloCiné (articles ponctuels), Wikipedia, threads Reddit | Les dates (`episodes.air_date`) sont déjà en base et déjà affichées dans `UpcomingSchedule` sur la fiche connectée — construire une **section publique "prochaine diffusion"** visible sans connexion sur la fiche, + éventuellement un compte à rebours mis en avant dans le title/meta ("[Série] saison X — date de sortie") | Oui, données déjà là | Élevé | Faible (dépend de T1/T2 pour être visible au crawl) | — |
| O3 | **"séries similaires à [série]"**, "si vous avez aimé X regardez Y" | filmsimilaire.com, similaires.com (spécialistes de niche), SensCritique | **Déjà construit** (`SimilarRail`, TMDb similar) — manque l'exposition SEO (liste textuelle dans le HTML serveur, pas seulement un carrousel interactif) | Oui, quasiment livré | Moyen-élevé | Faible | — |
| O4 | **"casting [série]"**, "qui joue [personnage]", filmographie acteur | AlloCiné (dominant sur le casting structuré) | Partiellement construit (`CastRail`, route `/person/$personId`) — manque : titres/meta uniques par acteur (aujourd'hui `person.$personId.tsx` a un title générique "Filmographie — [nom de marque]", pas le nom de l'acteur), SSR des crédits | Oui, quasiment livré | Moyen | Faible-moyen (même famille de correctifs que T1) | — |
| O5 | **"meilleures séries 2026"**, "séries à voir en ce moment", listicles éditoriaux | AlloCiné, SensCritique, Buzzwebzine, sites éditoriaux généralistes | **Nouvelle feature éditoriale** : pages "Top séries du moment" générées semi-automatiquement (tendances TMDb déjà consommées côté `useTrending`/`DiscoverySection`) + angle rédactionnel (pas un pur agrégat automatique — sinon thin content face à des rédactions qui argumentent) | Partiel (la donnée tendance existe, l'habillage éditorial non) | Moyen | Moyen — nécessite du contenu rédigé, pas juste un flux de données | Coordination `marketing-communication-expert` (calendrier éditorial), pas dans `ROADMAP.md` actuel — à arbitrer avec `entertainment-product-expert` |
| O6 | **"explication de la fin de [série]"**, résumé d'épisode commenté, analyse | AlloCiné (très fort sur ce créneau, contenu rédactionnel dédié par série à succès) | **Nouvelle feature éditoriale lourde** : articles d'analyse par série/saison — hors périmètre actuel du produit (pas dans `CLAUDE.md`/`ROADMAP.md`), proche du terrain "reviews/social" (`ROADMAP.md` #24, phase 2 explicite) | Non — nécessite un vrai pôle rédactionnel, gourmand en effort récurrent | Élevé si exécuté, mais... | Élevé (contenu récurrent, éditorial, non automatisable sans risque qualité) | À arbitrer avec `entertainment-product-expert` : concurrence directe avec AlloCiné sur son terrain le plus fort, alignement discutable avec la thèse "on n'affronte pas frontalement" du CLAUDE.md — recommandation : ne pas prioriser avant le socle tracker/fiches |
| O7 | **Moteur de recommandation personnalisé** ("meilleure appli pour recommandations séries", trafic indirect via bouche-à-oreille/avis plutôt que SEO direct) | Betaseries (bot cassé, cf. CLAUDE.md), Trakt (API) | `ROADMAP.md` #15 : moteur de reco v1 (genres/équipe TMDb) — impact SEO indirect (avis, bouche-à-oreille, réduction du churn) plus que mots-clés directs | Backlog déjà identifié | Élevé (différenciation produit) mais impact SEO indirect | M (déjà scopé backlog) | `ROADMAP.md` #15 |
| O8 | **"importer trakt"**, "connecter mon compte trakt" | Peu de contenu FR dédié | `ROADMAP.md`/`CLAUDE.md` backlog : import "connecter mon compte Trakt" (OAuth2) — capte un public de niche mais qualifié (power users Trakt francophones) | Backlog déjà identifié, priorité "selon demande" | Faible-moyen (niche) | L | `ROADMAP.md` #25, `CLAUDE.md` backlog |
| O9 | **Scrobbling automatique streaming** ("tracker automatique netflix", équivalent Simkl) | Simkl (dominant sur ce terrain) | `ROADMAP.md` #26 — techniquement lourd, hors scope court terme confirmé | Backlog déjà identifié, explicitement différé | Élevé si exécuté, mais... | L, risque technique élevé | `ROADMAP.md` #26 |
| O10 | **Reviews/notes par épisode**, "avis sur [série]", profils publics partageables | SensCritique (dominant sur les avis structurés) | `ROADMAP.md` #24 (reviews) et #16 (profil public `/u/pseudo`) — chaque profil public opt-in et chaque review publique deviendrait une page indexable additionnelle (UGC public, jamais de bibliothèque privée) | Backlog déjà identifié, phase 2 explicite | Moyen-élevé à terme (UGC = volume de pages qui grandit avec la communauté) | M/L | `ROADMAP.md` #16, #24 |
| O11 | **"tv time alternative" en anglais** (francophones qui tapent en anglais, Belgique/Suisse/Québec inclus) | Kino (kino-tv.co, bilingue), Moviebase, alternativeto.net | Pas une nouvelle feature — un **contenu bilingue léger** (une version EN de la landing alternative, cf. cluster A/B), sans complexifier l'architecture `hreflang` tant qu'il n'y a pas de vraie version produit EN | Alignement partiel — CLAUDE.md priorise le FR d'abord | Moyen | Faible (une page, pas une traduction complète du produit) | Coordination `marketing-communication-expert` |

**Lecture rapide impact/effort (features)** :
- **Impact élevé / effort faible** (à faire en premier) : O1, O2, O3 — la donnée existe déjà, il s'agit presque uniquement de correctifs on-page/SSR (T1, T2, T10).
- **Impact moyen / effort faible-moyen** : O4 (casting), O11 (contenu bilingue léger).
- **Impact élevé / effort moyen, contenu récurrent** : O5 (listicles éditoriaux), à cadrer avec marketing.
- **Impact élevé mais risque d'écart de positionnement** : O6 (explication de fin) — à arbitrer explicitement, ne concurrence pas la thèse "ne pas affronter frontalement les acteurs installés sur leur terrain fort".
- **Différé/backlog déjà connu, impact SEO indirect ou de niche** : O7, O8, O9, O10 — pas de nouvelle recommandation SEO, juste rattaché au backlog produit existant pour traçabilité.

---

## 5. Matrice de priorisation (clusters volet 1)

| Cluster | Intention | Difficulté | Alignement business | Priorité globale |
|---|---|---|---|---|
| A — Fermeture TV Time | Info → transactionnelle | Élevée mais fenêtre encore active | Très élevé | **P0 — cette semaine** |
| C — Export/mémoire durable | Info → transactionnelle | Faible | Élevé | **P0 — cette semaine** (même page que A) |
| B — Alternative Betaseries | Comparative | Moyenne | Très élevé | **P1 — sous 2-4 semaines** |
| E — Fiches série/film | Navigationnelle | Variable, cumul élevé | Élevé | **P0 techniquement (T1-T3), P1 en volume de fiches enrichies** |
| O1/O2/O3 (où regarder, dates, similaires) | Info/transactionnelle | Moyenne | Élevé | **P1 — dès que T1/T2 réglés** |
| D — Usage tracker générique | Navigationnelle/info | Élevée (Betaseries a la marque) | Élevé | **P2 — continu, evergreen** |
| O4 (casting) | Navigationnelle | Moyenne | Moyen | **P2** |
| O5 (listicles éditoriaux) | Info | Élevée (AlloCiné/SensCritique) | Moyen | **P2, à cadencer avec le calendrier éditorial marketing** |
| O6 (explication de fin) | Info | Très élevée (terrain fort AlloCiné) | À arbitrer | **P3 — ne pas engager sans décision produit explicite** |
| O11 (contenu bilingue léger) | Comparative | Faible-moyenne | Moyen | **P2** |

---

## 6. Quick wins — fenêtre TV Time (à traiter en premier, effort limité)

1. **Publier une landing publique "TV Time ferme — récupérez vos données"** en dérivant le contenu déjà écrit dans `/_authenticated/import.tsx` (le texte existe, il est juste gated). Contenu 100 % réutilisable, effort principalement technique (nouvelle route publique) + un peu de réécriture éditoriale pour un public non connecté. *Ceci est le quick win n°1, confirmé indépendamment par le code et par `MARKETING.md`.*
2. **Corriger T1 (title/meta/JSON-LD génériques des fiches)** — passe par un `loader` de route ; sans ça, aucune fiche ne peut jamais ranker sur le nom d'une série, y compris pendant la fenêtre TV Time où le trafic de migration cherche justement "importer [ma série] depuis TV Time".
3. **Étendre `sitemap.xml` dynamiquement** (T3) dès que T1 est réglé — sinon les fiches corrigées ne sont même pas soumises au crawl.
4. **Rendre `/calendar` partiellement public** (T4) — un calendrier des sorties généraliste sans connexion capte une requête à volume estimé moyen-élevé, aujourd'hui à zéro contenu pour un visiteur anonyme.
5. **Exposer un résumé texte serveur pour `WhereToWatch`/`SimilarRail`** (T10) — capte "où regarder" et "séries similaires" sans construire de nouvelle feature, juste en rendant visible au crawl ce qui existe déjà en base.

---

## 7. Roadmap séquencée (qui fait quoi)

### Phase 0 — Fondations techniques (bloquant, avant tout effet mesurable)
- `tvtrackd-developer` : T1 (loader + head dynamique par fiche), T2 (SSR réel des données publiques), T3 (sitemap dynamique), T9 (variable de config pour domaine/nom, pas de valeur en dur).
- Coordination : le choix du domaine final (`.fr` vs autre) est une **décision à fort impact** — présentée à l'utilisateur, jamais tranchée par cet agent seul.

### Phase 1 — Landing pages fenêtre TV Time (contenu prêt, effort d'implémentation faible)
- `marketing-communication-expert` + agent SEO : brief on-page et copy pour la landing "Alternative à TV Time" (cluster A/B), en réutilisant le texte déjà validé de `import.tsx`.
- `tvtrackd-developer` : route publique dédiée, canonical, OG, JSON-LD `WebPage`/`FAQPage` si structure Q/R.
- `entertainment-design-expert` : habillage visuel cohérent "vidéo-club nocturne" (pas un simple mur de texte).

### Phase 2 — Exposition SEO des features déjà construites (O1/O2/O3/O4)
- `tvtrackd-developer` : résumés texte SSR pour disponibilité streaming, calendrier de sortie par série, titres similaires, pages personnes.
- Agent SEO : templates de title/meta par type de page (fiche série, fiche film, fiche personne), maillage interne (fiche → similaires → fiche).

### Phase 3 — Contenu éditorial evergreen (O5, D, cluster B élargi)
- `marketing-communication-expert` : calendrier éditorial (listicles "meilleures séries du moment", comparatifs Betaseries/Trakt/Simkl).
- Agent SEO : ciblage mot-clé, structure Hn, maillage interne pour chaque article.
- `entertainment-product-expert` : arbitrage sur O6 (explication de fin) — décision explicite d'engager ou non ce terrain, en cohérence avec la thèse de non-affrontement frontal.

### Phase 4 — UGC indexable (O10, une fois `ROADMAP.md` #16/#24 livrés)
- Profils publics opt-in et reviews publiques comme nouvelles pages indexables — jamais de bibliothèque privée.

---

## 8. Mesure et suivi

- **Outils à mettre en place** : Google Search Console (prioritaire, gratuit, valide la couverture d'indexation réelle une fois T1-T3 corrigés) et Bing Webmaster Tools. Aucun de ces deux n'a pu être vérifié comme déjà branché — à confirmer avec `tvtrackd-developer`/`entertainment-analytics-expert`.
- **KPIs par phase** :
  - Phase 0 : nombre de pages indexées vs soumises (avant/après correction T1-T3) dans GSC.
  - Phase 1 : impressions/clics sur les requêtes cluster A/B (fermeture TV Time, alternative TV Time), position moyenne, CTR.
  - Phase 2 : trafic organique sur les fiches série/film, requêtes de longue traîne captées ("où regarder…", "…saison date de sortie", "…similaires à").
  - Phase 3 : trafic et backlinks acquis sur le contenu éditorial (à croiser avec le plan de netlinking de `marketing-communication-expert`).
- **Coordination `entertainment-analytics-expert`** : le trafic organique doit être visible comme canal d'acquisition distinct dans la vue globale (vs Reddit/presse/Discord du plan `MARKETING.md`), avec le même souci de ne jamais mesurer via des données utilisateur privées.

---

## 9. Rappel des garde-fous (à ne jamais transgresser dans l'exécution de cette étude)

- Pas de nom de marque en dur dans les livrables techniques transmis — toujours `APP_NAME`/variable de config, "[nom de marque]" dans la copy tant que non tranché.
- Pas de domaine final en dur — `T9` doit être résolu par une variable de config, la décision finale de domaine revient à l'utilisateur.
- Aucune page indexable ne doit exposer une bibliothèque privée, un `user_shows`, un `watch_status`, ou toute donnée sous RLS individuelle — seuls des profils/reviews **opt-in explicitement publics** (backlog `#16`/`#24`) sont éligibles à terme.
- Aucune fiche ne doit être un simple miroir du synopsis TMDb — toujours accompagnée d'un élément propre à tvtrackd (statut live, calendrier, disponibilité, similaires) pour éviter le duplicate content.
- Aucune recommandation de netlinking agressif (achat de liens, PBN, cloaking) — uniquement de l'earned media honnête (presse déjà identifiée dans `MARKETING.md`), en coordination avec `marketing-communication-expert`.
- Aucun chiffre de volume de recherche précis n'a été inventé dans ce document — toutes les estimations sont qualifiées `[ESTIMATION]` en ordre de grandeur.
