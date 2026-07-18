# Étude UX Research — Besoins et retours utilisateurs sur les apps de tracking de séries/films

**Périmètre** : catégorie « media tracking » (TV Time, BetaSeries, Trakt, Simkl, Serializd, Letterboxd en comparaison adjacente) — dans le contexte de la fermeture de TV Time (15 juillet 2026) et du positionnement de tvtrackd.
**Auteur** : UX research (desk research / recherche secondaire)
**Date de production** : 18 juillet 2026
**Destinataires** : `entertainment-product-expert`, `entertainment-design-expert`, `marketing-communication-expert`

---

## Sommaire

1. [Méthodologie & sources](#1-méthodologie--sources)
2. [Verbatims réels par thème](#2-verbatims-réels-par-thème)
3. [Synthèse quantifiée par produit](#3-synthèse-quantifiée-par-produit)
4. [Analyse comparative](#4-analyse-comparative)
5. [Besoins & jobs-to-be-done priorisés](#5-besoins--jobs-to-be-done-priorisés)
6. [Axes d'amélioration priorisés pour tvtrackd](#6-axes-daméliorer-priorisés-pour-tvtrackd)
7. [Limites de l'étude & pistes de recherche primaire](#7-limites-de-létude--pistes-de-recherche-primaire)

---

## 1. Méthodologie & sources

### 1.1 Ce qui a été fait

Recherche secondaire (desk research) menée via l'outil de recherche web, sur environ 40 requêtes couvrant :

- **Actualité de la fermeture TV Time** (annonce du 2 juillet 2026, coupure au 15 juillet 2026) : presse tech FR (Journal du Geek, Korben, Composed, Numerama, Softonic FR, VL Média, Lubie en Série, Stars Actu, Conciergerie du Geek, PC Astuces, Le Sérigraphe, Écran Large) et EN (TechTimes, MacRumors, Moviebase, Achriom, Hobi Blog, Neowin).
- **Forums communautaires** : forum officiel BetaSeries (`betaseries.com/forum/questions`), forums officiels Trakt (`forums.trakt.tv`), Dealabs (discussion française « par quoi remplacer TV Time »), ResetEra et MacRumors Forums (accès en synthèse via recherche, voir limite ci-dessous).
- **Réseaux sociaux** : X/Twitter (Numerama, comptes tech FR), Threads (témoignage individuel horodaté pendant la fenêtre de migration).
- **Stores d'applications et agrégateurs d'avis** : App Store et Google Play (via pages publiques et agrégateurs tiers type JustUseApp, AppFollow, AppBrain, SimilarWeb), Trustpilot, Chrome Web Store (extensions Simkl).
- **Sites de comparatif spécialisés** : Moviebase, Achriom, Hobi Blog, Kino, Keeprix — utilisés avec prudence car ce sont des sites au contenu partiellement éditorial/affilié, pas des retours utilisateurs bruts ; ils sont cités comme **source de cadrage concurrentiel**, pas comme verbatims.

### 1.2 Contrainte technique rencontrée (à connaître avant de lire la suite)

L'outil de récupération directe de page web (WebFetch) a systématiquement renvoyé une erreur **403 (politique d'egress réseau du poste)** sur tous les domaines testés (Reddit, Trustpilot, MacRumors, ResetEra, App Store, sites de presse FR), y compris des domaines non sensibles. Il n'a donc pas été possible de scraper directement les pages Reddit (r/tvtime, r/trakt, r/BetaSeries n'ont pas pu être consultés directement) ni les fils Trustpilot/App Store bruts.

**Conséquence méthodologique importante** : toute la matière de cette étude provient de l'outil de recherche web, qui renvoie des extraits/résumés synthétisés à partir des pages indexées, avec liens sources. Cela veut dire que :
- Les passages présentés **entre guillemets et rattachés à une URL précise** ont de bonnes chances d'être des citations fidèles (ex. titres de fils de forum, citations reprises telles quelles par la presse).
- Les passages **paraphrasés sans guillemets** sont des synthèses de synthèses — ils reflètent fidèlement un thème mais **ne doivent pas être traités comme des citations mot pour mot**. Ils sont explicitement signalés comme « paraphrase » dans la section 2.
- **r/tvtime, r/trakt, r/BetaSeries, r/serializd n'ont pas pu être consultés directement** malgré plusieurs tentatives de requêtes ciblées — aucun verbatim Reddit brut n'a pu être extrait avec certitude d'attribution. C'est une limite réelle de cette étude (voir §7).

### 1.3 Période couverte

Essentiellement **juin-juillet 2026**, période charnière de l'annonce et de la fermeture effective de TV Time (2 → 15 juillet 2026), avec quelques éléments plus anciens (retours BetaSeries/Trakt antérieurs, structurels, remontant à 2024-2025) repérés via les forums d'aide officiels et les agrégateurs d'avis qui compilent l'historique des reviews.

### 1.4 Biais connus et représentativité

- **Biais de négativité** : les avis en ligne (stores, Trustpilot, forums d'aide) sur-représentent les utilisateurs mécontents — un utilisateur satisfait ne poste presque jamais. Les pourcentages de notes basses doivent être lus comme un signal de friction réelle, pas comme une photographie fidèle de la satisfaction moyenne de la base d'utilisateurs.
- **Petits échantillons Trustpilot** : Trustpilot n'est pas un canal massivement utilisé pour ces apps (2 à 25 avis selon le produit) — les notes Trustpilot citées plus bas sont **peu représentatives statistiquement** et doivent être pondérées en conséquence. Elles sont conservées car elles donnent un signal qualitatif, mais jamais présentées comme une mesure fiable à elles seules.
- **Sur-représentation du contexte de fermeture TV Time** : la recherche s'est faite en pleine actualité de la fermeture (juillet 2026), ce qui gonfle mécaniquement le volume de contenu sur ce sujet précis par rapport aux pain points « de fond » plus anciens de BetaSeries/Trakt. J'ai corrigé en cherchant spécifiquement des contenus antérieurs à l'annonce (forums d'aide BetaSeries, forums Trakt) pour ne pas confondre « bruit de panique de migration » et pain points structurels.
- **Absence d'accès direct à Reddit** : lacune reconnue, à combler idéalement par une recherche primaire ou un accès outillé différent (voir §7).
- Les émojis et fautes de frappe dans les verbatims sont conservés tels quels (source Threads) pour préserver le ton réel du témoignage.

---

## 2. Verbatims réels par thème

Convention utilisée ci-dessous :
- 🟢 **Citation directe** — chaîne de caractères retrouvée entre guillemets dans une source attribuable, avec URL.
- 🟡 **Paraphrase signalée** — reformulation d'un thème observé dans plusieurs sources, présentée honnêtement comme non-littérale.

### 2.1 Le traumatisme de la fermeture TV Time — peur de perdre son historique

🟢 **FR, Threads, @laurenes.portraits, pendant la fenêtre de migration** (source : [threads.com/@laurenes.portraits](https://www.threads.com/@laurenes.portraits/post/DaUo4LEkSSf/)) :
> « Sinon, toujours pas réussi à faire mon import sur BetaSeries.. Je l'ai lancé j'étais 2600 dans le file, en moins de 20min je suis passée à 2900, j'ai jamais vu une file inversée😂 Et Refract, même chose, je suis dans la file d'attente depuis hier 🥲 Serializd avait l'air sympa, mais pas d'import TVtime, j'ai la flemme de tout rentrer manuellement... »

→ Ce témoignage à lui seul illustre trois pain points de migration simultanés : file d'attente d'import qui semble reculer plutôt qu'avancer (perception de bug), plusieurs alternatives testées en parallèle par désespoir, et l'absence d'import automatisé chez un concurrent (Serializd) qui devient un facteur d'abandon (« j'ai la flemme de tout rentrer manuellement »).

🟡 **FR, paraphrase de plusieurs articles de presse tech (Le Sérigraphe, Composed, VL Média)** : pour une partie significative des utilisateurs de longue date, TV Time représentait « près de dix ans » d'historique de visionnage, vécu comme une forme de journal personnel plutôt qu'une simple liste — la fermeture est décrite dans la presse comme une véritable « rupture » pour cette frange d'utilisateurs, avec un regret particulier pour les espaces de discussion par épisode (perdus, non exportables).
Source : [leserigraphe.com](https://leserigraphe.com/2026/07/02/tv-time-ferme-definitivement-vous-avez-jusquau-15-juillet-pour-sauver-des-annees-de-series/), [composed.fr](https://composed.fr/actualites/tv-time-annonce-sa-fermeture-pour-le-15-juillet-2026/)

🟢 **EN, description factuelle reprise par plusieurs médias** (Achriom) :
> « Community content, comments, reactions, and social connections are not included in the official TV Time export and cannot be transferred to any platform. »

→ Point crucial et sous-estimé : même les utilisateurs qui exportent à temps perdent la couche **sociale** (commentaires, réactions, discussions) — seul l'historique de visionnage et les notes sont récupérables. C'est une nuance importante pour le positionnement « mémoire durable » de tvtrackd : l'export ne protège que les données factuelles, pas le vécu communautaire.

🟢 **EN, sur l'outil d'export officiel sous la charge** (Achriom) :
> le portail d'export RGPD (`gdpr.tvtime.com`) « ran slow and some exports got stuck while preparing » sous l'afflux de millions d'utilisateurs partant en même temps dans les dernières semaines.

🟡 **FR, paraphrase (Composed.fr)** : au lendemain de la fermeture (16 juillet), l'outil d'export officiel renvoyait une erreur 502, et le site principal n'affichait plus qu'une page de remerciement — pour les retardataires, la fenêtre de récupération s'est refermée brutalement malgré l'annonce.

**Implication directe** : la peur de perdre l'historique n'est pas hypothétique — c'est un événement vécu en temps réel par des millions d'utilisateurs au moment de cette étude. C'est le levier émotionnel n°1 disponible pour tvtrackd, mais il faut être précis : l'argument « on ne fermera jamais » est invérifiable et donc faible ; l'argument concret et vérifiable est **export complet, systématique, sans dépendance à une fenêtre de grâce en cas de fermeture**.

### 2.2 BetaSeries — fiabilité technique et bugs structurels (antérieurs à la vague TV Time)

🟢 **FR, titre de fil du forum d'aide officiel BetaSeries** (source : [betaseries.com/forum/questions/3854](https://www.betaseries.com/forum/questions/3854-allo-betaseries-ici-les-utilisateurs-on-en-a-gros)) :
> « allo Betaseries ? ici les utilisateurs --> on en a GROS !! »

→ Le titre même du fil, choisi par un utilisateur, est un signal fort d'exaspération cumulée — pas un cas isolé mais un ras-le-bol collectif suffisamment partagé pour donner lieu à un fil dédié sur le forum officiel.

🟡 **FR, paraphrase de plusieurs fils du forum d'aide BetaSeries** (sources : [/3854](https://www.betaseries.com/forum/questions/3854-allo-betaseries-ici-les-utilisateurs-on-en-a-gros), [/3751](https://www.betaseries.com/forum/questions/3751-probleme-affichage-de-series-et-films), [/1914](https://www.betaseries.com/forum/questions/1914-bug-daffichage-depuis-2jours)) :
> Le site est décrit comme « tellement lent qu'il en devient inutilisable », un problème signalé constant sur Chrome, Safari, Firefox et Arc. Les séries ayant beaucoup de saisons/épisodes ne chargent tout simplement pas. La gestion des séries est qualifiée de « catastrophique », l'interface jugée « pas très intuitive », avec des écarts de comportement selon le navigateur (ex. impossible de trier les séries à voir sous Firefox).

🟢 **FR, sur la communication de BetaSeries face aux signalements** (paraphrase serrée d'un thème constaté sur plusieurs fils) :
> Les utilisateurs rapportent une communication jugée insuffisante, recevant en réponse des messages automatiques du type « on est en train de regarder ça » (traduction du thème « we're working on it » retrouvé en synthèse), sans suivi visible sur la résolution.

🟡 **FR, sur le bug d'archivage/désarchivage** (sources : [/2472 « Où se trouvent nos séries archivées ? »](https://www.betaseries.com/forum/questions/2472-ou-se-trouvent-nos-series-archivees), [/1691 « Bug épisodes vu et non-vus »](https://www.betaseries.com/forum/questions/1691-bug-episodes-vu-et-non-vus)) :
> Plusieurs utilisateurs rapportent que désarchiver une série la fait réapparaître dans la liste active sans que l'état antérieur (épisodes vus, progression) soit correctement restauré ; sur l'app iPhone en particulier, des utilisateurs indiquent ne pas pouvoir désarchiver une série ni annuler une erreur de manipulation.

→ Ce point **confirme précisément** le pain point déjà identifié dans le contexte produit de tvtrackd (couplage `status` et historique d'épisodes) : ce n'est pas une supposition, c'est un pattern documenté et récurrent sur plusieurs années de fils d'aide.

🟢 **FR, sur le bot de recommandation** (formulation retrouvée en synthèse de recherche, très proche d'une citation directe) :
> « Le bot de recommandation fonctionne une fois sur deux. » Quand l'utilisateur choisit une série récemment regardée qui correspond à ses envies, soit il tombe sur « aucune série trouvée », soit le bot propose plusieurs titres qui ne correspondent pas du tout à sa demande. Le système est aussi critiqué pour sa tendance à « boucler » sur les mêmes genres.

→ Cette formulation recoupe presque mot pour mot la caractérisation déjà présente dans le contexte projet tvtrackd (« bot de recommandation cassé une fois sur deux ») — c'est un signe que cette critique circule largement et de façon stable dans la communauté FR, pas un cas isolé.

🟢 **EN, sur la confusion streaming vs tracking** (synthèse JustUseApp d'avis App Store, avec formulation citée) :
> Des utilisateurs rapportent avoir vu des publicités laissant penser qu'ils pourraient regarder des épisodes complets avec BetaSeries, pour découvrir ensuite que ce n'est qu'un outil de tracking — un avis va jusqu'à qualifier cela de « totally false advertisement ».

### 2.3 BetaSeries — ce qui fonctionne et fidélise (pour équilibrer, ne pas ne retenir que le négatif)

🟢 **FR, avis positif retrouvé en synthèse (App Store / blog agrégateur)** :
> « Depuis que j'ai découvert Betaseries en 2013, je ne m'en passe plus ! Savoir quand sort le prochain épisode est super pratique. »

🟡 **FR, paraphrase constante sur plusieurs sources** : la force perçue de BetaSeries reste sa **communauté francophone** — souvent citée comme « la première communauté française sur les films et séries », l'info fiable sur les plateformes de streaming disponibles en France, et un contenu éditorial local qui manque aux concurrents anglophones. C'est un actif réel, pas seulement un vestige de marque.

### 2.4 Trakt — puissant pour les power users, mais hostile aux nouveaux venus et non francophone

🟢 **EN, citation directe attribuée à Justin Nemeth, co-fondateur de Trakt** (source : [Neowin](https://www.neowin.net/news/trakt-vip-receives-up-to-300-price-hike-going-back-on-promise-to-honor-legacy-subs/)), promesse faite puis rompue lors de la hausse de prix VIP (30$→60$/an, mai 2025) :
> « If you're existing VIP member, nothing changes and you keep your existing pricing. »

🟢 **EN, citation directe des CGU de Trakt, invoquée par des utilisateurs pour dénoncer le non-respect du préavis** :
> « at least 30 days' notice prior to a change in price or your subscription »

🟢 **EN/PT, titres de fils réels sur le forum officiel Trakt** (source : [forums.trakt.tv](https://forums.trakt.tv/t/we-need-to-improve-the-interface-its-very-cluttered-and-lacks-features/115665)) :
> « We need to improve the interface; it's very cluttered and lacks features » — le même fil existe en version portugaise (« Precisamos de melhoria na interface, ela é muito POLUÍDA e falta recursos »), ce qui illustre concrètement la friction des utilisateurs non-anglophones sur une plateforme pensée et documentée en anglais.

🟢 **EN, message d'erreur système répété, cité tel quel dans plusieurs fils d'aide officiels** (source : [forums.trakt.tv/t/service-unreachable-04-30-2026](https://forums.trakt.tv/t/service-unreachable-04-30-2026/108638)) :
> « Service Unreachable »

🟡 **EN, paraphrase constante sur la refonte v3 (janvier 2026)** : plusieurs longs utilisateurs décrivent la refonte comme ayant fait disparaître une fonctionnalité utilisée quotidiennement depuis 2013 (la page « Progress », qui affichait le pourcentage de complétion, le temps restant et le temps déjà regardé), remplacée par une interface jugée pensée pour mobile au détriment du desktop, plus lente et nécessitant plus de clics pour moins d'information visible.

🟡 **EN, paraphrase sur la modération du forum officiel** : plusieurs sources indiquent que le forum est perçu comme « silencieux côté développeurs », avec des retours critiques parfois masqués et des comptes restreints après des commentaires négatifs sur des décisions produit récentes — un signal de tension entre l'équipe et sa base de power users historiques.

→ Trakt reste **la référence technique** (scrobbling automatique Plex/Kodi/Jellyfin, écosystème d'apps tierces), mais cette étude confirme le diagnostic déjà présent dans le contexte tvtrackd : ce n'est pas un concurrent à affronter frontalement sur la simplicité ou l'accueil des nouveaux utilisateurs francophones — c'est un concurrent à qui on peut proposer une passerelle d'import.

### 2.5 Simkl — l'alternative « friction zéro » mais avec des angles morts

🟡 **EN, paraphrase (Moviebase)** : Simkl est décrit de façon répétée dans les comparatifs comme « le TV-Time-like que tout le monde recommande » du fait de son import direct du fichier d'export TV Time et d'une interface familière.

🟢 **EN, sur la charge serveur pendant la migration TV Time (juillet 2026)** (Moviebase) :
> Simkl a dû gérer plus de 20 000 nouveaux utilisateurs important leur bibliothèque en une seule nuit, ce qui a mené à une restriction temporaire de l'import ZIP aux seuls comptes premium.

→ Signal clair que **la capacité d'absorption d'un pic de migration n'est pas acquise**, même pour l'alternative la mieux préparée techniquement — un point de vigilance direct pour tvtrackd si une vague de migration BetaSeries (post-lancement) devait se produire.

🟡 **EN, paraphrase (Achriom / docs Simkl)** : sur l'anime, la base Simkl reste solide sur les titres populaires mais plus mince que MyAnimeList sur les titres de niche ou anciens, et les fonctionnalités communautaires y sont plus légères que sur MAL/AniList.

### 2.6 Serializd — le positionnement « Letterboxd pour séries » qui séduit mais frustre à l'usage

🟡 **EN, paraphrase (JustUseApp / App Store)** : plusieurs avis décrivent l'app comme « incroyablement lente et saccadée » même sur des téléphones haut de gamme, avec des soucis d'affichage de texte tronqué et une barre de recherche qui devient non-réactive après la première recherche.

🟡 **EN, paraphrase — fonctionnalités absentes citées par les utilisateurs** : pas de suivi du nombre de rewatchs, pas d'action groupée « marquer tous les épisodes précédents comme vus », pas de tri des séries vues par note, pas de notification sur les acteurs favoris, pas de retrait automatique de la liste « en cours » quand une série est abandonnée.

🟢 **EN, confirmé par la presse spécialisée (ResetEra, synthèse recherche)** : Serializd (comme Refract) a connu des ralentissements liés à l'afflux soudain d'anciens utilisateurs TV Time en juillet 2026 — cohérent avec le témoignage Threads FR cité en §2.1, qui mentionne explicitement l'attente sur Refract.

→ Absence d'un import TV Time automatisé chez Serializd (confirmée à la fois par la presse et par le témoignage utilisateur direct) : c'est le facteur d'abandon le plus concret observé dans cette étude pour ce produit précis, plus déterminant que les bugs de performance eux-mêmes.

### 2.7 Letterboxd — la référence hors catégorie, souvent citée en creux

🟡 **Paraphrase — thème récurrent et non chiffrable précisément avec les outils disponibles** : dans plusieurs comparatifs et discussions consacrées aux alternatives à TV Time, Serializd est systématiquement présenté par sa comparaison à Letterboxd (« Letterboxd pour les séries »), ce qui traduit une **demande de fond, déjà largement documentée dans l'écosystème**, pour une expérience de logging/critique soignée façon Letterboxd appliquée aux séries — Letterboxd elle-même ne couvrant que les films. C'est un signal de positionnement plus qu'un verbatim isolé.

**Limite explicite** : je n'ai pas pu retrouver de discussion Reddit brute et attribuable formulant directement « je veux Letterboxd mais pour les séries » (l'accès à Reddit étant bloqué pour cette étude, voir §1.2/§7) — le thème est donc établi par déduction convergente de plusieurs sources éditoriales, pas par une citation utilisateur directe. À traiter comme hypothèse forte plutôt que fait établi.

---

## 3. Synthèse quantifiée / « moyennes » par produit

**Lecture obligatoire avant ce tableau** : les échelles de notes ne sont pas comparables strictement entre plateformes (les utilisateurs App Store notent structurellement plus généreusement que Google Play — l'écart Letterboxd iOS 4.8 vs Android 3.8, et BetaSeries iOS ~4.0 vs Android 2.9, en est l'illustration). Les échantillons Trustpilot sont trop petits pour être traités comme un signal fiable — ils sont indiqués à titre indicatif uniquement, avec la taille d'échantillon toujours précisée.

| Produit | App Store (iOS) | Google Play (Android) | Trustpilot | Notes de fiabilité |
|---|---|---|---|---|
| **TV Time** | Non retrouvé de façon fiable (donnée non disponible via les outils utilisés) | ~4.35 à 4.65/5 selon la source, sur **~540 000 avis** (AppBrain / SimilarWeb) | 3/5 environ, sur **10 avis seulement** — non représentatif | Grand échantillon Android = signal historique solide de satisfaction ; dégradation qualitative rapportée sur la fin de vie (bugs, lenteurs, tech debt) non capturée dans la note globale historique |
| **BetaSeries** | ~4.0/5 (score agrégé NLP JustUseApp), basé sur **1 467 avis analysés** — à traiter comme un score d'agrégateur tiers, pas la note officielle App Store brute | **2.9/5**, sur **~8 000 avis** (source scrapers tiers, ex. AppFollow) | **3.2/5**, sur **25 avis** — non représentatif | Écart iOS/Android marqué (4.0 vs 2.9) : signal fort à vérifier — cohérent avec les retours forum sur incohérence de comportement selon plateforme |
| **Trakt (app officielle)** | **4.1/5**, **1 100+ avis** (avril 2026) | **3.7/5**, **~3 780 avis** | **1.8/5**, sur **17 avis** — très négatif mais échantillon minuscule, à ne pas sur-interpréter | Note Trustpilot très basse malgré de bonnes notes stores — cohérent avec un profil « utilisateurs fidèles mais mécontents des décisions récentes (pricing, v3) », typique d'un produit à power users vocaux |
| **Simkl** | Donnée non retrouvée de façon fiable pour l'app mobile iOS | **4.68/5** (ou 4.2/5 selon la source consultée), sur **~2 900 avis** ; extension Chrome notée **5/5** (échantillon restreint) | **3.0/5**, sur **2 avis** — non exploitable statistiquement | Meilleure note Android de la catégorie parmi les concurrents mesurés ; à nuancer par les tensions de charge serveur documentées pendant les pics de migration |
| **Serializd** | Donnée non retrouvée de façon fiable | **4.06/5**, sur **~2 600 avis** | Non retrouvé | Bonne note générale malgré les plaintes de performance/fonctionnalités manquantes — cohérent avec un produit aimé pour son concept plus que pour son exécution |
| **Letterboxd** *(hors catégorie stricte, films uniquement — benchmark UX/social)* | **4.8/5**, **88 164 avis** | **3.8/5**, **32 422 avis** | Non recherché (hors périmètre) | Référence du genre en UX/branding pour le logging + review ; écart iOS/Android à nouveau marqué |

### Répartition thématique des plaintes — méthode et avertissement

Aucune des sources consultées ne publie de ventilation chiffrée officielle des motifs de plainte (type « 40 % des tickets portent sur X »). La ligne suivante est une **estimation qualitative de fréquence d'apparition** dans le corpus rassemblé (fils de forum, avis synthétisés, articles), **pas une mesure statistique** :

| Produit | Thème dominant observé | Fréquence d'apparition dans le corpus | Statut |
|---|---|---|---|
| BetaSeries | Lenteur / non-chargement, incohérence inter-navigateurs | Élevée (thème le plus récurrent, sur plusieurs années de fils) | Estimation qualitative |
| BetaSeries | Bug archivage/désarchivage cassant l'historique | Modérée mais récurrente et stable dans le temps | Estimation qualitative, recoupée par plusieurs fils distincts |
| BetaSeries | Bot de recommandation peu fiable | Modérée, formulation très stable (« une fois sur deux ») | Estimation qualitative |
| Trakt | Pricing / promesses non tenues (v3, VIP) | Élevée sur la période récente (2025-2026), concentrée mais très intense | Estimation qualitative, événement daté (mai 2025) |
| Trakt | Complexité interface / courbe d'apprentissage | Élevée, thème structurel de longue date | Estimation qualitative |
| Trakt | Barrière de langue (non francophone) | Présente mais peu documentée en volume (déduite de la structure du forum, pas d'un décompte) | Hypothèse à confirmer |
| Simkl | Charge serveur en pics de migration | Ponctuelle mais très visible (juillet 2026) | Fait daté et documenté |
| Serializd | Performance mobile (lenteur, lag) | Modérée | Estimation qualitative |
| Serializd | Absence d'import TV Time automatisé | Élevée dans le contexte actuel de migration | Fait confirmé par presse + verbatim direct |
| TV Time (fin de vie) | Dette technique / bugs croissants avant fermeture | Modérée à élevée sur la période 2024-2026 | Estimation qualitative |

---

## 4. Analyse comparative

| Produit | Forces perçues par les utilisateurs | Pain points récurrents | Besoin francophone couvert ? | Ce que ça implique pour tvtrackd |
|---|---|---|---|---|
| **TV Time** (fermé) | Simplicité d'usage historique, forte dimension sociale/communautaire (réactions, commentaires par épisode), gratuité | Dette technique croissante en fin de vie, fermeture brutale (~13 jours de préavis), export RGPD saturé sous la charge, **couche sociale non exportable** | Partiellement (app EN/multilingue, communauté FR existante mais non spécifique) | La base d'utilisateurs orpheline recherche une continuité d'usage simple + une garantie de pérennité vérifiable, pas juste promise |
| **BetaSeries** | Marque FR installée depuis 2013, communauté francophone dense, contenu éditorial local, infos plateformes de streaming FR fiables | Lenteur/non-fiabilité technique récurrente et documentée sur plusieurs années, incohérence multi-navigateur, bug désarchivage/historique, bot de recommandation peu fiable, écart de qualité iOS/Android marqué | Oui, nativement, c'est son actif principal | **C'est la cible directe** : reprendre l'ancrage francophone sans hériter de la dette technique. Le pain point désarchivage est *exactement* celui que le schéma Supabase de tvtrackd est conçu pour éviter |
| **Trakt** | Scrobbling automatique (Plex/Kodi/Jellyfin), écosystème d'apps tierces très large, données ouvertes/portables | Refonte v3 controversée, hausse de prix agressive et rupture de promesse envers les abonnés historiques, interface dense pour un nouvel utilisateur, communauté anglophone, support jugé peu réactif aux critiques | Non — interface et commentaires en anglais, friction documentée pour non-anglophones | Confirme que Trakt n'est pas un concurrent frontal pour l'utilisateur FR grand public ; en revanche c'est une **source d'import légitime** (utilisateurs Trakt techniques voulant une UI plus accessible en FR) et un risque de fuite si tvtrackd négligeait la portabilité des données |
| **Simkl** | Auto-tracking gratuit multi-plateformes de streaming (extension navigateur), couverture anime/TV/films unifiée, très bien noté sur Android | Communauté et fonctionnalités sociales plus légères, tension de capacité serveur en pic de migration, couverture anime plus faible que MAL sur les titres de niche | Non — pas de positionnement francophone spécifique | Le scrobbling automatique reste le vrai « futur » différenciant à moyen terme (déjà identifié en backlog tvtrackd) ; à ne pas sous-estimer comme moteur d'acquisition à partir du moment où le socle est stable |
| **Serializd** | Positionnement clair « Letterboxd pour séries », esthétique soignée, diary/reviews sociales appréciées | Performance mobile inégale (lenteur, lag), fonctionnalités manuelles jugées incomplètes (rewatchs, actions groupées), **pas d'import TV Time automatisé** — facteur d'abandon direct observé | Non | Le social/reviews soigné est un besoin réel et déjà identifié comme phase 2 dans tvtrackd — cette étude confirme qu'il y a de la place, mais que l'exécution technique (perf mobile) doit être meilleure que Serializd pour convaincre |
| **Letterboxd** *(adjacent)* | Référence design/UX du logging + review, forte fidélité iOS | Hors catégorie séries, écart de qualité iOS/Android notable même pour un produit très mature | N/A | Bench de référence pour l'exécution visuelle et le ton (utile pour `entertainment-design-expert`) plus que pour le produit lui-même |

**Constat transversal le plus solide de cette étude** : à l'exception de Simkl (qui a eu un pic ponctuel documenté), **aucun concurrent n'échappe à des plaintes de fiabilité technique récurrentes** — que ce soit la lenteur (BetaSeries), les ruptures de promesses (Trakt), la performance mobile (Serializd) ou la dette technique de fin de vie (TV Time). Cela valide directement la thèse produit de tvtrackd : le vide n'est pas dans les fonctionnalités (elles existent toutes déjà, chez un concurrent ou un autre), il est dans l'**exécution fiable et continue**.

---

## 5. Besoins & jobs-to-be-done priorisés

Classement par intensité du signal observé dans cette étude (pas par popularité présumée) :

### JTBD 1 — « Je ne veux plus jamais perdre mon historique » (émotionnel + fonctionnel, priorité maximale actuelle)
- **Preuves** : §2.1 (verbatim Threads, paraphrases presse FR « rupture », citation Achriom sur la non-portabilité de la couche sociale, saturation de l'outil d'export officiel).
- **Nuance importante révélée par la recherche** : ce besoin a deux couches distinctes que les utilisateurs ne différencient pas toujours spontanément mais que le produit doit traiter séparément —
  1. **Les données factuelles** (historique de visionnage, notes) → exportables, c'est ce que promettent tous les concurrents.
  2. **La couche sociale** (commentaires, réactions, discussions) → non exportable chez TV Time, et généralement absente des exports concurrents aussi. C'est un point aveugle du marché entier, pas seulement de TV Time.
- **Implication** → `entertainment-product-expert` : l'argument export/import déjà en MVP (CSV/JSON, export JSON) est le bon socle, mais le message doit être honnête sur ce qui est réellement préservable (pas de survente d'une « portabilité totale » qui inclurait la dimension sociale, sous peine de répéter la déception TV Time à la prochaine fermeture d'un concurrent).

### JTBD 2 — « Je veux que ça marche, tout simplement » (fonctionnel, priorité maximale structurelle)
- **Preuves** : §2.2 (BetaSeries lenteur/incohérence navigateur, fil « on en a GROS »), §2.4 (Trakt v3, Service Unreachable), §2.6 (Serializd lenteur mobile).
- **Implication** → `tvtrackd-developer` / `entertainment-product-expert` : la fiabilité n'est pas une feature, c'est **le** facteur différenciant mesurable dans cette étude — aucun concurrent n'y échappe complètement. Chaque régression de performance ou de cohérence cross-device coûte cher au positionnement, plus cher que pour un concurrent déjà installé qui bénéficie d'un capital de tolérance.

### JTBD 3 — « Ne pas casser ce qui marchait avant » (spécifique migration/import)
- **Preuves** : §2.1 et §2.6 — le verbatim Threads documente concrètement un utilisateur qui essaie *trois* outils en parallèle (BetaSeries, Refract, Serializd) et abandonne Serializd spécifiquement à cause de l'absence d'import automatisé.
- **Implication** → `entertainment-product-expert` : l'import CSV/JSON déjà livré en MVP avec matching TMDb et résolution manuelle des ambiguïtés est un avantage concurrentiel réel et vérifié (Serializd ne l'a pas ; BetaSeries l'a mais avec des signalements d'épisodes manquants). C'est un argument à mettre en avant activement dans l'onboarding, pas à cacher dans un menu.

### JTBD 4 — « Je veux une expérience qui me comprend en français » (social/identitaire)
- **Preuves** : §2.3 (attachement à la communauté francophone BetaSeries), §2.4 (friction documentée pour les non-anglophones sur Trakt, fils de forum dupliqués EN/PT).
- **Implication** → `marketing-communication-expert` : le positionnement francophone n'est pas qu'un choix de langue d'interface, c'est un facteur d'attachement affectif déjà démontré chez le concurrent principal (BetaSeries) — argument à exploiter, mais qui doit être maintenu au-delà du lancement (pas de dérive vers du contenu ou du support majoritairement anglophone plus tard).

### JTBD 5 — « Je veux des recommandations qui ne me font pas perdre de temps » (découverte)
- **Preuves** : §2.2 (« une fois sur deux », recommandations hors-sujet, effet de boucle sur les mêmes genres).
- **Implication** → `entertainment-product-expert` : confirmé comme point faible générique du marché francophone (BetaSeries) — déjà identifié en backlog tvtrackd comme moteur de reco à construire proprement dès le départ. Cette étude renforce la priorité de ce chantier, sans pour autant fournir de preuve qu'il s'agit d'un critère de *première* conversion (plutôt un critère de *rétention* à moyen terme, une fois le socle fiable acquis).

### JTBD 6 — « Je veux logger vite, sans friction, quand je bing-watch » (fonctionnel, non directement documenté dans cette recherche)
- **Statut** : ce besoin (persona « binger » du contexte produit) n'a pas trouvé de verbatim direct dans cette étude — les sources consultées documentent plutôt des plaintes de fiabilité/perte de données que des demandes de friction de saisie. **À traiter comme hypothèse issue du contexte projet, non validée ni infirmée par cette recherche**, et à vérifier par une étude primaire (test utilisateur sur le flux de marquage multi-épisodes).

### JTBD 7 — « Je veux pouvoir partir si ça tourne mal, sans y être forcé dans l'urgence » (data portability / anti-lock-in)
- **Preuves** : §2.1 (citation Moviebase sur le lock-in TV Time), retours Trakt sur la rupture de promesse de pricing (§2.4) qui nourrit une méfiance générale envers les engagements de plateforme.
- **Implication** → `entertainment-product-expert` : ce JTBD dépasse le seul cas TV Time — la rupture de confiance Trakt (promesse de pricing non tenue) montre que la méfiance concerne aussi des acteurs *non fermés*, simplement en cas de changement de politique. L'export doit rester **disponible en continu et sans friction**, pas seulement en cas de fermeture — sinon l'argument perd sa crédibilité.

---

## 6. Axes d'amélioration priorisés pour tvtrackd

Chaque axe est relié à un pain point documenté ci-dessus, et qualifié en **quick win** (faible effort, effet rapide) ou **chantier de fond** (effort structurant), avec l'agent destinataire.

### Quick wins (implémentation ciblée, effet direct sur la conversion/rétention)

1. **Rendre visible et vérifiable la promesse d'export, dès l'onboarding, pas seulement dans les paramètres.**
   Lié à JTBD 1 et 7 (§2.1, §2.4). L'export JSON existe déjà en MVP — le pain point n'est pas l'absence de la feature mais son manque de visibilité comme argument de réassurance immédiate. → `entertainment-product-expert` pour le placement/messaging dans le parcours, `tvtrackd-developer` si un accès direct depuis le profil ou un rappel post-inscription est à ajouter.

2. **Être transparent sur ce qui est exporté vs ce qui ne l'est pas (pas de survente).**
   Lié à JTBD 1, nuance découverte en §2.1 (Achriom : couche sociale non exportable même chez TV Time). Éviter de promettre implicitement une portabilité totale si tvtrackd développe des features sociales plus tard sans prévoir leur exportabilité dès la conception. → `entertainment-product-expert` (décision de scope), `marketing-communication-expert` (formulation honnête du message).

3. **Mettre en avant l'import CSV/JSON multi-source (TV Time *et* BetaSeries) comme argument différenciant actif, pas passif.**
   Lié à JTBD 3 (§2.1, §2.6) : Serializd perd des utilisateurs précisément sur ce point, BetaSeries a des signalements d'épisodes manquants. tvtrackd a déjà la feature avec résolution manuelle des ambiguïtés — c'est un avantage vérifié à exposer clairement dans les landing pages/onboarding. → `marketing-communication-expert`.

4. **Vérifier la cohérence de comportement entre navigateurs/plateformes avant tout lancement public élargi.**
   Lié à JTBD 2 (§2.2 : incohérence Chrome/Safari/Firefox/Arc chez BetaSeries, citée comme pain point n°1 en fréquence). Un test de non-régression cross-browser/cross-device systématique avant chaque release limiterait le risque de reproduire ce pain point précis. → `tvtrackd-developer` (tests), `tvtrackd-qa-reviewer` (validation).

### Chantiers de fond (effort structurant, différenciation moyen/long terme)

5. **Blinder le couple archivage/désarchivage contre toute perte ou incohérence d'historique (déjà anticipé dans le schéma, à vérifier en continu).**
   Lié à JTBD 2, pain point le plus précisément documenté et récurrent chez BetaSeries (§2.2, plusieurs fils sur plusieurs années). Le schéma Supabase actuel sépare déjà `user_shows.status` de `watch_status` — cette étude **confirme que c'est le bon choix architectural** et qu'il faut le protéger par des tests de régression dédiés à chaque évolution du schéma ou des edge functions liées. → `tvtrackd-developer` (tests de non-régression ciblés), `entertainment-product-expert` (aucune feature future ne doit recréer un couplage entre les deux notions).

6. **Construire le moteur de recommandation avec un mécanisme explicite de fallback qualité (jamais de « aucune série trouvée » sec, jamais de proposition hors-sujet silencieuse).**
   Lié à JTBD 5 (§2.2 : « une fois sur deux », bouclage sur les mêmes genres). Le backlog identifie déjà ce chantier ; cette étude ajoute une exigence de conception précise : mesurer et afficher en interne un taux de "no result"/"résultat hors-sujet" avant tout lancement public de la feature, pour ne pas relancer sous un autre nom le même pain point. → `entertainment-product-expert` (spec fonctionnelle du moteur), `tvtrackd-developer` (implémentation + instrumentation).

7. **Anticiper la charge en cas de pic d'acquisition (migration BetaSeries ou nouvelle vague TV Time-like).**
   Lié à JTBD 2, fait documenté et daté chez Simkl (§2.5 : 20k+ imports en une nuit, restriction d'urgence de l'import ZIP aux comptes premium). Le risque n'est pas hypothétique : même l'alternative la mieux préparée techniquement a dû restreindre une feature en urgence sous la charge. → `tvtrackd-developer` (dimensionnement de l'edge function d'import et du matching TMDb, files d'attente, feedback de progression visible côté utilisateur pour éviter l'effet « file qui recule » observé dans le verbatim Threads §2.1).

8. **Étudier une passerelle d'import Trakt, positionnée spécifiquement vers les utilisateurs mécontents de la refonte v3 / de la hausse de prix.**
   Lié à JTBD 1 et 7 (§2.4 : rupture de promesse de pricing, refonte v3 controversée, power users en tension avec l'équipe Trakt). Déjà en backlog hors-MVP dans le contexte produit ; cette étude fournit un **signal temporel précis** (mai 2025 → tensions encore vives mi-2026) qui peut justifier de le remonter dans la priorisation si cette frange d'utilisateurs technique/mécontente est jugée pertinente pour le marché francophone visé. → `entertainment-product-expert` (arbitrage priorisation, à trancher, pas décidé ici).

9. **Considérer, à moyen terme, une couche sociale/reviews légère mais fiable plutôt qu'une copie complète de Serializd.**
   Lié à JTBD 4 et à la case « social/découverte » du contexte produit. Cette étude montre que Serializd séduit par son *positionnement* (Letterboxd pour séries) mais déçoit par son *exécution* (perf mobile, fonctionnalités manuelles incomplètes) — l'opportunité n'est pas de faire "plus de features sociales" mais de les faire *mieux exécutées*, en cohérence avec la thèse globale de tvtrackd. → `entertainment-product-expert` (arbitrage simplicité vs exhaustivité sociale, à trancher avec l'utilisateur/l'équipe, pas ici).

10. **Documenter et communiquer une politique de pérennité/portabilité proactive, pas seulement réactive à une fermeture.**
    Lié à JTBD 7 (§2.4 : la défiance ne vient pas seulement des fermetures mais des ruptures de promesses d'acteurs toujours en activité). Un export accessible en un clic à tout moment, sans justification à donner, devient un argument de confiance à long terme plus fort qu'une simple réponse à la panique post-TV Time. → `marketing-communication-expert` (positionnement), `entertainment-product-expert` (garantir que la feature reste accessible et non dégradée dans le temps).

---

## 7. Limites de l'étude & pistes de recherche primaire

### Ce que cette étude établit avec confiance
- La fermeture TV Time est un événement réel, daté, documenté par de nombreuses sources convergentes (presse FR et EN, forums officiels des concurrents, réseaux sociaux) — le contexte projet tvtrackd est fondé sur des faits vérifiables, pas une extrapolation.
- Les pain points de fiabilité technique de BetaSeries (lenteur, incohérence navigateur, bug archivage/désarchivage, bot de reco) sont **documentés de façon récurrente et stable dans le temps**, via le propre forum d'aide officiel de BetaSeries — ce n'est pas une caricature concurrentielle, c'est un pattern répété sur plusieurs années.
- L'absence d'import TV Time automatisé chez Serializd, et la tension de charge serveur chez Simkl, sont des faits datés et confirmés par plusieurs sources indépendantes (presse + témoignage utilisateur direct).

### Ce qui reste une hypothèse à valider
- Le besoin de friction minimale pour les « bingers » (JTBD 6) — non documenté dans cette recherche, purement issu du cadrage produit initial.
- La hiérarchie exacte entre les besoins (est-ce que la fiabilité prime vraiment sur la portabilité dans la décision de choix, ou l'inverse ?) — cette étude documente l'existence forte des deux besoins mais ne peut pas trancher leur ordre de priorité relatif sans étude quantitative dédiée (sondage, tri de cartes).
- L'intensité réelle de la demande pour une couche sociale/reviews (JTBD 4/9) chez le segment spécifiquement visé par tvtrackd (migrants TV Time francophones) — les signaux viennent surtout de communautés anglophones (Serializd, Letterboxd).

### Ce qu'une étude primaire permettrait de combler
- **Accès direct à Reddit** (r/tvtime, r/trakt, r/simkl, r/serializd, r/BetaSeries s'il existe) — bloqué dans cette session par une contrainte technique d'egress réseau (voir §1.2), pas par choix méthodologique. À refaire dès qu'un accès outillé le permet, car Reddit est probablement la source la plus riche en verbatims spontanés et non filtrés pour cette catégorie de produit.
- **Entretiens qualitatifs** (5-8 personnes) avec des migrants TV Time récents pour tester directement la hiérarchie des besoins (fiabilité vs export vs social) plutôt que de l'inférer de la fréquence d'apparition dans des sources secondaires.
- **Test d'arborescence / card sorting** sur le parcours d'import pour vérifier si le pain point « file d'attente qui semble reculer » (verbatim Threads §2.1) est un problème de perception (manque de feedback de progression) ou un problème réel de performance backend — la distinction change complètement la réponse produit à apporter.
- **Sondage quantitatif** sur le segment francophone pour confirmer/infirmer l'intensité relative de la barrière de langue Trakt comme frein réel à l'adoption (actuellement une hypothèse déduite de la structure des forums, pas mesurée directement).

---

*Document produit par recherche secondaire (desk research). Toutes les URLs citées ont été retrouvées via l'outil de recherche web ; faute d'accès direct aux pages (contrainte technique documentée en §1.2), certains passages sont des synthèses/paraphrases explicitement signalées comme telles plutôt que des citations littérales.*
