# Workflow de partage — spec courte

Statut : proposition (2026-10-27). Aucun code. Critère de priorisation : impact sur segment / effort / risque (RICE allégé).
Segments : social/casual, binger, cinéphile-critique, sensible aux spoilers.

> **Décisions produit (2026-10-27)** — priment sur le reste de ce document :
> - **Épisode** : la carte utilise l'**image de l'épisode** (still TMDb), pas l'affiche de la série.
> - **Série entière** : **abandonné**. Pas de carte « série », pas de bouton « Partager ma progression », pas de toast « Série terminée · Partager ».
> - Cas retenus : **épisode** et **ma semaine**. Parcours de référence : artefact « Parcours de partage ».

## 1. État actuel (constaté dans le code + 4 captures iPhone)

Points d'entrée (tous opt-in, aucune ouverture automatique) :
- Épisode : icône Share2 sur chaque ligne d'épisode déjà vu (`show.$mediaType.$tmdbId.tsx`, prop `share`).
- Saison : bouton « Partager cette saison » visible seulement si `seasonState === true`.
- Série entière : aucun point d'entrée. La capture 4 (« 8 épisodes vus ») est en fait la carte « saison ».
- Semaine : inexistant.
- `use-mark-watched` ne déclenche pas la modale : pas d'intrusion après chaque épisode marqué. Le risque est inverse : la découvrabilité est faible, le partage est enfoui dans l'accordéon des saisons de la fiche.

Parcours Instagram Story actuel (iPhone) :
1. Tap icône partage (fiche > saison dépliée > ligne épisode) ; 2. modale ; 3. « Partager en story » ; 4. feuille iOS ; 5. Instagram ; 6. choix Reel/Publication/Story/Message ; 7. éditeur ; 8. « Vos stories » ; 9. envoyer.
= 8 à 9 taps, dont 4 imposés par l'OS / Instagram (feuille iOS, choix du format, éditeur, envoi).

Frictions :
- F1 : la modale n'ajoute qu'un tap de confirmation avant la feuille iOS. Elle sert surtout d'aperçu.
- F2 : l'image est partagée via `navigator.share({files})`, donc Instagram la traite comme une image générique (choix Reel/Publication/Story/Message). Le lien n'est pas porté par l'image : il est copié dans le presse-papiers (`copyText(instagramUrl)`) sans que l'utilisateur le sache, et doit être collé à la main. En pratique il n'y a pas de lien cliquable.
- F3 : la carte « saison » (capture 4) : le bloc CTA orange chevauche le titre « Cat's Eyes », et l'image est coupée par l'UI Instagram. Défaut de mise en page à corriger (SAFE_BOTTOM / calcul `ctaY` dans `share-card.ts`).
- F4 : le sous-titre « Extraction » de la capture 3 est lisible ; la carte épisode est correcte. Le texte « 8 épisodes vus » est peu valorisant pour une saison (pas de durée, pas de note).
- F5 : l'icône X est Twitter (oiseau) ; le bouton X télécharge l'image sans prévenir avant d'ouvrir le tweet.
- F6 : la carte contient un still d'épisode : risque de spoiler (segment sensible aux spoilers), sans option.

Levier principal : réduire les taps côté tvtrackd (supprimer la modale quand l'aperçu n'apporte rien) et rendre la carte autoportante. Les 3-4 taps Instagram ne sont pas compressibles sans l'API Instagram Sharing to Stories (voir Plus tard).

## 2. Benchmark rapide (connaissance générale, à vérifier avant d'argumenter publiquement)

| Produit | Mécanique de partage | Enseignement |
|---|---|---|
| TV Time | Cartes de partage et stats annuelles, partage natif (service fermé le 15/07/2026) | Le récap annuel était un moteur viral ; vérifier le détail des flux avant copie |
| Letterboxd | Lien public par film/critique/liste, aperçu OG, récap annuel, profil public | Le lien (page + OG) est l'objet central ; l'image est secondaire |
| Serializd | Pages publiques de reviews et diary, partage de liens | Idem : la page publique crée la valeur |
| Spotify Wrapped / Strava | Carte verticale générée, un bouton « Partager » avec boutons directs « Stories » (API de partage dédiée), rythme périodique, fierté chiffrée | Peu de taps, carte visuelle chiffrée, déclencheur calendaire. Détail des intégrations Stories à vérifier |

À vérifier par WebSearch si on veut citer : disponibilité de l'API Instagram « Sharing to Stories » pour une PWA/web (je crois qu'elle est native mobile uniquement : une web app n'a pas de deep link `instagram-stories://`, à confirmer).

## 3. Propositions

### 3.1 Points d'entrée

| Contexte | Entrée | Priorité |
|---|---|---|
| Épisode | Garder l'icône sur la ligne vue. Ajouter dans le toast de marquage vu une action « Partager » (non bloquante, 5 s, jamais de modale auto). Le toast ne s'affiche que pour l'utilisateur ayant déjà partagé une fois ou en dernier épisode d'une saison, pour éviter le harcèlement | MVP |
| Saison / série terminée | Quand le statut passe à `termine` ou saison complète : toast « Série terminée — partager ? » + bouton en tête de fiche (hors accordéon). Ajouter une carte « série » (affiche, nb saisons, nb épisodes, temps total en Plex Mono) | MVP |
| Semaine | Carte « Ma semaine » : bouton sur l'accueil (section discrète sous le Programme, visible dès 3 épisodes vus dans la période) et sur le profil. Notification dimanche soir en phase 2 (dépend des push, hors MVP) | MVP (accueil + profil), notif plus tard |

