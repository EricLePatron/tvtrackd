# Stratégie réseaux sociaux — tvtrackd

**Document stratégique** — Reddit / Twitter (X) / Instagram / TikTok
**Rédigé le** : 12 juillet 2026
**Fenêtre critique** : TV Time (26M utilisateurs revendiqués) ferme définitivement le **15 juillet 2026**. Nous sommes à **J-3**. Ce document doit être lu comme un plan d'exécution immédiat, pas comme un cadre théorique à dérouler tranquillement sur un trimestre.

> **Note sur le nom de marque** : le nom "tvtrackd" n'est pas définitivement validé (risque de proximité de marque avec "Trakt" en cours de vérification INPI/TMview — voir CLAUDE.md). Tous les exemples de posts ci-dessous utilisent "tvtrackd" comme placeholder de travail. **Ne pas créer les comptes sociaux définitifs, ni imprimer ce nom dans des visuels durables (bannières, logo TikTok, bio Instagram) tant que la validation n'est pas faite.** Recommandation compte tenu de l'urgence : réserver les handles (@tvtrackd) dès maintenant sur les 4 plateformes à titre conservatoire — la réservation d'un handle n'engage rien juridiquement et protège contre le squat — mais garder le contenu public (bio, posts) le plus neutre possible sur le nom pendant les 48 premières heures si le doute persiste au moment de la publication. Arbitrage final : à trancher par l'utilisateur, pas par cet agent.

## Faits vérifiés utilisés dans ce document (sources, juillet 2026)

