# Étude de mots-clés SEO — tvtrackd

**Date** : 2026-07-22 (J+7 après la fermeture de TV Time, 15 juillet 2026)
**Marché prioritaire** : francophone (SERP google.fr), avec des requêtes anglophones à forte intention de migration en secondaire.
**Auteur** : agent SEO — livrable d'analyse, aucune implémentation. Les besoins techniques sont listés en fin de document à destination de `tvtrackd-developer`, `marketing-communication-expert`, `entertainment-product-expert`, `entertainment-design-expert`.

> Convention de ce document : `[OBSERVÉ]` = constaté directement (SERP réelle via WebSearch/WebFetch, ou lecture du code) ; `[ESTIMATION]` = ordre de grandeur assumé, jamais un chiffre de volume précis inventé ; `[NOM DE MARQUE]` = passage dont la formulation finale dépend de l'arbitrage "TVTrackd" en cours — à reformuler quand tranché.

> **Révision du 2026-07-22 (v2)** : l'audit technique de la v1 contenait plusieurs affirmations factuellement fausses, corrigées après relecture ligne-à-ligne du code avec l'utilisateur. En particulier : le SSR **est** actif sur les routes publiques (`vite.config.ts` embarque `tanstackStart`/`nitro`, les `head()` — title/meta/OG/JSON-LD — sont bien rendus côté serveur sur `_public/*`) ; `WhereToWatch`, `UpcomingSchedule`, `CastRail` et `SimilarRail` sont **publics** (page `/_public/show/...`), pas auth-gated ; le messaging TV Time n'est **pas** entièrement verrouillé (présent dans la home anonyme et l'onboarding), seulement dispersé et sans landing dédiée indexable. Le problème réel n'est pas "absence de SSR" mais (a) des `head()` construits uniquement à partir des `params` d'URL, jamais des données réelles, et (b) une absence de `loader` de route qui ferait qu'en plus du `head()`, le **contenu du body** (synopsis, casting, plateformes, similaires) soit lui aussi présent dans le HTML initial plutôt que chargé après hydratation via `useQuery`. Conséquence : plusieurs efforts ont été revus nettement à la baisse (quick wins de correction/exposition plutôt que nouvelles features) — voir §2 et §4 pour le détail corrigé, et les clusters mots-clés du §3 restent inchangés sur le fond.

---

## 0. Résumé exécutif