### 3.2 Réduction de friction dans la modale
- Devenir une « feuille » (bottom sheet) avec aperçu et un seul bouton primaire. Sur mobile avec `navigator.canShare`, le bouton principal s'appelle « Partager » (feuille OS = Messages, WhatsApp, Instagram sont tous là) ; « Story Instagram » n'est pas un chemin distinct tant qu'on n'a pas d'API dédiée. Ne pas promettre « story » dans le libellé : la feuille mène à un choix de format chez Instagram.
- Générer la carte en préchargement (à l'ouverture de la fiche ou au marquage) pour supprimer le spinner.
- Un second geste utile : « Copier le lien » met le lien en avant (voir 3.3).
- Corriger F3 et utiliser une icône X correcte ; indiquer l'action réalisée.

### 3.3 Contenu du lien partagé
Option A (MVP) : lien vers la fiche publique existante `/show/:mediaType/:tmdbId` + utm. Zéro donnée perso, aucun risque de confidentialité, mais ne montre pas « qui a vu quoi ».
Option B (Plus tard) : page publique de partage `/s/:token` (épisode, série ou semaine) avec OG image rendue côté serveur (Worker) et CTA « Rejoindre / importer ». Demande : table `shares` (token aléatoire, user_id, type, payload figé, created_at, revoked_at), RLS stricte (lecture publique par token uniquement, écriture owner), génération OG serveur (nouvelle surface, à chiffrer).
Recommandation : A au MVP, B dès que la semaine est livrée et utilisée. Décision à trancher par l'utilisateur car B introduit une table et une page publique (changement du modèle de données).

Points techniques MVP : joindre le lien au `navigator.share` (champs `text`/`url` avec `files`) quand la plateforme l'accepte, sinon copie. Attention : iOS gère mal `files` + `url` pour certaines cibles ; tester. Les OG tags de la fiche existent déjà (`og:image` présent dans la route).

### 3.4 Définition de « semaine »
Options :
- Lundi-dimanche calendaire (fuseau du profil) : cohérent avec un récap du dimanche soir, stable, comparable d'une semaine à l'autre. Inconvénient : lundi/mardi, la semaine en cours est quasi vide.
- 7 jours glissants : toujours rempli, pas lié au rituel dimanche.
Recommandation : lundi-dimanche pour le récap officiel et la notif ; avant le dimanche, afficher « Cette semaine (en cours) ». Fallback : si la semaine en cours a moins de 3 épisodes et que l'on est lundi-mardi, proposer « 7 derniers jours ». À valider : fuseau (utiliser l'heure locale du device, `watched_at` est un timestamp UTC).
Source de données : `watch_status.watched_at` (une ligne par visionnage, rewatchs inclus). Choix produit à trancher : compter les rewatchs ou non (je propose oui, étiquetés « revus » ; non inclus dans « nouvelles séries »).

Contenu de la carte semaine : période (S43 · 19-25 OCT), compteur épisodes (Plex Mono, signature VHS), temps total, série la plus regardée (affiche), 3-4 affiches max, jamais de liste exhaustive. Pas d'autre effet décoratif (cf. CLAUDE.md).

### 3.5 Confidentialité
- Défaut : rien n'est publié ; le partage est toujours un geste explicite de l'utilisateur.
- Carte épisode : toggle « Masquer l'image de l'épisode » (affiche de série à la place du still) — répond aux spoilers ; par défaut affiche série pour les épisodes de la saison en cours de diffusion ? (choix à trancher).
- Carte semaine : option « Masquer les titres » (compteur + temps seulement) et choix des séries incluses (cases à décocher avant partage). Utile pour contenu sensible.
- Pas de nom d'utilisateur ni avatar sur la carte par défaut (case « Afficher mon pseudo »). Le profil reste privé (aucune page profil publique n'existe aujourd'hui).
- Option B : jeton non devinable, révocable depuis le profil, payload figé à la création (pas de fuite d'activité ultérieure), `noindex`.
- RGPD : le partage est volontaire, aucune donnée envoyée à un tiers par tvtrackd hors fichier choisi.

## 4. Priorisation

MVP (effort faible, impact élevé pour social/casual et binger) :
1. Corriger la carte (chevauchement CTA, F3) et partir d'une feuille unique « Partager » avec lien joint.
2. Toast post-marquage avec action « Partager » (fin de saison / dernier épisode ; jamais de modale auto).
3. Carte « série terminée » + entrée en tête de fiche.
4. Carte « Ma semaine » (lundi-dimanche) depuis accueil et profil, toggles de confidentialité (titres masqués, image série).
5. Mesure : utm déjà posés ; ajouter événements `share_open`, `share_complete`, par type, pour décider de la suite.

Plus tard :
- Page publique `/s/:token` + OG image serveur (décision modèle de données).
- Notification dimanche (dépend des push, hors scope MVP).
- Récap annuel (style Wrapped), format carré / feed, GIF animé du compteur.
- Intégration native Stories (API Instagram) : exige une app native ; pas pour une web app.
- Partage entre amis in-app : dépend du social feed (phase 2).

## 5. Décisions à trancher par l'utilisateur
1. Page publique (Option B) maintenant ou après le MVP ?
2. Les rewatchs comptent-ils dans la semaine ?
3. Image de l'épisode par défaut (spoiler) ou affiche de série ?
4. Toast de partage : fréquence et conditions (pas de harcèlement).
5. Valider par WebSearch les points marqués « à vérifier » avant de les citer.