- TV Time ferme le **15 juillet 2026**, annonce faite le 2 juillet 2026. Raison officielle : modèle gratuit non viable ; raison de fond : rachat par Blue Torch Capital (2025) et pivot de l'éditeur (Whip Media) vers l'IA enterprise (produit "Helix"). Application lancée en 2011 sous le nom TVShow Time par deux ingénieurs français (EPITA), ~26M utilisateurs revendiqués, 115M$ levés au total. Export RGPD possible jusqu'au 15/07 via l'outil intégré ou par mail à `support@tvtime.com` — au-delà, suppression définitive des données. — [lucasfonseque.fr](https://lucasfonseque.fr/tv-time-fermeture-15-juillet-2026-histoire-application-saas/), [Journal du Geek](https://www.journaldugeek.com/2026/07/03/tv-time-mauvaise-nouvelle-pour-les-utilisateurs/), [Softonic FR](https://fr.softonic.com/articles/tv-time-va-fermer-en-juillet-2026-recuperez-vos-donnees-avant-quil-ne-soit-trop-tard)
- Betaseries, en pleine période de report TV Time, connaît des **problèmes de synchronisation aggravés** : erreurs 504, épisodes vus repassant en non-vus, difficultés de connexion persistantes, et surtout une **file d'attente d'import TV Time qui s'allonge** (utilisateurs signalant une position de file en augmentation constante, pas de garantie de délai). — [totalbug.com](https://www.totalbug.com/betaseries/), [forum Betaseries](https://www.betaseries.com/forum/questions/3851-probleme-de-synchro-avec-tv-time). **C'est l'angle concurrentiel le plus fort et le plus vérifiable dont nous disposons aujourd'hui : import immédiat vs file d'attente.**
- D'autres alternatives émergent dans la conversation publique au même moment : Trakt, Sofa Time, Cinexplore, Keekup, WatchTrack.app, en plus de Betaseries — [Lubie en Série](https://lubieenserie.fr/tv-time-ferme-pour-toujours-quelles-alternatives-pour-suivre-son-planning-de-series/). **Le marché de la conversion TV Time n'est pas vide : la fenêtre est ouverte mais concurrentielle, il faut être visible et crédible vite.**
- Deux pétitions circuleraient pour tenter de sauver TV Time — signal que la communauté est en deuil actif de son outil, un terrain émotionnel à traiter avec empathie plutôt qu'en surfant dessus de façon opportuniste.
- Existence d'un subreddit francophone séries actif (`r/SerieTV`) en plus de `r/france` — **à vérifier en direct (taille, activité récente, règles de modération) avant d'investir du temps**, les chiffres d'audience de subreddits de niche évoluent vite et n'ont pas pu être confirmés avec précision dans cette recherche.

## Ce que le produit peut réellement promettre aujourd'hui (12/07/2026)

Vérifié dans le code (`src/routes/_authenticated/import.tsx`, CLAUDE.md section "Découpage des features") — **ne jamais communiquer au-delà de cette liste** :

- Tracking épisode par épisode avec gestion des rewatchs
- Calendrier des sorties (hero "Ce soir" + rail "Programme")
- **Import guidé TV Time** : dépôt direct du `.zip` d'export RGPD TV Time (pas besoin de dézipper), matching TMDb automatique + résolution manuelle des ambiguïtés
- **Import Betaseries** : `.csv` d'export
- **Export JSON** des données utilisateur, disponible dès le premier jour
- Bibliothèque avec statuts (à voir/en cours/terminé/abandonné/archivé), désarchivage fonctionnel
- Stats basiques (épisodes vus, temps estimé, séries en cours)

Pas encore livrés (à ne jamais promettre comme disponibles) : app mobile native / store dédié, import Trakt en un clic (OAuth), moteur de recommandation, reviews/social feed, scrobbling automatique streaming, notifications push. Le produit est aujourd'hui une web app (TanStack Start) — **le volet ASO classique (App Store/Play Store) ne s'applique pas encore** ; il est traité plus bas comme un chantier conditionnel, pas une priorité immédiate.

---

## Vue d'ensemble : rôle de chaque plateforme dans le funnel

| Plateforme | Rôle principal | Rôle secondaire | Pourquoi |
|---|---|---|---|
| **Reddit** | Acquisition à froid, haute intention | Crédibilité / preuve sociale | C'est là que se trouve la recherche active "TV Time ferme, alternative ?" — intention d'achat/adoption la plus forte de toutes les plateformes, mais terrain hostile à l'auto-promo non méritée |
| **Twitter/X** | Acquisition réactive + veille temps réel | Advocacy / relation presse | C'est le lieu du désarroi en temps réel post-annonce, et le canal où la presse tech FR (Numerama, JDG) et les créateurs sériephiles s'expriment et sont accessibles en DM/réponse |
| **Instagram** | Rétention + image de marque | Activation (démonstration produit) | Format vitrine pour l'identité visuelle "vidéo-club nocturne" et le compteur VHS signature ; audience déjà convertie ou en fin de funnel qui veut voir "à quoi ça ressemble avant de switcher" |
| **TikTok** | Acquisition de masse, notoriété | Activation via démonstration | Format le plus efficace pour montrer en 15-30s le geste "je marque un épisode vu" et l'esthétique du compteur — portée organique potentiellement large sur une actualité (fermeture TV Time) qui est déjà un sujet viral chez les créateurs séries FR |

---

## 1. Reddit

### Rôle stratégique
Reddit est le canal où l'intention est la plus qualifiée : quelqu'un qui poste "TV Time ferme, par quoi le remplacer ?" a déjà le problème et cherche activement la solution — c'est la conversion la plus proche du zéro-friction qui existe dans ce plan. Mais c'est aussi la plateforme la plus punitive envers l'auto-promo perçue comme spam : un compte qui débarque en lançant son app sans historique se fait généralement supprimer ou downvoter, avec un coût réputationnel qui dépasse le subreddit d'origine.

### Quoi pousser
- **Piliers éditoriaux** :
  1. Réponses utiles et non-promotionnelles dans les threads existants sur la fermeture TV Time (comparatifs factuels, aide à l'export de données)
  2. Un post d'annonce unique, transparent, dans les subreddits pertinents, au bon moment (voir section urgence) — présenté comme "je construis ça, voici où ça en est, cherche des retours", pas comme une pub
  3. AMA ou retour d'expérience développeur ("j'ai importé mon historique TV Time de 8 ans, voici ce qui s'est passé") — format qui fonctionne bien sur Reddit car il documente un problème réel avec preuve
  4. Threads de comparatif honnête (tvtrackd vs Trakt vs Betaseries vs Simkl), y compris en citant nos propres limites actuelles

### Comment pousser
- **Communautés cibles** : `r/france` (fil dédié séries/déception TV Time), `r/SerieTV` (à vérifier en direct : taille et activité récentes avant d'investir), `r/france` sous-thread tech/appli, groupes Facebook FR "Fans de séries" / "TV Time France" (souvent plus actifs que Reddit pour ce public non-tech francophone — à cartographier par le community manager), et en subsidiaire `r/trakt`, `r/PlexTraktSync`, `r/television` (anglophones, mais où la conversation TV Time existe aussi, utile pour la crédibilité "power users" et le recrutement de retours techniques).
- **Cadence** : pas de calendrier de publication figé sur Reddit — la valeur vient de la réactivité et de la pertinence contextuelle, pas du volume. Objectif réaliste : 3 à 5 interventions utiles par semaine dans des threads existants sur juillet-août, 1 post d'annonce propre par sous-communauté (pas de repost dans plusieurs subreddits le même jour, ça se voit et se sanctionne).
- **Ton** : premier degré, transparent sur le stade de développement, aucun superlatif marketing ("le meilleur tracker"), on assume les limites ("pas encore d'app mobile, pas encore d'import Trakt automatique").
- **Règle d'or self-promo** : suivre la règle informelle du 9:1 (9 contributions de valeur sans lien pour 1 mention de produit), déclarer l'affiliation explicitement ("je développe cette app, disclaimer") dès le premier post — la transparence proactive désamorce l'accusation de spam mieux que la dissimulation découverte après coup. Vérifier et respecter les règles spécifiques de chaque subreddit (certains interdisent totalement l'auto-promo, d'autres l'autorisent un jour fixe par semaine).
- **Do** : répondre avec des captures d'écran réelles du produit, répondre aux critiques négatives sans supprimer les commentaires, créditer honnêtement Trakt/Simkl quand leur usage est plus adapté (power users Plex/Kodi).
- **Don't** : ne jamais poster depuis un compte créé le jour même, ne jamais payer/organiser du vote manipulation (upvote brigading — bannissable), ne jamais dénigrer Betaseries sans donnée vérifiable à l'appui (le forum Betaseries lui-même documente les bugs actuels, s'appuyer dessus plutôt qu'inventer).

### Exemples de posts prêts à l'emploi

**Post 1 — réponse utile dans un thread existant "TV Time ferme, help"**
> Pour la partie technique : demande ton export RGPD direct depuis l'app TV Time (Réglages > vie privée > demande de données), ou par mail à support@tvtime.com si l'app plante — ils ont jusqu'au 15/07 pour te répondre, ne traîne pas. Tu reçois un .zip avec tout ton historique.
> Ensuite pour la suite, ça dépend de ton usage : si tu scrobbles depuis Plex/Kodi, Trakt reste la référence technique. Si tu veux quelque chose de plus simple, en français, avec calendrier de sorties — je bosse justement sur un outil qui prend le .zip TV Time direct sans le dézipper (le matching des séries est automatique, tu valides juste les cas ambigus). C'est encore jeune, dispo ici si ça t'intéresse : [lien]. Sinon Betaseries fait aussi l'import mais leur file d'attente s'est pas mal allongée ces derniers jours vu l'afflux.

**Post 2 — post d'annonce transparent (à poster une seule fois, dans le sous-forum le plus pertinent)**
> **Titre** : J'ai construit un tracker de séries FR après avoir halluciné devant la fermeture de TV Time — retours bienvenus
>
> Contexte rapide : comme beaucoup ici je trackais mes séries sur TV Time depuis des années, et l'annonce de fermeture avec 2 semaines de préavis m'a fait realiser à quel point on est démuni quand une app "gratuite" décide du jour au lendemain de fermer.
>
> J'ai commencé à construire tvtrackd (nom provisoire, pas encore 100% figé) avec deux priorités simples :
> - récupérer l'historique TV Time/Betaseries en un clic, sans y perdre une ligne
> - export de mes données possible dès le premier jour, pas seulement à la fermeture — parce que "vos données sont en otage jusqu'à ce qu'on ferme" ne devrait jamais être la norme
>
> C'est encore un petit projet (pas d'app mobile pour l'instant, web uniquement, pas de moteur de recommandation), donc je ne prétends pas remplacer Trakt pour les power users Plex. Mais si vous cherchez juste un endroit fiable pour marquer ce que vous regardez, avec calendrier de sorties, je serais hyper preneur de retours honnêtes, y compris "ça sert à rien, utilise X à la place".
> Lien : [lien] — disclaimer complet, oui c'est moi qui la développe.

**Post 3 — comparatif factuel (format qui fonctionne bien sur Reddit)**
> **Titre** : Comparatif rapide TV Time → où aller (Trakt / Betaseries / tvtrackd), testé cette semaine
>
> J'ai testé l'import de mon historique TV Time (8 ans, ~1200 épisodes) sur les 3 principales alternatives dont on parle en ce moment :
> - **Trakt** : import possible mais passe par un format générique, pas de matching automatique des ambiguïtés, interface pensée pour scrobbling Plex/Kodi plutôt que saisie manuelle
> - **Betaseries** : import TV Time existe nativement, mais actuellement en file d'attente (plusieurs jours d'attente signalés sur leur forum vu l'afflux post-annonce), et des bugs de sync actifs sur les épisodes vus/non-vus
> - **tvtrackd** (le projet sur lequel je bosse, disclaimer) : import direct du .zip, traitement immédiat, matching TMDb avec résolution manuelle des cas ambigus
>
> Aucune de ces options n'a de moteur de recommandation solide pour l'instant, à noter si c'est votre critère principal.

### KPIs Reddit
- Nombre d'interventions/commentaires postés par semaine (volume d'effort)
- Ratio upvote/downvote par post (santé de la réception communautaire — cible : rester positif, un post en territoire négatif doit être retiré ou requalifié)
- Clics sortants vers le produit (UTM `reddit` par subreddit)
- Taux de conversion clic → compte créé
- Mentions organiques de la marque par des tiers (recherche manuelle hebdomadaire "tvtrackd" sur Reddit)

---

## 2. Twitter / X

### Rôle stratégique
X est le canal du temps réel : c'est là que le désarroi post-annonce s'est exprimé le plus vite (voir le tweet viral d'annonce de fermeture cité dans nos recherches), et c'est le canal le plus direct pour toucher la presse tech francophone (Numerama, Journal du Geek, Frandroid) et les créateurs sériephiles FR en réponse ou en DM. Rôle secondaire fort en advocacy : un utilisateur qui partage sa "victoire" d'import réussi ou son statut hebdomadaire devient un point de preuve sociale visible publiquement.

### Quoi pousser
- **Piliers éditoriaux** :
  1. **Veille et réaction** : commenter/citer l'actualité TV Time et Betaseries en temps réel avec de la valeur ajoutée factuelle (pas du dénigrement gratuit)
  2. **Preuve produit courte** : captures d'écran/GIFs du compteur VHS, de l'import en cours, d'un export JSON réel
  3. **Transparence de build** : "build in public" léger — ce qui vient d'être livré, ce qui arrive, sans sur-promettre de date
  4. **Support/community management public** : répondre publiquement aux questions et bugs, visibilité = crédibilité
- **Formats** : threads courts (3-6 tweets) pour les comparatifs et retours d'expérience, tweets uniques + visuel pour les annonces de fonctionnalité, quote-tweets réactifs sur l'actualité TV Time/Betaseries.

### Comment pousser
- **Cadence** : 4-6 publications par semaine en phase de lancement (juillet-août), incluant au moins 1-2 réactions d'actualité réactives (délai de réaction cible : moins de 4h sur une actu chaude type nouvelle vague de bugs Betaseries ou nouvelle couverture presse TV Time). Réduire à 2-3/semaine en régime de croisière rétention (septembre+).
- **Ton** : direct, un peu franc/complice avec la communauté séries, jamais corporate. On peut être taquin envers les bugs concurrents documentés (avec lien source), jamais insultant.
- **Hashtags/mots-clés à surveiller et utiliser avec parcimonie** : `#TVTime`, `#TVTimeFerme` (variantes probables : `#RIPTVTime`), `#Betaseries`, `#SérieTV`, `#Bingewatch` — usage modéré, X pénalise le hashtag-stuffing dans l'algorithme actuel ; 1 à 2 hashtags par tweet maximum, privilégier la présence dans les réponses aux comptes qui font autorité sur le sujet (comptes séries FR, comptes tech FR) plutôt que le hashtag pour la découverte.
- **Do** : répondre aux threads de comptes tech FR (Numerama, JDG, Frandroid) qui couvrent la fermeture TV Time avec des informations factuelles utiles (pas juste "essayez notre app"), épingler un tweet-fil "tout savoir sur l'export de vos données TV Time" pendant la fenêtre critique.
- **Don't** : ne pas spammer les mentions de comptes TV Time officiels de manière agressive, ne pas citer de chiffre concurrent non sourcé, éviter le ton "on a gagné" tant que le produit reste en construction active.

### Exemples de posts prêts à l'emploi

**Tweet 1 — réactif actualité**
> TV Time ferme dans 3 jours (15/07). Rappel express si vous n'avez pas encore fait la demande :
> → Demandez votre export RGPD direct dans l'app (Réglages > Vie privée) ou par mail à support@tvtime.com
> → Vous recevrez un .zip sous 24-48h, ne laissez pas traîner
> → Gardez ce fichier, peu importe où vous allez ensuite
> [visuel : capture du bouton export]

**Tweet 2 — thread comparatif court**
> Betaseries vient de rouvrir grand ses portes aux réfugiés TV Time... et leur file d'import s'allonge de jour en jour d'après leur propre forum (504, désync des épisodes vus). Pas une critique gratuite, juste ce qu'on lit sur leur forum public en ce moment [lien forum]. 1/3
>
> De notre côté sur tvtrackd, l'import du .zip TV Time est traité immédiatement, pas de file d'attente — parce qu'on est encore petit, mais aussi parce qu'on a construit ça dès le départ pour que ce soit rapide. 2/3
>
> On n'a pas de moteur de recommandation ni d'app mobile pour l'instant, donc si c'est votre critère n°1, ce n'est pas encore le bon choix. Mais si vous voulez juste un endroit fiable pour reprendre votre historique sans attendre, on est là. 3/3

**Tweet 3 — preuve produit / build in public**
> Le detail qu'on ne voulait pas rater : l'export JSON de vos données est disponible dès votre premier jour sur tvtrackd, pas seulement le jour où (si un jour) on ferme. La fermeture de TV Time nous a rappelé que ça ne devrait jamais être une fonctionnalité de "sortie de secours" — ça doit exister day one.
> [visuel : capture de l'écran export]

### KPIs X
- Impressions et taux d'engagement par tweet (particulièrement sur les tweets réactifs d'actualité)
- Nombre de mentions/réponses reçues de comptes tech FR ou créateurs séries
- Clics sortants (UTM `x`/`twitter`)
- Croissance de followers hebdomadaire pendant la fenêtre critique (signal direct de la captation de l'attention TV Time)
- Taux de réponse du community management (délai moyen de réponse aux mentions/questions)

---

## 3. Instagram

### Rôle stratégique
Instagram sert surtout la rétention et l'image de marque : c'est l'endroit où un utilisateur déjà exposé au produit (via Reddit, X, TikTok, bouche à oreille) vient vérifier "à quoi ça ressemble", et où un utilisateur actif garde le contact avec la marque entre deux sessions. L'esthétique "vidéo-club nocturne" (fond sombre, amber/cyan, compteur VHS Plex Mono) est un actif visuel qui se prête particulièrement bien au grid Instagram et aux Reels — c'est le canal où l'identité de marque doit être la plus soignée et la plus cohérente.

### Quoi pousser
- **Piliers éditoriaux** :
  1. **Démonstration produit stylée** : le compteur VHS en action (Reels courts, boucle satisfaisante), le hero "Ce soir", le rail "Programme"
  2. **Culture séries** : contenus éditoriaux légers autour des sorties de la semaine (calendrier), sans dépendre de licences (pas de captures d'images officielles de séries sans droit — vérifier les visuels autorisés)
  3. **Coulisses/marque** : les tokens de design, le "pourquoi" du compteur mécanique, la genèse du projet (storytelling fondateur autour de la fermeture TV Time)
  4. **Témoignages/UGC** : republier (avec accord) les stats ou listes partagées par des utilisateurs
- **Formats** : Reels (priorité, portée organique la plus forte), Stories (sondages "vous trackiez sur quoi avant ?", coulisses), grid de posts avec identité visuelle forte et cohérente (palette amber `#FF8A3D` / cyan `#4DD9C4` / fond `#0B0E14`).

### Comment pousser
- **Cadence** : 3-4 Reels/semaine en phase de lancement, 1 post grid par semaine, Stories quasi-quotidiennes tant qu'il y a de la matière (actualité TV Time, réponses aux DMs, sondages). Réduire à 2 Reels/semaine + 1 post en rétention.
- **Ton** : chaleureux, nostalgique sans être ringard, jamais cartoonesque — cohérent avec la direction design (pas d'effets décoratifs superflus en dehors du compteur signature).
- **Hashtags** : `#SérieTV`, `#SeriesTV`, `#Bingewatch`, `#TVTime` (avec parcimonie, contextuel uniquement sur les posts pertinents), `#TrackerSéries`. Usage raisonnable (5-8 hashtags maximum), Instagram favorise aujourd'hui les légendes et la qualité du contenu plus que le volume de hashtags.
- **Do** : soigner systématiquement le sous-titrage des Reels (beaucoup de visionnage son coupé), garder une cohérence stricte de palette et de typographie (Archivo Expanded pour les titres overlay, IBM Plex Mono pour tout chiffre affiché à l'écran — ne jamais dévier du design system pour un post, même "juste pour un test").
- **Don't** : ne pas utilisez de template Canva générique qui casse l'identité (pas de dégradés décoratifs, pas de glassmorphism — voir CLAUDE.md section design), ne pas transformer le compteur VHS en gadget "meme" qui banaliserait l'élément signature.

### Exemples de contenus prêts à l'emploi

**Reel 1 — démonstration compteur VHS (15-20s)**
> Visuel : écran capturé du compteur qui s'incrémente au clic "épisode vu", fond `--bg-surface-raised`, chiffres Plex Mono qui défilent.
> Légende : "Marquer un épisode vu ne devrait jamais ressembler à une checkbox de todo-list. Voilà pourquoi on a un compteur, pas une case à cocher. #SérieTV #TrackerSéries"

**Reel 2 — storytelling fondateur (30s, voix off ou texte overlay)**
> Script : "TV Time ferme le 15 juillet, après 15 ans et 26 millions d'utilisateurs. — Deux semaines de préavis pour récupérer des années d'historique. — On a construit tvtrackd avec une règle simple : vos données s'exportent depuis le premier jour, pas seulement le jour où on plie bagage. — Parce que ça, ça ne devrait jamais être une fonctionnalité de dernière minute."
> Légende : "Le vrai problème de TV Time n'était pas la fermeture. C'était de ne jamais avoir prévu qu'un jour, il faudrait partir."

**Post grid — annonce identité/palette**
> Visuel : mockup de la fiche série avec hero "Ce soir", palette amber/cyan sur fond sombre.
> Légende : "Vidéo-club nocturne, version 2026. Pas de dégradé décoratif, pas de mascotte — juste l'ambiance d'un programme TV qu'on retrouve le soir."

### KPIs Instagram
- Taux de rétention de visionnage des Reels (3s, 50%, complet)
- Partages en Story par des tiers (signal fort de traction organique)
- Taux de croissance des abonnés
- Taux d'engagement du grid (likes+commentaires/reach)
- Clics vers le lien en bio (UTM `instagram`)

---

## 4. TikTok

### Rôle stratégique
TikTok est le canal à plus fort potentiel de portée organique brute sur ce sujet précis : la fermeture de TV Time est déjà un sujet traité par les créateurs séries FR et anglophones, l'algorithme pousse activement le contenu d'actualité "chaude", et le format "montrer le geste en 15-30s" (marquer un épisode vu, voir le compteur défiler, importer son historique) est particulièrement adapté au médium. C'est le canal où l'acquisition de masse est la plus probable dans les prochaines semaines si le contenu est bon.

### Quoi pousser
- **Piliers éditoriaux** :
  1. **Réaction à l'actualité TV Time** : contenu qui capitalise directement sur la recherche "TV Time ferme, comment faire"
  2. **Démonstration produit ultra-rapide** : import de l'historique en direct, compteur VHS en action
  3. **Format "je réagis à..."** : réagir aux vidéos d'autres créateurs qui parlent de la fermeture TV Time (avec stitch/duet quand la fonctionnalité et les règles de créateur le permettent)
  4. **Point de vue développeur/fondateur** : format "j'ai construit ça parce que..." qui humanise et crée de la confiance (marche bien sur TikTok, contrairement à la pub classique)
- **Formats** : vidéos verticales 15-45s, voix/face cam ou screen recording avec voix off, sous-titres brûlés obligatoires.

### Comment pousser
- **Cadence** : 4-5 vidéos/semaine en phase de lancement (le volume compte beaucoup sur TikTok pour trouver le contenu qui "prend"), stabiliser à 2-3/semaine ensuite selon les performances.
- **Ton** : direct, rythmé, premières 2 secondes doivent accrocher (hook visuel ou verbal fort), pas besoin d'être lissé/scripté à l'excès — l'authenticité perçue performe mieux que la production léchée sur ce format.
- **Hashtags** : `#TVTime`, `#TVTimeFerme`, `#SérieTV`, `#SeriesTV`, `#Bingewatch`, `#PourToi` (portée FR), en gardant 3-5 hashtags pertinents plutôt qu'une liste générique.
- **Do** : filmer/enregistrer l'écran du vrai produit (pas de mockup statique), répondre aux commentaires en vidéo quand une question revient souvent (format qui relance l'algorithme), publier au moment où l'actualité TV Time est chaude (les prochains jours, puis le 15/07 lui-même, jour de fermeture effective, sera un pic d'attention à ne pas manquer).
- **Don't** : ne pas suracheter en hashtags génériques sans rapport, ne pas promettre de fonctionnalité non livrée dans une vidéo qui peut circuler longtemps après (le contenu TikTok reste indexé et revient), ne pas ignorer les commentaires négatifs/bugs signalés — y répondre publiquement en vidéo si le sujet revient souvent.

### Exemples de scripts prêts à l'emploi

**Script 1 — "TV Time ferme dans 3 jours, voici quoi faire" (25-30s)**
- Hook (0-2s) : cadrage face cam, ton urgent : "Si tu utilises encore TV Time, tu as jusqu'à mercredi. Après ça, tes données disparaissent."
- Corps (2-20s) : "Étape 1 : va dans Réglages, Vie privée, demande ton export — tu reçois un fichier .zip avec tout ton historique sous 24-48h. Étape 2 : garde ce fichier précieusement, peu importe où tu vas après. Étape 3, si tu cherches où aller : [transition vers screen recording de l'import sur tvtrackd] — tu déposes direct le .zip, pas besoin de le dézipper, ça reconnaît tes séries automatiquement."
- CTA (20-30s) : "Lien en bio si tu veux tester, c'est encore un petit projet donc sois indulgent, mais l'essentiel — marque tes épisodes vus, calendrier des sorties — ça marche déjà."

**Script 2 — démonstration compteur VHS (15-20s)**
- Hook (0-2s) : gros plan sur le compteur qui défile au clic, sans parole, juste le son de l'incrément si disponible : "Regarde ce détail."
- Corps (2-15s) : voix off : "Sur la plupart des trackers, marquer un épisode vu c'est une case à cocher. Ici c'est un compteur, comme une vieille bande VHS qui avance. Ça n'a l'air de rien mais c'est le seul truc qu'on s'est autorisé à rendre un peu spectaculaire — tout le reste de l'app reste sobre."
- CTA (15-20s) : "Si toi aussi t'étais sur TV Time et tu cherches où atterrir, lien en bio."

**Script 3 — format fondateur "pourquoi j'ai construit ça" (30-40s)**
- Hook (0-2s) : "TV Time ferme le 15 juillet. Voici ce que ça m'a appris sur la façon dont on traite nos propres données."
- Corps (2-30s) : "26 millions d'utilisateurs, une app qui existe depuis 2011, et deux semaines de préavis avant suppression totale des données. [Beat] Ce qui m'a le plus marqué, c'est pas la fermeture en soi — les boîtes ferment, ça arrive. C'est que l'export de données, ça n'existait quasiment pas avant l'annonce de fermeture. Comme si c'était une fonctionnalité de sortie de secours plutôt qu'un droit basique. Sur tvtrackd, l'export JSON de tes données existe depuis le premier jour, que tu partes dans une semaine ou dans 5 ans."
- CTA (30-40s) : "Si tu veux jeter un œil, lien en bio, et si t'as des retours ou des bugs à signaler, les commentaires sont grands ouverts, je réponds à tout."

### KPIs TikTok
- Vues totales et taux de complétion (watch-through rate) par vidéo
- Taux de partage (le plus corrélé à la portée organique sur cette plateforme)
- Nombre de commentaires (signal d'engagement fort, y compris négatif à traiter comme du feedback)
- Clics vers le lien en bio (UTM `tiktok`)
- Nombre de vidéos qui dépassent 10x la moyenne de vues du compte (signal de contenu à dupliquer/décliner)

---

## Urgence fenêtre TV Time — plan d'action J+0 à J+14 (12 → 26 juillet 2026)

La fermeture effective a lieu le 15/07 (J+3 par rapport à aujourd'hui). Le pic d'attention se joue en deux vagues : **avant fermeture** (urgence de sauvegarde de données, encore quelques jours) et **juste après fermeture** (bascule effective, recherche d'alternative la plus active).

| Jour | Reddit | Twitter/X | Instagram | TikTok |
|---|---|---|---|---|
| **J+0 à J+3 (12-15/07)** | Répondre dans les threads actifs "comment exporter mes données", pas encore de post d'annonce produit (priorité : aide pure, crédibilité avant promo) | Poster/épingler le rappel export RGPD (deadline), commencer la veille active des comptes tech FR qui couvrent la fermeture | Story quotidienne "compte à rebours" + rappel export, pas encore de Reel promo produit | Publier script 1 ("TV Time ferme dans 3 jours") dans les 24h — contenu à plus forte urgence, fenêtre courte |
| **J+4 à J+7 (15-19/07, bascule effective)** | Poster l'annonce transparente (post 2) dans 1-2 subreddits ciblés, une fois la fermeture actée et la recherche "par quoi remplacer" à son pic | Thread comparatif (tweet 2), forte cadence de réponses aux mentions TV Time/alternative | Lancer Reel démonstration compteur VHS + Reel storytelling fondateur | Script 2 et 3, viser 1 vidéo/jour sur cette fenêtre, c'est le pic d'opportunité |
| **J+8 à J+14 (20-26/07)** | Post comparatif factuel (post 3), commencer à répondre dans `r/SerieTV`/groupes FB une fois la vague initiale de threads "TV Time ferme" retombée | Maintenir cadence 4-6/semaine, basculer progressivement vers du contenu produit (moins réactif, plus "build in public") | Rythme de croisière 3-4 Reels/semaine | Rythme de croisière 4-5 vidéos/semaine, analyser quel script a le mieux performé et décliner |

**Action transverse immédiate (avant tout post)** : vérifier en direct l'état de charge du produit (import, matching TMDb, edge functions Supabase) avant de pousser du volume d'acquisition — un afflux réussi qui tombe sur un bug de sync ou une lenteur reproduirait exactement le problème qu'on reproche à Betaseries en ce moment. Point à faire valider avec `tvtrackd-developer` avant la vague J+4 à J+7.

---

## Growth loop et calendrier éditorial synthétique — 90 premiers jours

### Growth loop principal
1. Utilisateur TV Time/Betaseries frustré découvre tvtrackd via Reddit/TikTok/X (contenu réactif sur la fermeture)
2. Import immédiat de son historique (`.zip`/`.csv`) → moment de preuve de valeur rapide ("ouf, je n'ai rien perdu")
3. Usage récurrent via le rituel calendrier "Ce soir" + compteur VHS (mécanique de rétention produit, à coordonner avec `entertainment-product-expert`)
4. Partage naturel : stats/compteur visuellement partageables → capture d'écran postée par l'utilisateur sur Instagram/TikTok/X → nouvelle exposition organique
5. Nouveau visiteur exposé au contenu UGC → retour à l'étape 1

**Dépendance produit à transmettre** : ce loop repose sur le fait que les stats/compteur soient visuellement "partageables" (écran soigné, éventuellement une carte de stats exportable en image). À vérifier avec `entertainment-design-expert` si un gabarit de "carte stats à partager" (façon Spotify Wrapped) doit être conçu — fort potentiel de growth loop organique sur Instagram/TikTok, actuellement absent du MVP livré. Idem côté `tvtrackd-developer` : évaluer la faisabilité d'un endpoint de génération d'image de stats/carte de progression partageable, et de meta tags Open Graph soignés sur les pages fiche série pour que les liens partagés (Discord, groupes FB, X) affichent une preview engageante.

### Calendrier synthétique (par phase)

**Phase 1 — J0 à J14 : captation de la fenêtre TV Time** (détaillée ci-dessus)
Priorité absolue : Reddit + TikTok + X réactifs. Instagram en soutien léger.

**Phase 2 — J15 à J45 : consolidation et preuve produit**
- Reddit : AMA ou retour d'expérience détaillé, posts comparatifs approfondis
- X : bascule vers "build in public" (nouvelles fonctionnalités, roadmap transparente), continuer la veille Betaseries/Trakt
- Instagram : montée en cadence Reels (3-4/semaine), premier post UGC republié
- TikTok : identifier les 2-3 scripts qui ont le mieux performé en phase 1, les décliner en variantes (nouveaux hooks, mêmes mécaniques)
- Lancement d'un premier contenu SEO de fond (page ou article "Comment exporter ses données TV Time", "Alternative TV Time gratuite en français") — à transmettre comme besoin de page à `tvtrackd-developer`/`entertainment-product-expert` si pas déjà prévu

**Phase 3 — J46 à J90 : rétention et fidélisation communautaire**
- Reddit : présence continue mais réduite, focus sur le support communautaire (répondre aux questions techniques, bugs)
- X : cadence de croisière (2-3/semaine), community management réactif
- Instagram : contenu éditorial récurrent (rendez-vous hebdo sorties de la semaine via le calendrier), UGC régulier
- TikTok : cadence stabilisée (2-3/semaine), tester un format série récurrente (ex. "sortie de la semaine" en lien avec le rail Programme)
- Bilan des 90 jours : audit des KPIs par canal, réallocation des ressources vers les 1-2 canaux qui ont le meilleur ratio effort/résultat

---

## Matrice de priorisation (ressources limitées, équipe MVP)

| Plateforme | Effort de production | Vitesse de résultat attendue | Alignement avec la fenêtre TV Time | Priorité |
|---|---|---|---|---|
| **Reddit** | Faible (pas de production visuelle, temps de rédaction/veille) | Rapide sur l'intention d'achat, mais volume limité | Maximal — c'est le lieu de la recherche active | **1 — à démarrer immédiatement, dès aujourd'hui** |
| **TikTok** | Moyen (tournage/montage court mais nécessaire) | Potentiellement rapide et large si un contenu "prend" | Maximal — sujet déjà viral chez les créateurs séries | **1 — à démarrer immédiatement, en parallèle de Reddit** |
| **Twitter/X** | Faible à moyen (texte + captures, peu de production lourde) | Rapide pour la veille/réactivité, plus lent pour la conversion directe | Élevé — bon relais presse et créateurs | **2 — à activer dans la foulée, dès J+1 à J+2** |
| **Instagram** | Élevé (exigence d'identité visuelle soignée, Reels bien montés) | Plus lent, effet cumulatif sur l'image de marque | Modéré — utile en soutien, pas le moteur de la fenêtre critique | **3 — à construire en continu mais sans sacrifier Reddit/TikTok dessus dans les 14 premiers jours** |

**Recommandation d'allocation de ressources pour une petite équipe MVP** : si une seule personne pilote le social les 14 premiers jours, l'ordre d'effort doit être Reddit (veille + réponses) ≥ TikTok (1 vidéo/jour) > X (relais + veille) > Instagram (contenu minimal, un Reel réutilisé du TikTok suffit en phase 1 via republication cross-plateforme). Ne pas investir de temps de production Instagram dédié avant J+15 sauf si une ressource design/vidéo supplémentaire est disponible.

---

## Besoins transmis aux autres agents

- **`tvtrackd-developer`** : vérifier la capacité de charge du pipeline d'import (edge functions Supabase, matching TMDb) avant la vague d'acquisition J+4 à J+7 ; évaluer la faisabilité d'un endpoint de génération d'image "carte de stats partageable" ; soigner les meta tags Open Graph sur les pages fiche série et profil pour des previews de lien engageantes sur X/Discord/Facebook.
- **`entertainment-design-expert`** : concevoir un gabarit de "carte stats partageable" (façon Spotify Wrapped, cohérent avec la palette amber/cyan et le compteur Plex Mono) pour alimenter le growth loop organique Instagram/TikTok ; fournir des assets de démonstration du compteur VHS en haute qualité pour les Reels/TikToks (capture propre, pas de watermark de développement).
- **`entertainment-product-expert`** : arbitrer la priorité d'un contenu SEO de fond (pages "alternative TV Time", "exporter mes données TV Time") dans la roadmap produit si cela nécessite de nouvelles routes ; arbitrer si un mécanisme de partage social natif (ex. bouton "partager mes stats") doit entrer au backlog compte tenu du potentiel de growth loop identifié ci-dessus.
- **Utilisateur (décision à fort impact, non tranchée par cet agent)** : validation finale du nom de marque avant réservation définitive des handles sociaux et impression d'assets visuels durables ; arbitrage sur l'investissement (temps/budget) à allouer à la production Instagram/TikTok si les ressources humaines de l'équipe sont limitées à une seule personne sur le volet marketing.
