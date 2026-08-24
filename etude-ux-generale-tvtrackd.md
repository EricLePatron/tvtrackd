# Étude UX générale tvtrackd — État des lieux produit (compréhension · irritants · feature manquante · killer feature)

> **Portée.** Cette étude est un **état des lieux général de tout le produit** (compréhension, import, bibliothèque, profil, fiche, auth, erreurs, navigation) — elle **complète** et ne duplique pas `etude-ux-tvtrackd.md`, qui reste centrée sur la home et ses 5 états.
>
> **Base triple, statut de vérité différencié.**
> - **Socle code** = lecture réelle du dépôt par l'agent développeur, sur `claude/user-research-ux-features-v2o5qx` (HEAD `eabc2c2`), chemins de fichiers et numéros de ligne à l'appui. → **Fiable** (c'est ce qui existe à l'écran aujourd'hui).
> - **Signaux utilisateurs** = **recherche simulée** sur un panel fictif de ~100 profils, construit à partir des personas de `CLAUDE.md` et des irritants documentés du secteur (TV Time, BetaSeries, Trakt, Letterboxd, Serializd, Simkl). Les « **X/100** » sont des **signaux qualitatifs de priorisation, pas des mesures terrain**.
> - **Arbitrages produit** = lecture croisée code × recherche par l'agent produit (roadmap, killer feature).
>
> **Contexte temporel décisif.** On est le **24/08/2026**. TV Time a fermé le **15/07/2026** : la fenêtre de migration est **active mais se referme**. Le JTBD dominant du migrant n'est plus « je cherche un remplaçant » mais « **je veux la garantie que ça ne m'arrivera plus jamais** ».

---

## 0. Verdict en une page

Le socle technique est **sain et même en avance** sur un MVP Lovable typique (l'optimistic UI de `use-mark-watched.ts` gère des rafales concurrentes et un rollback ciblé par épisode que beaucoup de trackers commerciaux ne gèrent pas). Le vrai risque n'est **pas un manque de fondations** — c'est un **écart entre l'exécution réelle et sa perception**, précisément le terrain sur lequel tvtrackd prétend battre BetaSeries.

Deux défauts confirmés par le code **donnent à l'utilisateur des preuves à charge contre le pilier « fiable »** : une **statistique qui ment** (« Revisionnages » figée à 0 pour tout le monde) et un **404 en anglais** dans une app 100 % FR. Ce sont exactement les « petits ratés d'exécution » que BetaSeries accumule depuis des années — donc disqualifiants pour la thèse produit, et à coût de correction quasi nul.

- **Killer feature à jouer maintenant** : **rendre l'export / la mémoire durable visible et incarné partout** — c'est déjà construit, il faut le mettre en scène. C'est un pari à exécuter en jours, pas en sprints, qui touche ≥ 52/100 du panel et occupe un angle de marque vacant chez tous les concurrents.
- **Pari secondaire séquencé après** : **notifications push fiables** — feature la plus consensuelle du panel, mais **prérequis technique absent** (pas de PWA / service worker), donc un vrai chantier d'infra à faire **bien et plus tard** plutôt que vite et mal.

---

## 1. Compréhension du produit

### Ce qui passe (confirmé code)
La **promesse anti-lock-in / export** est écrite tôt et fort, à trois endroits : onboarding carte 3 (« Vos données ne sont jamais piégées ici »), landing SEO `/alternative-tv-time` (FAQ RGPD : *« Mes données pourront-elles un jour être prises en otage comme sur TV Time ? Non… c'est un principe de conception »*), et micro-copie de l'onglet **Archivé** de la bibliothèque (« rien n'est jamais perdu, tout reste exportable » + lien export direct) — posée exactement là où l'angoisse migrant est maximale, sur le point précis où BetaSeries casse l'accès à l'historique.

### Où ça se perd
- **Le meilleur argumentaire n'est pas là où se prend la première décision.** Un visiteur qui atterrit directement sur `/` (pas via une recherche « alternative TV Time ») ne voit que le hero démo Breaking Bad (badge « Exemple », non interactif) + l'onboarding. La FAQ RGPD et la mécanique de dédoublonnage à la ré-import ne sont atteintes que via un lien discret. **Signal simulé : 34/100** ont compris *que* leurs données seraient exportables, mais pas *comment* avant d'arriver sur l'écran d'import.
- **BetaSeries n'est jamais nommé** dans le parcours anonyme. Pour le segment **déçu BetaSeries (22/100)**, la proposition « on exécute mieux que BetaSeries » ne se lit **nulle part** — **41/100** de ce segment finissent le parcours sans savoir *pourquoi* tvtrackd serait plus fiable. Ils l'espèrent ; rien ne l'affirme ni ne le prouve (pas de page statut, pas de changelog).
- **« Fiable » est une promesse texte, jamais démontrée par une preuve produit.** Aucun signal de continuité opérationnelle. Pour un public traumatisé par une fermeture soudaine, **la confiance se construit ici uniquement par l'usage**, pas par le discours.
- **Le 3ᵉ pilier CLAUDE.md — « social / découverte qui marche » — est invisible en anonyme** (cohérent avec le MVP, mais les segments social/casual n'ont aucune promesse à laquelle se raccrocher).

**Verdict par segment** — Migrant TV Time : compréhension forte *si* entrée via landing, incomplète si entrée directe. Déçu BetaSeries : **compréhension faible du différenciateur** (le produit ne parle jamais leur langue de douleur). Binger / complétiste / social / casual : neutre (onboarding générique).

---

## 2. État des lieux des irritants (priorisé)

| Prio | Irritant | Écran(s) | Signal simulé | Confirmé code | Nature |
|---|---|---|---|---|---|
| **P0** | Stat **« Revisionnages » structurellement figée à 0** pour tout utilisateur — une carte visible qui *ment* silencieusement | Profil (`stats-section.tsx:68-69`) | 52/100 | **Oui** — `watch_count` toujours upserté à 1 (`use-mark-watched.ts:344-352`) ; le calcul `Σmax(0, wc-1)` est correct, c'est la **donnée source** qui ne dépasse jamais 1 | Friction réelle — pire ennemi du mot « fiable » |
| **P0** | **Wording d'erreur 404/500 en anglais** (« Page not found », « This page didn't load ») dans une app FR, au moment où la confiance est la plus fragile | Global (`__root.tsx:17-22`, `<html lang="fr">` pourtant posé l.147) | 38/100 | **Oui** | Friction réelle — signal d'amateurisme exactement du type reproché à BetaSeries |
| **P0/P1** | **Import : matching 100 % manuel sans score de confiance ni candidat pré-sélectionné** sur les ambiguïtés, pour des bibliothèques de 100-300 séries | Import (`import-run.$runId.tsx`) | 44/100 | **Oui** — mais **le score existe déjà côté serveur** (`import-history/index.ts:197-211`, seuils 0.6/0.7), simplement jamais persisté ni renvoyé pour les items non matchés | Friction réelle — **quick win** : la donnée est là, il manque la tuyauterie |
| **P1** | **Positionnement vs BetaSeries absent** du parcours anonyme | Onboarding / home anon / landing | 41/100 (déçu BS) | N/A (absence de contenu) | Attente non couverte → marketing |
| **P1** | **Pas d'undo** (« toast + Annuler ») après un marquage, y compris groupé | Home / fiche / biblio | 29/100 | **Oui** — la mécanique de rollback ciblé existe déjà dans le hook, déclenchée seulement sur erreur réseau | Friction réelle, effort quasi nul |
| **P1** | **Marquage groupé de saison absent de la bibliothèque** (seulement sur la fiche série) — or la biblio est l'écran naturel du binger en rattrapage | Bibliothèque | 41/100 (binger) | **Oui** — pattern `season-toggle.tsx`/`show-toggle.tsx` déjà présent en fiche, à réexposer | Job-to-be-done binger mal servi là où il devrait l'être |
| **P1** | **Import films « en cours d'amélioration »** (aveu explicite en FAQ) | Import (`import.tsx`) | 33/100 | **Oui** (aveu produit) | Attente non couverte, honnêtement documentée |
| **P1** | **Découverte non personnalisée** — rail « Découverte » = TMDb trending générique ; « Vous aimerez aussi » = TMDb similar, identique pour tous | Home / fiche | 35/100 | **Oui** | Attente non couverte (cohérent MVP — pas un bug) |
| **P2** | **Note (StarRating) strictement privée** — pas de commentaire, pas de destination visible pour qui vient de Serializd/Letterboxd | Fiche | 26/100 (social) | **Oui** | Attente non couverte |
| **P2** | **Confirmation obligatoire sur tout démarquage** (même un épisode isolé) — sûr mais lourd pour la correction rapide | Fiche | 17/100 (complétiste) | **Oui** | Tension sécurité ↔ vitesse à trancher |
| **P2** | **Profil hors bottom nav** → export peu découvrable au moment où le migrant en a le plus besoin comme réassurance | Nav globale (`bottom-nav.tsx:11-16` = Accueil/Calendrier/Recherche/Bibliothèque, **aucun item Profil**) | 18/100 | **Oui** — plus radical qu'un simple « profil déplacé » : inatteignable depuis la nav principale | Friction de découvrabilité (diverge aussi de la spec CLAUDE.md) |
| **P2** | **Auth Apple/Microsoft non câblées** (seul Google OAuth marche) | Auth | 14/100 | **Oui** | Attente non couverte, faible volume |
| **P3** | **Pas de PWA installable / service worker** — pas d'icône d'accueil, prérequis manquant aux notifications push | Global | 22/100 | **Oui** | Attente non couverte + prérequis technique |

**Lecture transverse :** les deux P0 confirmés sont des **incohérences de finition** sur un produit dont le reste de la copie FR est soigné. C'est précisément le type de détail qui alimente, chez BetaSeries, le narratif « ça sent l'à-peu-près » que tvtrackd veut combattre — pour un coût de correction dérisoire.

---

## 3. Feature manquante la plus criante (par intensité de demande)

| Rang | Feature | Intensité / segments | Pourquoi |
|---|---|---|---|
| **1** | **Notifications push « nouvel épisode »** | Quasi tout le panel (migrant, binger, complétiste) | Le calendrier existe mais reste **passif** — il faut ouvrir l'app. TV Time notifiait systématiquement : réflexe acquis. **Prérequis absent** : pas de PWA/SW dans le repo → à construire de zéro |
| **2** | **Rewatch réel** (historique par visionnage, pas un booléen) | Fort chez complétiste/data + migrants | Lié au P0 « Revisionnages = 0 ». Au-delà du bug de stat, c'est un rituel central du binge et un des 3 piliers JTBD (« mémoire durable »). **Le schéma `watch_status` est déjà conçu pour ça** — dette d'UI, pas refonte de données |
| **3** | **Reco personnalisée** | Fort chez social/casual, transversal | Le rail actuel ne fait *pas pire* que le bot BetaSeries cassé, mais pas mieux — statu quo, pas différenciateur. CLAUDE.md l'exige « correcte dès le départ » |
| **4** | **Social / reviews** (feed, follow, commentaire) | Fort mais concentré (10/100 social) | Attendu par une minorité bruyante (Serializd/Letterboxd), explicitement phase 2 CLAUDE.md |
| **5** | **Import Trakt** | Modéré, plus faible qu'attendu | Les vrais utilisateurs Trakt (power-users) migrent peu ; la demande vient surtout de ceux qui ont testé Trakt en dépannage post-TV Time |
| **6** | **Preuve de sync multi-device visible** | Fort spécifiquement chez déçu BetaSeries | Traumatisme précis (« je marque sur mobile, ça n'apparaît pas sur le web »). Aujourd'hui **aucun signal explicite de synchro** — l'optimistic UI est invisible par construction (force en usage, mais ne rassure pas ce segment échaudé) |
| **7** | **PWA / mobile installable** | Modéré, transverse | Prérequis à #1, attendu par réflexe chez binger/casual |

---

## 4. Killer feature — arbitrage

Évaluation des trois pistes sur JTBD × taille de segment × différenciation vs BetaSeries × faisabilité réelle (code à l'appui) :

| Piste | JTBD | Segment | Différenciation | Faisabilité |
|---|---|---|---|---|
| **A. Mettre en scène l'export / portabilité déjà construit** | Émotionnel : « plus jamais le 15/07 » | ≥ 52/100 (migrants + déçus BS) | **Fort** — angle de marque vacant chez *tous* les concurrents | **Quasi nulle en dev** — back + front existent |
| **B. Notifications push fiables** | Fonctionnel n°1 | Transversal | **Fort** — point faible documenté de BetaSeries | **Élevée** — PWA + SW + Web Push + scheduler par épisode + tokens par device, à construire de zéro |
| **C. Matching import à haute confiance** | Fonctionnel, étroit | Moment d'onboarding | Bon mais limité à un instant | Déjà traité en quick win P0 (§2) |

### ▶ Recommandation : parier sur **A** en principal, **B** en secondaire séquencé après.

- **Fenêtre temporelle** : 6 semaines après la coupure, le JTBD migrant est « garantis-moi que ça ne se reproduira plus ». **A y répond avec une feature déjà construite** — exécutable et mesurable en jours.
- **Taille** : A touche mécaniquement ≥ 52/100. B est transversal mais *attendu* (tout tracker sérieux finit par l'avoir) donc moins différenciant à exécution égale.
- **Différenciation** : aucun concurrent du benchmark n'a fait de l'anti-lock-in un pilier de marque — angle vacant, renforcé par l'actualité.
- **Risque** : A ne demande aucun dev de logique métier (mise en scène produit + design + contenu marketing). B porte un risque nommé : livrer une version bancale de notifications reproduirait *exactement* le défaut BetaSeries qu'on veut dépasser. **Jalon explicite : ne pas communiquer sur les push tant que la fiabilité de delivery n'est pas testée en conditions réelles.**

---

## 5. Arbitrage reco perso vs social/reviews vs rewatch réel

La recherche a laissé l'arbitrage ouvert ; le produit tranche : **rewatch réel > reco perso > social/reviews**.

| Feature | Segment | Valeur | Effort | Risque |
|---|---|---|---|---|
| **Rewatch réel** | Complétiste/data + migrants | Élevée mais étroite — **referme un P0** (la stat qui ment) | **Faible-moyen** — schéma `watch_status` déjà prêt, il manque l'UI de re-marquage + incrément (au lieu d'écraser à 1) | Faible |
| **Reco perso** | Casual + découverte, transversal | Moyenne-élevée à terme | **Élevé** — nouvelle brique data + algo, itération longue | **Élevé** — une reco médiocre livrée vite est *pire* que pas de reco (piège BetaSeries) |
| **Social/reviews** | Cinéphile/Letterboxd-like (minorité bruyante) | Moyenne — fort pour un segment, absent du JTBD dominant actuel | **Élevé** — pivot de modèle de données (profils publics, follow, vie privée, modération) | Moyen-élevé — CLAUDE.md le conditionne à « si traction MVP bonne » |

1. **Rewatch réel d'abord** — ce n'est pas une « nouvelle feature » mais la **résolution d'une dette P0** ; masquer la stat en Now est un pansement temporaire assumé, le rewatch réel est la vraie fix, et le schéma est déjà prêt. Meilleur rapport effort/valeur des trois.
2. **Reco perso ensuite** — à condition de respecter « correcte dès le départ » (CLAUDE.md) : V1 à scope réduit (heuristique genres/cast/showrunners suivis + historique de complétion), **pas** un moteur collaboratif improvisé en 2 semaines.
3. **Social/reviews en dernier** — valeur réelle mais pivot de données non-trivial touchant la vie privée, minorité, et conditionné à une traction MVP encore non mesurée.

---

## 6. Roadmap séquencée

**Now (0-3 sem., avant/en parallèle de tout nouveau chantier) — quick wins P0**
Ordre recommandé : **wording FR → masquer stat Revisionnages → remonter l'export dans la nav → score de confiance import → marquage groupé biblio → undo.**
Les deux premiers arrêtent un dommage actif (on cesse de mentir / de paraître non-fini) pour un coût quasi nul.

**Next (le trimestre) — killer feature + prérequis, puis rewatch réel**
- Mise en scène complète du pilier « mémoire durable » (killer feature A) : preuve permanente de portabilité, positionnement anti-lock-in dès l'entrée directe sur `/`, BetaSeries nommé dans le parcours anonyme (→ marketing).
- **Rewatch réel** (UI de re-marquage + incrément `watch_count`), remplace le pansement du Now.
- Démarrage du chantier **PWA / service worker** — livré et testé *avant* toute communication sur les notifications.

**Later (conditionné traction & retours) — reste du backlog CLAUDE.md**
Notifications push (une fois la PWA stabilisée) · Moteur de reco V1 à scope réduit · Import Trakt (dépriorisé, plus faible qu'attendu) · Social/reviews (si traction confirmée) · Scrobbling · PWA installable complète · Apple/Microsoft auth · TheTVDB (uniquement si pain point horaire réel).

---

## 7. Renvois aux autres agents (sans coder)

- **Design** — mise en scène du pilier export (bannière/preuve post-import, éventuel élément signature type compteur VHS pour visualiser « X années sécurisées ») ; écran d'import avec score + candidat pré-sélectionné sans casser le pattern manuel existant ; **arbitrage d'IA de la bottom nav** (remplacer un item ? passer à 5 ? sous-menu profil ?) — à trancher en design, pas en dev.
- **Marketing** (`marketing-communication-expert`) — nommer BetaSeries/TV Time dans le parcours anonyme (lever le « 41/100 ne savent pas pourquoi c'est plus fiable ») ; produire une **preuve de fiabilité** (page statut / changelog léger) ; cadrer la temporalité de com sur les push (pas d'annonce avant fiabilité testée).
- **Dev** (`tvtrackd-developer`) — quick wins P0, puis rewatch réel (UI + incrément `watch_count`), puis PWA/SW, puis reco V1 — dans cet ordre, RLS et cache TMDb respectés.
- **QA** (`tvtrackd-qa-reviewer`) — non-régression systématique sur `use-mark-watched.ts` (rafales concurrentes, rollback ciblé) lors de l'ajout de l'undo et du rewatch réel, avant tout merge.

---

## 8. Limites & confirmation primaire

- **Signaux utilisateurs 100 % simulés** — aucun verbatim recueilli auprès d'un utilisateur réel ; reconstructions plausibles ancrées personas + irritants documentés du secteur, non des citations sourcées.
- **Biais de panel** — sur-pondération volontaire des segments « en recherche active » (migrant + déçu BS), cohérente avec le 24/08/2026 mais qui gonfle les signaux import/confiance vs une base installée.
- **Faits « confirmé code »** — vérifiés par lecture directe des fichiers cités ; fiables à ce titre, mais restent une lecture de code, pas un test d'usage observé.
- **Point le plus critique à valider en premier** : le parcours d'import avec un **vrai** export TV Time/BetaSeries volumineux (100-300 séries) en think-aloud.

**Pour confirmer en primaire** : 8-12 entretiens semi-directifs (migrant TV Time / déçu BetaSeries / binger) avec (1) test d'import guidé sur un vrai fichier du participant, observé ; (2) parcours anonyme jusqu'à inscription, en mesurant à quel moment le participant articule spontanément la différence avec BetaSeries ; (3) usage biblio/fiche sur une semaine réelle pour capter les irritants de marquage/undo en contexte.

---

### Annexe — verbatims simulés représentatifs

- **Migrant TV Time** : *« J'ai regardé s'il y avait un export AVANT même d'utiliser l'appli sérieusement… j'aimerais le revoir une 2ᵉ fois une fois que j'ai mes 1200 épisodes dedans, pas juste à l'inscription. »* · *« Sur trois animes j'ai dû chercher moi-même le bon titre parmi 4 versions — sur TV Time y'avait au moins une suggestion. »*
- **Déçu BetaSeries** : *« Je ne sais toujours pas ce que cette appli fait mieux que BetaSeries concrètement… ça n'a pas buggé en 20 min, mais BetaSeries non plus au début. »* · *« Je suis tombé sur un message d'erreur en anglais — ça m'a fait tiquer, je pensais que c'était une appli française à 100 %. »*
- **Binger** : *« J'aimerais cocher toute la saison d'un coup depuis ma bibliothèque, pas devoir retourner sur la fiche. »* · *« J'ai marqué un épisode par erreur en scrollant vite, pas de bouton "annuler". »*
- **Complétiste/data** : *« "Revisionnages : 0" alors que je viens de refaire toute une saison de The Wire, ça casse la confiance dans le reste des chiffres. Si celui-là ment, pourquoi je croirais les autres ? »*
- **Social/Letterboxd-like** : *« Je note avec les étoiles mais je ne sais pas où ça va, ça reste privé — sur Serializd je peux au moins écrire un avis. »*
- **Casual** : *« "Fiable, simple, gratuit", c'est ce que toutes les applis disent. »* · *« Je m'attendais à pouvoir l'installer comme une appli, avec une icône. »*
