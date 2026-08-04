# État des lieux tvtrackd — étude croisée site complet (août 2026)

> **Étude d'équipe** menée à la demande du porteur produit : un état des lieux de **tout le site dans sa version actuelle**, la perception qu'en ont les utilisateurs, et ce qui manque pour qu'ils l'utilisent **tous les jours** (design, UX, features core). Quatre agents ont travaillé ensemble : `tvtrackd-developer` (revue de code / cadrage de la bonne version), `ux-researcher` (test simulé ~100 utilisateurs), `entertainment-product-expert` (priorisation & benchmark), `entertainment-design-expert` (revue design/UX transversale).
>
> Complète — sans le remplacer — `etude-ux-tvtrackd.md`, qui restait focalisé sur le seul état d'accueil `upcoming_only`. Ici on élargit à l'ensemble du site.

---

## 0. Cadrage méthodologique — la « bonne version » et les limites

**Base double, à ne jamais confondre :**

- **L'état du produit** décrit ici provient d'une **lecture réelle du code** (branche courante, chemins + numéros de ligne à l'appui). C'est du fait, pas de la conjecture.
- **La perception utilisateur** provient d'une **recherche simulée** : panel fictif de ~100 profils projetés sur les personas de `CLAUDE.md`, ancré sur le comportement réel de l'interface. **Tous les « X/100 » sont des signaux de priorisation qualitatifs, pas des mesures terrain.** Aucun utilisateur réel n'a été observé, aucun verbatim n'est une citation réelle.

**Version étudiée (garantie par la revue de code) :**

- Branche `claude/user-research-site-study-e72bdi` = **strictement identique à `main`** (même commit `7443969`, `0 0` d'écart). Aucun risque d'avoir étudié un écran obsolète ou une branche divergente.
- **Aucune URL de production n'est committée dans le repo.** `SITE_URL` (`src/lib/app-config.ts`) a un fallback `https://tvtrackd.com` explicitement documenté comme placeholder. Le déploiement passe par l'infra Lovable (Cloudflare). ➜ **Point à trancher avec le porteur produit avant de router de vrais testeurs quelque part** : le repo seul ne suffit pas à désigner « la version en ligne ». L'étude qui suit est donc une simulation ancrée sur ce code exact, pas un test sur trafic réel.
- **Aucune analytics produit en prod** (ni Sentry, ni PostHog, ni GA/Plausible). Conséquence structurelle : la rétention J1/J7/J30 réelle est aujourd'hui **non mesurable**. Toute priorisation de rétention reste une hypothèse tant que ce point aveugle n'est pas instrumenté.

**Recalage important vs `etude-ux-tvtrackd.md` :** plusieurs P0 que l'ancien dossier documentait comme ouverts sont **déjà corrigés dans le code actuel** et ne doivent pas être re-remontés (voir §2 pour le détail).

---

## 1. Points de vérité (à ne pas contredire)

Établis par revue de code réelle. Toute recommandation en aval doit rester cohérente avec ces faits.

1. **Accueil connecté = 5 états réels et différenciés** (`no_shows`, `all_caught_up`, `upcoming_only`, `ready_only`, `normal`) + un accueil visiteur anonyme (démo statique). C'est l'écran le plus abouti du produit (`src/routes/_public/index.tsx`, `src/lib/schedule.ts`).
2. **Le rewatch n'est PAS historisé** dans l'usage normal de l'app : `watch_status` porte une contrainte `UNIQUE(user_id, episode_id)` — en pratique un booléen vu/pas-vu par épisode. Décocher = `DELETE`. Seul l'**import** incrémente réellement `watch_count`. ➜ contradiction directe avec ce qu'annoncent `CLAUDE.md`/`README`.
3. **Le tracking de film est status-only** : aucune date de visionnage, aucun rewatch, aucune UI épisode. La promesse « séries **et** films » n'est tenue qu'à moitié.
4. **Absents réels** (pas des angles morts de lecture) : notifications push/email, moteur de recommandation (le rail « À découvrir » = tendances TMDb génériques, honnêtement libellées), profil public/social, auth sociale, undo volontaire de démarquage, **PWA installable** (aucun `manifest.json`).
5. **`/admin` existe et est fonctionnel** mais verrouillé au seul fondateur (RLS + `has_role`, seed sur un email unique) — **hors périmètre de tout test utilisateur**.
6. Le nom **« tvtrackd » reste hardcodé** à plusieurs endroits (meta/JSON-LD `__root.tsx`, `auth.tsx`, nom du fichier d'export) malgré la consigne `CLAUDE.md` de ne rien committer avant arbitrage de marque. La constante `APP_NAME` existe mais n'est consommée qu'à moitié.

---

## 2. Ce qui a bougé depuis `etude-ux-tvtrackd.md` (à ne pas re-traiter)

| Ancien P0/P1 | État réel dans le code | Source |
|---|---|---|
| Carte countdown lue comme « vide/cassé » (P0) | **Fermé.** `NothingNowCountdownTicket` retiré ; `upcoming_only` rend désormais `NextReleaseHeroCard` — backdrop plein cadre, jamais `border-dashed`. | Design/UX |
| Carte countdown non cliquable (P1) | **Fermé.** Toute la carte est un `<Link>`. | Design |
| Contradiction eyebrow « CE SOIR » ↔ « rien ce soir » | **Atténué, pas éradiqué.** Sous-titre désormais conditionnel à l'état (`HOME_SUBTITLE_BY_STATE`) ; l'eyebrow « Ce soir » reste figé (choix documenté). Le sous-titre porte la clarification — pansement plutôt qu'éradication. | Design/UX |
| Barre de progression à l'import | **Déjà là** (`import-panel.tsx`, « Import en cours… X/Y séries »). | UX |
| « Nb de jours en gros digit Plex Mono » sur le countdown | **Reconsidéré volontairement** (commentaire code) : le grand chiffre reste réservé à la progression watched/total du hero, pas au countdown. Arbitrage défendable, à assumer explicitement plutôt qu'à rouvrir. | Design |
| `line-clamp` sur titres tronqués (« House of the… ») | **Toujours ouvert** (`day-rail.tsx:93` = `line-clamp-1`). | Design |

---

## 3. État des lieux du site — fonction par fonction

Verdict de synthèse (dev + produit + design), le plus abouti d'abord.

| Fonction | Verdict | Détail |
|---|---|---|
| **Accueil « Ce soir »** | 🟢 Solide — vitrine du produit | 5 états réellement différenciés, exclusions mutuelles hero/sortie du jour fines, marquage optimiste sans latence perçue, a11y (aria-live, récupération de focus). Le hero « talon de billet » + compteur cyan est la meilleure exécution du concept. |
| **Import d'historique** | 🟢 Solide — **atout compétitif n°1 vs Betaseries** | Détection explicite de format (zip GDPR TV Time, CSV Betaseries agrégé, JSON imbriqué), statut déduit intelligemment (jamais « en cours » par défaut), résolution manuelle des ambiguïtés (`/import-run`), historique des runs. |
| **Fiche série** | 🟢 Solide | Accordéons de saison, marquage unitaire + par saison (avec confirmation avant démarquage), notation 1-5 privée, « où regarder ». `ProgressCard` = la meilleure exécution « finesse » du site. |
| **Bibliothèque** | 🟢 Solide | 5 statuts, **désarchivage fonctionnel** (le bug précis qui frustre chez Betaseries est évité par design — tables séparées), tri configurable, chip de progression grille. |
| **Calendrier dédié** | 🟢 Solide | Double vue (timeline continue / semaine), personnalisé si connecté, générique si anonyme. |
| **Recherche** | 🟢 Correct | Live TMDb debouncée, grille de découverte par défaut (jamais un vide anxiogène). Utilitaire, peu de personnalité — cohérent avec « sobriété = fiabilité ». |
| **Export JSON** | 🟡 Fonctionnel mais **sous-vendu** | Tient la promesse « mémoire durable », mais logé dans un bouton `variant="outline"` générique au milieu du profil — alors que c'est l'argument de confiance n°1 post-fermeture TV Time. |
| **Fiche film** | 🔴 Trou confirmé | `MovieStatusPicker` ne change qu'un statut : pas de date, pas de rewatch, pas de compteur VHS. La moitié « films » de la promesse est vide d'émotion et de fonction. |
| **Rewatch** | 🔴 Écart doc↔code | Booléen par épisode (contrainte `UNIQUE`), pas d'historique — alors que `CLAUDE.md`/`README` annoncent « une ligne par visionnage ». Le démarquage saison est présenté comme supprimant « l'historique de rewatch » qui n'existe pas structurellement. |
| **Notifications** | 🔴 Absentes | Aucune fonction cron/notification (11 edge functions, toutes lecture TMDb ou import/export). |
| **Recommandation** | 🔴 Absente (au sens moteur) | Rail « À découvrir » = tendances TMDb génériques, honnêtement libellées, non personnalisées. |
| **Social / profil public** | 🔴 Absent | Pas de `follows`, pas de route `/u/:pseudo`. Cohérent MVP, mais besoin latent identifié (casual FR). |
| **Auth** | 🟡 Email/password uniquement | Pas de Google/Apple — friction d'inscription pure pour un migrant pressé. |
| **PWA / installabilité** | 🔴 Absente | Aucun `manifest.json` — l'app reste un onglet de navigateur, pas une icône d'écran d'accueil. |
| **404 / Erreur** | 🔴 Hors design system | Anglais, police système, boutons génériques (`__root.tsx`) — seule rupture nette avec le reste du site. |

---

## 4. Comment les utilisateurs perçoivent le site (test simulé ~100 profils)

**Panel simulé** (poids assumés, contexte : 4 août 2026, TV Time fermé depuis 3 semaines → panel déplacé vers le migrant orphelin, en recherche active) :

| Segment | Poids | Enjeu dominant |
|---|---:|---|
| Migrant TV Time en deuil | 32 | Ne pas reperdre 3-8 ans d'historique — l'import est le moment de vérité |
| Déçu Betaseries | 22 | Fiabilité (sync, désarchivage), méfiance « pareil en pire dans 6 mois » |
| Binger | 20 | Marquer une saison en 2 taps, zéro friction |
| Casual FR / social-léger | 16 | Churn day-1 si l'app se présente comme « un outil de comptable » |
| Cinéphile-data / collectionneur | 10 | Faible volume, **forts verbatims publics** (Reddit/X) — export, rewatch, précision |

**Ce qui inspire confiance / plaît (signaux positifs simulés) :**

- **Le geste « marquer vu » + compteur VHS** : cité spontanément comme différenciant, « un petit shot de satisfaction » (77/100 sur la fiche série). C'est le moment émotionnel signature, et il fonctionne.
- **L'import** rassure quand il se déroule (63/100 « je comprends exactement quoi faire »), barre de progression bien perçue.
- **L'export JSON** tient la promesse « mémoire durable » (69/100), très fort chez migrant/cinéphile-data.
- **L'empty state « Archivé »** (« son historique reste intact, rien n'est jamais perdu, tout reste exportable ») répond pile à la peur héritée de Betaseries (31/100 le citent positivement). Bon ton à généraliser.
- **L'accueil `all_caught_up`** (bannière pleine cyan) et le **cas `normal`** (« je vois tout mon soir en un coup d'œil », 79/100 chez le binger) sont les états les mieux reçus.

**Ce qui frotte (frictions simulées, par intensité) :**

| Rang | Pain point | Signal | Segment | Écran |
|---|---|---:|---|---|
| 1 | **Aucun déclencheur de retour** (pas de notif/rappel externe) | 61/100 | tous | transverse |
| 2 | **Rewatch non historisé** (perçu comme régression vs Letterboxd/TV Time) | 26/100 (concentré, intense) | cinéphile-data | fiche série |
| 3 | **Pas de dry-run avant import** d'un historique de plusieurs années | 29/100 | migrant, cinéphile-data | import |
| 4 | Pas de marquage groupé accessible **depuis la bibliothèque** | 19-21/100 | binger | biblio/home |
| 5 | Écran de résolution d'import **déconnecté du flux** (route à part via profil) | 22/100 | migrant | import |
| 6 | Découverte générique, sans valeur ajoutée personnalisée | 22/100 explicites | casual, déçu Betaseries | recherche |
| 7 | Pas de **preuve immédiate post-import** au-delà d'un compteur texte | 15/100 | migrant échaudé | import |
| 8 | Post-inscription générique plutôt que guidé vers l'import | 24/100 | migrant | auth→home |

**Couverture des jobs-to-be-done :**

- **Tracker fiable** ✅ largement tenu — marquage rapide sans lag, calendrier double-vue, confirmation avant démarquage, 5 états sans zone morte. *Frustre :* pas de bulk depuis la biblio ; empty states de fin de zone (« Rien de prévu ») trop secs.
- **Mémoire durable** 🟡 tenu en back-end, sous-exposé en front — export enterré, **rewatch non historisé contredit le mot « mémoire »** pour le segment le plus sensible, films partiels.
- **Découverte qui marche** 🔴 le vide n'est pas trompeur (honnête) mais reste un vide — pas de reco réelle, pas de note communautaire, pas de social.

---

## 5. Le cœur de la demande — pourquoi l'app n'est pas (encore) un usage quotidien

**Diagnostic central, sur lequel les 3 angles convergent :** le produit est un **excellent moteur de calcul de pertinence sans mécanisme de diffusion**. La boucle actuelle est **pull, jamais push** — l'accueil calcule très bien « quoi regarder ce soir » *quand on l'ouvre*, mais **rien ne ramène l'utilisateur au bon moment**. Un calendrier qu'on ne pense pas à consulter ne sert à rien.

Il faut séparer deux problèmes distincts :

### (a) Bloquants adoption Day-1 — surtout le migrant TV Time
- **Pas de dry-run à l'import** → hésitation à committer des années d'historique sans point de contrôle.
- **Post-inscription générique** au lieu d'enchaîner sur l'import quand l'utilisateur vient d'un lien « TV Time ».
- **Rewatch invisible**, découvert tôt par le segment le plus vocal (dégrade la fidélité de l'import silencieusement).
- **Films dégradés** en simple statut, **pas d'auth sociale** (friction pure), **pas de PWA** (« impression de recul » vs une app native).

### (b) Leviers de rétention quotidienne J7/J30 — pourquoi revenir *chaque jour*
Une fois l'historique importé et la promesse vécue une fois, il faut une raison de revenir sans y penser soi-même. Aujourd'hui, il n'y en a aucune :

1. **Aucune notification (push/email)** — le contenu est intermittent (~1 épisode/semaine/série) ; sans push, savoir qu'un épisode est sorti suppose d'ouvrir l'app par hasard le bon jour. **Levier n°1**, sans ambiguïté (61/100).
2. **Aucun signal ambiant** — pas de PWA installable = pas d'icône sur l'écran d'accueil, l'app reste un onglet oublié.
3. **Rien à découvrir un jour creux** — la découverte générique ne se renouvelle pas selon les goûts, aucune raison d'ouvrir sans épisode prêt.
4. **Aucun rituel de continuité** — le compteur récompense l'action, pas la régularité (pas de streak, pas de moment de fin de saison).
5. **Aucune mesure** — impossible de savoir qui revient réellement (pas d'analytics).

> **Verbatim de synthèse (simulé, binger) :** « Le produit est solide quand je l'ouvre — je marque vite, ça ne bug pas. Mais rien ne me FAIT l'ouvrir. Avec TV Time j'avais la notif du soir. Là il faut que je pense moi-même à vérifier si un épisode est sorti. »

---

## 6. Ce qui manque, priorisé (synthèse produit + UX + design)

Cadre **Impact/Effort qualitatif** (pas de RICE chiffré : aucune donnée d'usage en prod pour un « Reach » crédible). Effort en S/M/L.

| # | Manque | Nature | Impact rétention | Effort | Verdict |
|---|---|---|---|:---:|---|
| **1** | **Notifications « nouvel épisode dispo » (email d'abord)** | Feature core | **Très élevé** | M | **Priorité absolue.** Seule pièce qui rend le socle (déjà solide) réellement quotidien. Email d'abord = pas de service worker, cron Supabase suffit, fiable à 100 % (cohérent avec « fiable avant ambitieux »). |
| **2** | **PWA installable** (`manifest.json` + icônes + meta) | Feature/UX | Moyen-élevé | **S** | **Avec #1, vite.** Présence ambiante quasi gratuite (aucune infra), complète la notif sans en dépendre. |
| **3** | **Analytics produit en prod** (rétention J1/J7/J30) | Méta | — (conditionne tout) | S | **En parallèle de #1, pas après.** Sans mesure, tout arbitrage de rétention reste une hypothèse indéfiniment. |
| **4** | **Rewatch historisé** (une ligne par visionnage) | Feature core / dette | Moyen (confiance) | M | Fondation. La fenêtre pré-lancement est la **moins chère** pour migrer la contrainte `UNIQUE` — la dette grossit avec chaque nouvel import. Peut avancer en parallèle de #1/#2. |
| **5** | **Tracking film complet** (date + rewatch) | Feature core | Moyen | M | Même logique que #4 : tenir la promesse « séries **et** films ». |
| **6** | **Reco v1 simple** (genres/équipe TMDb pondérés par `show_ratings` existant) | Feature core | Élevé (jours creux) | M | Différenciateur n°1 vs Betaseries resté en jachère. `show_ratings` existe déjà → un v1 « fiable et simple » plutôt qu'un bot ambitieux cassé une fois sur deux. |
| **7** | **Dry-run + résolution inline à l'import** | UX | Moyen (day-1) | M | « Voir avant de committer » + résolution des ambiguïtés dans le flux, pas sur une route à part. Renforce l'atout compétitif n°1. |
| **8** | **Diary léger** (note + courte note libre, extension de `show_ratings`) | Feature | Moyen-élevé | S/M | Donne du sens au geste même sans nouvel épisode. Version minimale et **privée** d'une mécanique Serializd, sans feed social (qui serait vide sans masse critique). |
| **9** | **Undo léger** (toast + Annuler) après marquage | UX | Faible-moyen (confiance) | S | La mécanique de rollback optimiste existe déjà, à câbler. |
| **10** | **Extension du marquage groupé** à la bibliothèque/l'accueil | UX | Faible-moyen | S | Existe déjà sur la fiche série (`SeasonToggle`) — extension de surface, pas manque total. Priorité basse assumée. |
| **11** | **Streak sobre** (chiffre seul, pas de badge) | Feature | Faible-moyen | M | **Après** #1/#2/#6 seulement — sinon pansement décoratif sur une boucle incomplète. |

**Tranchage : #1 + #2 + #3 ensemble et vite** (le trio « diffusion + mesure », effort combiné raisonnable). #4/#5 en parallèle sur une autre piste (fondation/confiance). #6/#8 ensuite (bénéficient d'avoir déjà des utilisateurs actifs/notés). Social complet reste phase 2, à juste titre.

---

## 7. Design & UX transverses — état des lieux

**Ce qui tient le concept « vidéo-club nocturne » :** le hero d'accueil, la `ProgressCard` de la fiche série (finesse « media-tracker.app » exemplaire : un seul signal fort, filet plutôt qu'empilement de cartes), le compteur VHS cyan, le traitement événementiel de l'anticipation (`NextReleaseHeroCard`, badge « Aujourd'hui »). `useReducedMotion` est câblé partout — vraie discipline.

**Constats design confirmés en code, priorisés :**

**P0 — avant tout merge touchant ces écrans**
- **Contraste cassé sur le profil** : `stats-section.tsx:231,323` utilise `text-secondary` comme couleur de texte sur `surface-elevated`, or `--secondary` == `--surface-elevated` (`styles.css:73,103`) → texte quasi noir sur fond quasi noir, potentiellement sur le **chiffre-clé** d'une stat. Vrai bug de token.
- **Icône cassette VHS littérale** dans l'onboarding (`onboarding-icons.tsx:16-61`) : **seule violation directe** de la règle anti-pastiche VHS de `CLAUDE.md`/skill anti-slop trouvée dans le code. À refaire en abstrait/géométrique (les icônes 2-4 du carousel, elles, sont conformes).
- **404/erreur hors design system** (anglais, police système) — à refaire en français, dans le système.
- **Cible tactile 32px** du bouton « marquer vu » sur `day-rail.tsx:87` (rail « Programme à venir », très visité) vs 44px ailleurs — même geste, taille incohérente.

**P1 — impact fort, effort raisonnable**
- **Dette signature : `HeroTicket` ne consomme pas `VhsCounter`**, il réimplémente le tween à la main → deux sources de vérité pour la signature (le fix contraste PR#7 a déjà dû être appliqué deux fois). Router `HeroTicket` sur `VhsCounter`/`useRollingNumber`.
- **Fragmentation de la grammaire de carte** : 4 grammaires coexistent ; la grammaire « fine » validée n'est déployée que sur 2 composants — pas même sur le `HeroTicket` (la vitrine). Généraliser au hero et au profil.
- **Export sous-vendu** : en faire une carte dédiée « argument de marque », pas un bouton `outline` parmi d'autres.
- **`line-clamp-1` → `line-clamp-2`** sur `day-rail.tsx:93` (titres tronqués).
- **Loading incohérent** : le composant `Skeleton` partagé n'est en réalité consommé **nulle part** — chaque écran refait son `animate-pulse` local avec des fonds divergents. Unifier.
- **Concrétiser a minima le tracking film** (au moins la date) pour que la moitié « films » porte une charge émotionnelle.

**P2 — utile, non bloquant**
- Badge de progression en overlay sur les posters de la bibliothèque (aujourd'hui nus).
- Généraliser `APP_NAME` au lieu du littéral « tvtrackd » (root, auth, index, calendar, search).
- Note en demi-étoiles si le rating devient un axe de différenciation (non prioritaire).

---

## 8. Benchmark rétention quotidienne — quoi adopter, quoi ignorer

| App | Mécanique daily | Adopter ? | Pourquoi |
|---|---|---|---|
| TV Time | Notif « nouvel épisode » + badges/niveaux | **Notif oui** (priorité absolue) ; **badges non** | L'équivalent « Up Next » existe déjà et mieux construit (5 états) ; il manque le canal de diffusion. La gamification à points est écartée par `CLAUDE.md` et n'a pas sauvé TV Time. |
| Betaseries | Notifs (peu fiables) + reco (cassée) | **Oui, mais fiables** | Le gap n'est pas le concept, c'est l'exécution — c'est littéralement la thèse du produit. |
| Trakt | Scrobbling Plex/Kodi | **Non prioritaire** | Hors segment (power-user technique) ; le marquage est déjà en un tap. |
| Serializd | Feed social + diary | **Diary léger oui (privé, plus tard) ; feed non maintenant** | Un feed sans masse critique = feed vide, pire qu'une absence. |
| Simkl | Scrobbling streaming (extension) | **Non pour l'instant** | Effort/impact mauvais vs notif+PWA. |

**À ignorer explicitement** (fidèle à « basiques bien faits ») : gamification à points, bot de reco ambitieux non fiable, scrobbling multi-plateforme — tant que notif + reco simple ne sont pas prouvés fiables.

---

## 9. Décisions produit à trancher (par le porteur)

1. **URL de la version en ligne** — prérequis à tout vrai test utilisateur : où pointe-t-on les testeurs ? (bloquant méthodologique, pas produit).
2. **Rewatch** — assumer le booléen (et corriger `CLAUDE.md`/`README` qui promettent l'inverse) ou lancer le chantier d'historisation ? La fenêtre pré-lancement est la moins chère ; le coût de migration grossit avec l'usage.
3. **Notifications** — email d'abord (recommandé : fiable, sans service worker, aligné `ROADMAP §2`) ou push web d'emblée ?
4. **Marquage groupé** — l'étendre depuis la fiche série (où il existe) vers la bibliothèque/l'accueil, ou statu quo ?
5. **Profil public** (phase 2) — opt-in (recommandé, cohérent avec le positionnement post-traumatisme data) ou opt-out ?

---

## 10. Limites & prochaine étape

Ce dossier mêle **faits de code** (solides, sourcés) et **signaux simulés** (hypothèses). Le signal le plus fort — l'absence de notification comme premier frein à l'usage quotidien — reste à **confirmer par une vraie recherche primaire** avant d'être traité comme établi :

- **8-12 entretiens modérés** (migrant TV Time, déçu Betaseries, binger en priorité) + **test d'utilisabilité non modéré** (Maze/UserTesting) sur les parcours onboarding, import et home par état.
- **Instrumenter la rétention** (analytics, item #3) et/ou un **A/B test d'un rappel email simple** post-lancement pour valider le levier n°1 sur données réelles.

> **En une phrase :** le socle « tracker fiable » est là et bien exécuté — ce qui manque pour un usage quotidien n'est pas plus de fonctions de calcul, mais un **mécanisme de diffusion** (notification + présence ambiante), la **mesure** pour le piloter, et la fin de deux **écarts de promesse** (rewatch, films) qui fragilisent l'argument « mémoire durable » auprès du segment le plus fidèle.