Le produit tvtrackd est bien positionné produit-wise pour la fenêtre TV Time (import GDPR TV Time/Betaseries livré, calendrier des sorties livré, fiches TMDb livrées, et l'app **est** en SSR — TanStack Start + Nitro, pas une SPA client-only). Le constat le plus important de cet audit n'est pas une absence de rendu serveur, mais **une absence de page publique indexable, à URL et title dédiés, qui porte l'argumentaire "alternative à TV Time"**. Le message existe déjà — meta description de la home ("import TV Time"), bandeau de la home anonyme ("Vous arrivez de TV Time ou Betaseries ?"), carte d'onboarding ("Importez votre historique TV Time ou Betaseries") — mais il est **dispersé** dans des composants secondaires plutôt que porté par une landing ciblée mot-clé, ce que `MARKETING.md` confirme lui-même ("il n'existe toujours pas de landing page dédiée"). Pendant ce temps, la presse FR (Numerama, Journal du Geek, JustGeek, PureBreak, Stars Actu, Conciergerie du Geek…) a publié entre le 2 et le 15 juillet des articles "alternatives à TV Time" qui recommandent systématiquement **Betaseries** par défaut, et deux petits acteurs (Kino, Moviebase) ont déjà publié du contenu dédié ("Exporter ses données TV Time avant le 15 juillet 2026") — la fenêtre SEO est ouverte mais se referme, et tvtrackd n'y est présent nulle part `[OBSERVÉ]`.

Second constat majeur : les fiches série/film (le gisement SEO le plus massif, des milliers d'URLs potentielles) ont un `head()` **bien rendu côté serveur** (SSR actif, confirmé dans le code), mais **construit uniquement à partir des `params` d'URL** (`mediaType`, `tmdbId`) — jamais du titre ou du synopsis réels. Résultat : title tag, meta description et JSON-LD strictement identiques d'une fiche à l'autre ("Série sur tvtrackd — fiche détaillée" au lieu du titre réel). C'est un problème de duplicate content on-page, mais le correctif est un ajout de `loader` de route (fetch serveur du titre/synopsis avant de construire le `head()`) — effort **faible-moyen**, pas une refonte du rendu — voir §2.

Troisième constat, revu à la baisse en effort par rapport à la v1 : le produit a déjà, en base, en composants **et déjà publiquement affichés** sur la fiche (`/_public/show/...`, sans connexion requise) les blocs qui couvrent "où regarder [série]" (`WhereToWatch`), "prochains épisodes/date de sortie" (`UpcomingSchedule`), "séries similaires à [série]" (`SimilarRail`) et casting (`CastRail`). Ces blocs ne sont **pas auth-gated** — seul l'overlay de suivi personnel (progression, compteur d'épisodes vus) l'est. Le seul problème est qu'ils sont chargés via `useQuery` **après hydratation** (pas de `loader` de route), donc absents du HTML initial généré par le serveur et invisibles pour un crawl qui ne rend pas le JS. C'est un quick win d'exposition SSR (le même correctif que ci-dessus), pas une nouvelle feature à construire.

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

Avant tout plan de contenu : ce que le crawl voit réellement aujourd'hui. Légende utilisée dans la colonne "Statut réel" : **(a)** déjà public + déjà SSR = OK, rien à faire ; **(b)** déjà public mais chargement client-only (CSR) = à passer en SSR via `loader` = quick win, pas une nouvelle feature ; **(c)** auth-gated par nature, comportement normal et voulu ; **(d)** vraie nouvelle feature/page à construire.

| # | Constat | Statut réel | Preuve | Impact SEO | Priorité | Action → qui |
|---|---|---|---|---|---|---|
| T1 | **Title/meta/JSON-LD des fiches série/film sont SSR mais génériques** — le `head()` s'exécute bien côté serveur (SSR actif), mais il est construit uniquement à partir des `params` d'URL (`mediaType`, `tmdbId`), jamais du titre/synopsis réel → title identique ("Série sur tvtrackd — fiche détaillée") pour toutes les fiches d'un même type | (b) SSR déjà actif, contenu du `head()` à corriger | `src/routes/_public/show.$mediaType.$tmdbId.tsx` l.75-119 (fonction `head()`, ne reçoit que `params`) | **Critique.** Duplicate/thin content sur le title de milliers de fiches potentielles — aucune ne peut ranker sur le nom de la série/du film | P0 | `tvtrackd-developer` : ajouter un `loader` de route qui fetch le titre/synopsis/poster côté serveur (via `get-show-details` ou lecture directe `shows`) **avant** que `head()` s'exécute, pour lui passer les données réelles. Effort **faible-moyen** (pas une refonte du rendu, juste brancher un loader existant sur un mécanisme SSR déjà en place) |
| T2 | **Contenu du body (synopsis, saisons/épisodes, casting, plateformes, similaires) chargé en CSR** après hydratation via `useQuery` → `supabase.functions.invoke("get-show-details")`, faute de `loader` de route | (b) Données publiques, chargement à passer en SSR | Aucune occurrence de `loader:`/`beforeLoad` dans les routes `_public/*` (seuls `_authenticated/route.tsx` et `admin.tsx` en ont, hors périmètre indexable) | **Élevé.** Le HTML initial ne contient pas le contenu utile — dépend du rendu JS différé de Google (indexation en deux vagues), plus lent et moins fiable qu'un SSR direct | P0 | `tvtrackd-developer` : le même `loader` que T1 doit aussi pré-fetch et hydrater `show`/`seasons`/`episodes`/casting/watch-providers/similaires côté serveur, pas seulement les champs utilisés par `head()`. C'est un seul et même chantier que T1, pas deux efforts distincts |
| T3 | **Sitemap statique de 8 URLs fixes**, aucune fiche série/film, aucune page éditoriale | (d) à construire | `src/routes/sitemap[.]xml.ts` : `ENTRIES` codé en dur | **Élevé.** Le gisement de fiches (potentiellement des milliers) n'est même pas soumis au crawl via sitemap — dépendance à la découverte organique de liens internes seule | P0 | `tvtrackd-developer` : générer un sitemap dynamique (paginé si besoin, index de sitemaps) à partir de la table `shows` (cache TMDb), en n'incluant que les fiches avec contenu suffisant (voir T6) |
| T4 | **`/calendar` n'a aucun contenu indexable pour un visiteur anonyme** — seulement un encart "Connexion requise" (confirmé, inchangé depuis la v1) | (c)/(d) mixte : le calendrier personnalisé est légitimement auth-gated ; il manque une variante publique généraliste, qui serait (d) à construire | `src/routes/_public/calendar.tsx` lignes 48-56 : branche `!user` → CTA de connexion uniquement | **Élevé.** "calendrier séries", "calendrier des sorties" sont des requêtes informationnelles à bon volume `[ESTIMATION : moyen-élevé]` que Googlebot (anonyme par définition) ne peut pas satisfaire sur cette page telle quelle | P1 | `tvtrackd-developer` + `entertainment-product-expert` : décider d'un contenu public par défaut sur `/calendar` (ex. calendrier des sorties les plus attendues toutes séries confondues, sans connexion — TMDb `airing_today`/`on_the_air`), la vue personnalisée restant réservée aux connectés |
| T5 | **Le message TV Time/Betaseries existe déjà et est public** (meta description de la home, bandeau `AnonymousHome`, carte d'onboarding), mais **dispersé** — aucune page dédiée avec URL propre, title/H1 optimisés sur les requêtes du cluster A/B | (a) contenu existant et public pour l'essentiel ; (d) reste à construire : une **landing dédiée** distincte, réutilisant ce contenu | `src/routes/_public/index.tsx` l.42-54 (meta) et l.300-365 (`AnonymousHome`, notamment l.364-365) ; `src/components/onboarding/onboarding-carousel.tsx` l.225 ; confirmé aussi par `MARKETING.md` l.3 ("il n'existe toujours pas de landing page dédiée") | **Élevé** — voir cluster A/B en §3. Le contenu n'est pas à débloquer, il est à regrouper sur une page indexable ciblée mot-clé | P0 | Contenu à co-construire `marketing-communication-expert` (réutilisation du texte déjà validé de `home`/`onboarding`, et du guide d'import de `_authenticated/import.tsx`) + brief on-page ci-dessous ; implémentation route publique → `tvtrackd-developer` |
| T6 | **Risque de thin content sur les fiches à très faible remplissage** (série TMDb avec juste titre + poster, sans overview ni providers) | (d) règle à ajouter | Cache `shows`/`seasons`/`episodes`, TTL 24-48h — aucune règle de qualité minimale avant indexation observée | Moyen | P2 | `tvtrackd-developer` : règle de `noindex` conditionnel (ou exclusion du sitemap) pour les fiches sans overview ni providers ni saisons connues |
| T7 | Pas de `hreflang` — cohérent avec un site mono-langue FR aujourd'hui | (a) non applicable pour l'instant | `__root.tsx` : `<html lang="fr">`, pas de balises alternates | Faible aujourd'hui | P3 (à revisiter si version EN) | Pas d'action immédiate — noter pour plus tard si une version anglophone est livrée |
| T8 | `robots.txt` correct (`Allow: /`) et référence bien le sitemap | (a) OK | `public/robots.txt` | — | — | Rien à faire, juste garder synchronisé avec T3 |
| T9 | Le domaine `https://tvtrackd.com` est codé en dur dans `__root.tsx` (JSON-LD, OG) et `sitemap.xml.ts` (`BASE_URL`), alors que le nom/domaine n'est pas encore arbitré | (d) à corriger (config, pas une feature) | `__root.tsx` lignes 4, 101-121 ; `sitemap[.]xml.ts` ligne 4 | Moyen — cohérent avec l'alerte transversale déjà loggée dans `ROADMAP.md` (`APP_NAME` non généralisé partout) | P1 | `tvtrackd-developer` : centraliser dans une variable de config (à côté de `APP_NAME`) ; ne pas committer d'URL finale tant que le domaine n'est pas tranché — **décision à fort impact, à présenter à l'utilisateur, pas à trancher seul** |
| T10 | `WhereToWatch` (disponibilité streaming), `UpcomingSchedule` (prochains épisodes/dates), `CastRail` (casting) et `SimilarRail` (titres similaires) sont **déjà publics** (rendus pour tout visiteur de `/_public/show/...`, sans connexion requise — seul l'overlay de suivi personnel est auth-gated) et exploitent des données réelles déjà en base (TMDb watch/providers, TMDb similar/credits) — mais chargés en CSR (même cause que T2), donc invisibles dans le HTML initial | (b) déjà construit, déjà public, juste pas encore SSR | `src/routes/_public/show.$mediaType.$tmdbId.tsx` l.561 (`NetworkLine`), l.580-584 (`UpcomingSchedule`), l.628 (`WhereToWatch`), l.872-874 (`CastRail`, `SimilarRail`) — tous en dehors des blocs conditionnés à `userShow`/`user` | Élevé — gisement de trafic gratuit (voir §4, opportunités O1-O4) déjà construit et déjà public, seule l'exposition SSR manque | P0 (même chantier que T1/T2, pas un chantier séparé) | `tvtrackd-developer` : le `loader` de route ajouté pour T1/T2 doit aussi pré-fetch watch-providers/similaires/casting/prochains épisodes, et un résumé texte serveur ("Disponible sur X, Y, Z", "Si vous avez aimé A, B, C") doit être rendu dans le HTML, pas seulement dans le drawer/carrousel interactif |

**Conséquence méthodologique** : T1, T2 et T10 sont en réalité **un seul et même chantier technique** (ajouter un `loader` de route sur la fiche pour que le SSR déjà en place dispose des vraies données, pas seulement des `params`), d'effort **faible-moyen** — nettement plus bas que ce que la v1 de cet audit laissait supposer. Ce chantier + T3 (sitemap dynamique) + T5 (landing TV Time dédiée) sont les quatre priorités P0 qui conditionnent l'efficacité de tout le reste de ce document (voir §6 Quick wins et §7 Roadmap).

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
| marquer épisode vu | "comment marquer un épisode comme vu", "compter les épisodes vus" | Informationnelle, bas de l'entonnoir produit | Faible | Élevé | Fiche série (une fois le loader SSR de T1/T2 livré) | Le compteur "façon VHS" est un vrai signe distinctif produit à documenter en FAQ/page d'aide |
| calendrier des sorties séries | "calendrier séries à venir", "quand sort le prochain épisode" | Informationnelle, usage récurrent | Moyenne (JustWatch, Betaseries, AlloCiné déjà présents) | Élevé — feature déjà livrée et bien exécutée (`UpcomingSchedule`) | `/calendar` — **bloqué par T4** | Le calendrier par série suivie + compte à rebours ("Dans 3 sem.") est déjà une bonne UX, juste invisible aux crawlers aujourd'hui |
| suivre plusieurs séries en même temps / bibliothèque séries | "organiser mes séries à voir" | Informationnelle | Faible-moyenne | Élevé | Page d'accueil/pages d'aide | Statuts à_voir/en_cours/terminé/abandonné/archivé, désarchivage qui fonctionne réellement (contrairement à Betaseries) — argument produit concret et vérifiable |

### Cluster E — Fiches série/film (longue traîne massive, une fois le loader SSR (T1/T2) et le sitemap dynamique (T3) livrés)

*Intention* : navigationnelle (nom de série précis) → informationnelle (statut, épisodes, casting). Fenêtre durable, volume cumulé potentiellement très élevé (longue traîne sur des milliers de titres) `[ESTIMATION]`.

| Mot-clé pilier (patron) | Longue traîne type | Intention | Difficulté | Alignement business | Page cible | Angle différenciant vs TMDb brut |
|---|---|---|---|---|---|---|
| "[titre série]" seul | "[titre série] saison X", "[titre série] épisode X date de sortie" | Navigationnelle | Variable par titre (faible sur les titres de niche, très élevée sur les blockbusters, dominés par AlloCiné/Wikipedia/IMDb) | Élevé sur la longue traîne cumulée | Fiche série (`/show/tv/:tmdbId`) | Statut de diffusion en direct + calendrier des prochains épisodes propre à la série + progression communautaire — pas juste le synopsis TMDb recopié |
| "[titre série] combien de saisons" | "[titre série] nombre d'épisodes" | Informationnelle | Faible-moyenne | Moyen | Fiche série | Donnée déjà en base (`seasons.episode_count`), à exposer clairement dans le H1/contenu structuré, pas seulement dans l'UI de tracking |

**Note de vigilance duplicate content (rappel §1)** : sur ce cluster, ne jamais se contenter de reproduire l'`overview` TMDb comme unique contenu — toujours l'entourer d'éléments propres à tvtrackd (statut live, calendrier, disponibilité, similaires, progression) pour constituer une page à valeur ajoutée réelle, condition pour que Google la traite comme un contenu original plutôt qu'un miroir de TMDb/thetvdb/IMDb.

---

## 4. Volet 2 — Opportunités du domaine séries non couvertes → feature associée

Pour chaque opportunité : la requête, ce qui ranke déjà (concurrence réelle observée), ce qui existe déjà côté produit vs ce qui reste à construire, l'impact/effort, et le lien backlog CLAUDE.md/ROADMAP.md quand pertinent.

**Correction importante v2** : O1, O2, O3 et O4 ci-dessous ne sont **pas des features à construire** — elles sont déjà construites et déjà publiques (page `/_public/show/...`, aucune connexion requise). Le seul manque est l'exposition SSR (même chantier que T1/T2/T10 en §2). Reclassées en conséquence.

| # | Opportunité (requêtes) | Ce qui ranke aujourd'hui `[OBSERVÉ]` | Statut réel côté produit | Aligné avec le produit actuel ? | Impact | Effort | Backlog lié |
|---|---|---|---|---|---|---|
| O1 | **"où regarder [série]"**, "[série] streaming", "[série] netflix/disney+/prime" | JustWatch (dominant), AlloCiné | **Déjà construit et déjà public** — `WhereToWatch` (l.628 de la fiche) affiche les plateformes réelles (`watch_providers`) pour tout visiteur. Il manque uniquement l'exposition SSR + un résumé texte serveur (T2/T10) | Oui, livré | Élevé | **Faible** — correction on-page/SSR pure, pas de nouvelle feature. Une page listicle par plateforme ("séries disponibles sur Netflix FR") resterait un effort M distinct si envisagée en plus | — |
| O2 | **"quand sort la saison X de [série]"**, "date de sortie saison prochaine", décompte de sortie | AlloCiné (articles ponctuels), Wikipedia, threads Reddit | **Déjà construit et déjà public** — `UpcomingSchedule` (l.580-584) affiche les prochains épisodes avec date et décompte ("Dans 3 sem.") pour tout visiteur, à partir de `episodes.air_date` déjà en base. Il manque uniquement l'exposition SSR (T2/T10) et un title/meta qui reprenne la date pour les pages où elle est pertinente | Oui, livré | Élevé | **Faible** — dépend uniquement du loader SSR (T1/T2) | — |
| O3 | **"séries similaires à [série]"**, "si vous avez aimé X regardez Y" | filmsimilaire.com, similaires.com (spécialistes de niche), SensCritique | **Déjà construit et déjà public** — `SimilarRail` (l.874, TMDb similar) pour tout visiteur. Manque l'exposition SEO (liste textuelle dans le HTML serveur, pas seulement un carrousel interactif) | Oui, livré | Moyen-élevé | **Faible** | — |
| O4 | **"casting [série]"**, "qui joue [personnage]", filmographie acteur | AlloCiné (dominant sur le casting structuré) | **Déjà construit et déjà public** — `CastRail` (l.873) sur la fiche, route dédiée `/person/$personId` pour la filmographie. Manque : titres/meta uniques par acteur (aujourd'hui `person.$personId.tsx` a un title générique "Filmographie — [nom de marque]", pas le nom de l'acteur) + SSR des crédits (même famille de correctif que T1/T2) | Oui, livré | Moyen | **Faible** — même chantier que T1, appliqué à `person.$personId.tsx` | — |
| O5 | **"meilleures séries 2026"**, "séries à voir en ce moment", listicles éditoriaux | AlloCiné, SensCritique, Buzzwebzine, sites éditoriaux généralistes | **Nouvelle feature éditoriale** : pages "Top séries du moment" générées semi-automatiquement (tendances TMDb déjà consommées côté `useTrending`/`DiscoverySection`) + angle rédactionnel (pas un pur agrégat automatique — sinon thin content face à des rédactions qui argumentent) | Partiel (la donnée tendance existe, l'habillage éditorial non) | Moyen | Moyen — nécessite du contenu rédigé, pas juste un flux de données | Coordination `marketing-communication-expert` (calendrier éditorial), pas dans `ROADMAP.md` actuel — à arbitrer avec `entertainment-product-expert` |
| O6 | **"explication de la fin de [série]"**, résumé d'épisode commenté, analyse | AlloCiné (très fort sur ce créneau, contenu rédactionnel dédié par série à succès) | **Nouvelle feature éditoriale lourde** : articles d'analyse par série/saison — hors périmètre actuel du produit (pas dans `CLAUDE.md`/`ROADMAP.md`), proche du terrain "reviews/social" (`ROADMAP.md` #24, phase 2 explicite) | Non — nécessite un vrai pôle rédactionnel, gourmand en effort récurrent | Élevé si exécuté, mais... | Élevé (contenu récurrent, éditorial, non automatisable sans risque qualité) | À arbitrer avec `entertainment-product-expert` : concurrence directe avec AlloCiné sur son terrain le plus fort, alignement discutable avec la thèse "on n'affronte pas frontalement" du CLAUDE.md — recommandation : ne pas prioriser avant le socle tracker/fiches |
| O7 | **Moteur de recommandation personnalisé** ("meilleure appli pour recommandations séries", trafic indirect via bouche-à-oreille/avis plutôt que SEO direct) | Betaseries (bot cassé, cf. CLAUDE.md), Trakt (API) | `ROADMAP.md` #15 : moteur de reco v1 (genres/équipe TMDb) — impact SEO indirect (avis, bouche-à-oreille, réduction du churn) plus que mots-clés directs | Backlog déjà identifié | Élevé (différenciation produit) mais impact SEO indirect | M (déjà scopé backlog) | `ROADMAP.md` #15 |
| O8 | **"importer trakt"**, "connecter mon compte trakt" | Peu de contenu FR dédié | `ROADMAP.md`/`CLAUDE.md` backlog : import "connecter mon compte Trakt" (OAuth2) — capte un public de niche mais qualifié (power users Trakt francophones) | Backlog déjà identifié, priorité "selon demande" | Faible-moyen (niche) | L | `ROADMAP.md` #25, `CLAUDE.md` backlog |
| O9 | **Scrobbling automatique streaming** ("tracker automatique netflix", équivalent Simkl) | Simkl (dominant sur ce terrain) | `ROADMAP.md` #26 — techniquement lourd, hors scope court terme confirmé | Backlog déjà identifié, explicitement différé | Élevé si exécuté, mais... | L, risque technique élevé | `ROADMAP.md` #26 |
| O10 | **Reviews/notes par épisode**, "avis sur [série]", profils publics partageables | SensCritique (dominant sur les avis structurés) | `ROADMAP.md` #24 (reviews) et #16 (profil public `/u/pseudo`) — chaque profil public opt-in et chaque review publique deviendrait une page indexable additionnelle (UGC public, jamais de bibliothèque privée) | Backlog déjà identifié, phase 2 explicite | Moyen-élevé à terme (UGC = volume de pages qui grandit avec la communauté) | M/L | `ROADMAP.md` #16, #24 |
| O11 | **"tv time alternative" en anglais** (francophones qui tapent en anglais, Belgique/Suisse/Québec inclus) | Kino (kino-tv.co, bilingue), Moviebase, alternativeto.net | Pas une nouvelle feature — un **contenu bilingue léger** (une version EN de la landing alternative, cf. cluster A/B), sans complexifier l'architecture `hreflang` tant qu'il n'y a pas de vraie version produit EN | Alignement partiel — CLAUDE.md priorise le FR d'abord | Moyen | Faible (une page, pas une traduction complète du produit) | Coordination `marketing-communication-expert` |

**Lecture rapide impact/effort** :
- **Impact élevé / effort faible** (à faire en premier, aucune nouvelle feature) : O1, O2, O3, O4 — tout est déjà construit et déjà public, il s'agit uniquement du chantier SSR unique T1/T2/T10.
- **Impact moyen / effort faible-moyen** : O11 (contenu bilingue léger).
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
| E — Fiches série/film | Navigationnelle | Variable, cumul élevé | Élevé | **P0 techniquement (loader SSR T1/T2 + sitemap T3), P1 en volume de fiches enrichies** |
| O1/O2/O3/O4 (où regarder, dates, similaires, casting — déjà construits et publics) | Info/transactionnelle/navigationnelle | Moyenne | Élevé | **P0 — même chantier SSR que T1/T2, effort faible, pas de nouvelle feature** |
| D — Usage tracker générique | Navigationnelle/info | Élevée (Betaseries a la marque) | Élevé | **P2 — continu, evergreen** |
| O5 (listicles éditoriaux) | Info | Élevée (AlloCiné/SensCritique) | Moyen | **P2, à cadencer avec le calendrier éditorial marketing** |
| O6 (explication de fin) | Info | Très élevée (terrain fort AlloCiné) | À arbitrer | **P3 — ne pas engager sans décision produit explicite** |
| O11 (contenu bilingue léger) | Comparative | Faible-moyenne | Moyen | **P2** |

---

## 6. Quick wins — fenêtre TV Time (à traiter en premier, effort limité)

1. **Ajouter le `loader` de route sur la fiche série/film** (T1/T2/T10 réunis en un seul chantier) : fetch serveur du titre/synopsis/casting/plateformes/similaires/prochains épisodes, pour que (a) le `head()` déjà SSR reflète les vraies données au lieu des `params` d'URL, et (b) le contenu du body (déjà public, déjà construit — `WhereToWatch`, `UpcomingSchedule`, `CastRail`, `SimilarRail`) soit présent dans le HTML initial. C'est le quick win n°1 : effort faible-moyen, aucune nouvelle feature, et il débloque à lui seul les clusters E, O1, O2, O3, O4.
2. **Créer une landing publique dédiée "TV Time ferme — récupérez vos données"** avec URL et title propres, en réutilisant le contenu déjà écrit et déjà public (meta de la home, bandeau `AnonymousHome`, carte d'onboarding, guide détaillé de `_authenticated/import.tsx`). Le texte existe déjà à 90 % — l'effort est de le regrouper sur une page indexable ciblée mot-clé, pas de le "dégater".
3. **Étendre `sitemap.xml` dynamiquement** (T3) une fois le loader (1) en place — sinon les fiches corrigées ne sont même pas soumises au crawl.
4. **Rendre `/calendar` partiellement public** (T4) — un calendrier des sorties généraliste sans connexion capte une requête à volume estimé moyen-élevé, aujourd'hui à zéro contenu pour un visiteur anonyme.
5. **Appliquer le même correctif de loader aux fiches personnes** (`person.$personId.tsx`, cluster O4) — title/meta uniques par acteur au lieu du générique "Filmographie — [nom de marque]".

---

## 7. Roadmap séquencée (qui fait quoi)

### Phase 0 — Fondations techniques (bloquant, avant tout effet mesurable ; effort réel faible-moyen, pas une refonte)
- `tvtrackd-developer` : un seul chantier — ajouter le `loader` de route sur la fiche série/film (couvre T1, T2, T10, et le même correctif appliqué à `person.$personId.tsx` pour O4) ; T3 (sitemap dynamique) ; T9 (variable de config pour domaine/nom, pas de valeur en dur).
- Coordination : le choix du domaine final (`.fr` vs autre) est une **décision à fort impact** — présentée à l'utilisateur, jamais tranchée par cet agent seul.

### Phase 1 — Landing dédiée fenêtre TV Time (contenu déjà écrit et déjà public, à regrouper)
- `marketing-communication-expert` + agent SEO : brief on-page et copy pour la landing "Alternative à TV Time" (cluster A/B), en réutilisant le texte déjà public de la home/onboarding et le guide détaillé de `import.tsx`.
- `tvtrackd-developer` : route publique dédiée, canonical, OG, JSON-LD `WebPage`/`FAQPage` si structure Q/R.
- `entertainment-design-expert` : habillage visuel cohérent "vidéo-club nocturne" (pas un simple mur de texte).

### Phase 2 — Vérification de l'exposition SEO des features déjà construites (O1/O2/O3/O4)
- `tvtrackd-developer` : une fois la Phase 0 livrée, vérifier que les résumés texte (disponibilité streaming, calendrier de sortie par série, titres similaires, pages personnes) sont bien présents dans le HTML serveur, pas seulement dans l'UI interactive.
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
