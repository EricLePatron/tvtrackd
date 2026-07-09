# CLAUDE.md

Contexte projet pour Claude Code. Ce fichier doit être lu en entier avant toute intervention sur le repo.

## Pourquoi ce projet existe

TV Time (25M+ utilisateurs revendiqués) ferme le 15 juillet 2026 — l'éditeur (Whip Media, racheté par Blue Torch Capital en 2025) pivote vers l'IA et abandonne le produit faute de rentabilité. C'est la fermeture soudaine d'un des plus gros trackers de séries au monde, avec seulement ~2 semaines de préavis aux utilisateurs.

L'alternative française naturelle, **Betaseries**, a la marque et la communauté mais une exécution technique datée et non fiable : bugs de synchronisation récurrents, UX incohérente selon navigateur, bot de recommandation cassé une fois sur deux, désarchivage des séries qui ne fonctionne pas, lenteurs chroniques signalées sur plusieurs années sans résolution.

**La thèse du produit** : il y a un vide pour un tracker qui fait bien les choses basiques — fiable, rapide, sans bug — sur le marché francophone, plutôt que d'affronter frontalement les acteurs technique/anglophones (Trakt, Simkl) sur leur terrain. On ne réinvente pas la catégorie, on l'exécute correctement là où les acteurs en place échouent.

### Le vrai besoin (jobs-to-be-done)
1. **Tracker fiable** — marquer vu/à voir, calendrier des sorties, sans bug ni lenteur
2. **Mémoire durable** — un historique de plusieurs années qu'on ne veut plus jamais perdre. La fermeture de TV Time a traumatisé le marché sur ce point : l'export de données devient un vrai argument produit, pas un détail
3. **Social/découverte qui marche** — recommandations pertinentes, sans être du remplissage marketing cassé

## Paysage concurrentiel (pour ne pas réinventer ce qui existe déjà bien ailleurs)

| App | Force | Faiblesse | Notre positionnement vs eux |
|---|---|---|---|
| Trakt | Scrobbling auto Plex/Kodi/Jellyfin, API puissante | UI austère, limites 2026 durcies, compte tiers requis | On n'affronte pas le power-user technique, mais on peut proposer un import "connecter mon compte Trakt" |
| Simkl | Auto-tracking gratuit streaming (Netflix, Disney+, Crunchyroll) via extension | Communauté/UI plus faibles | Feature à considérer post-MVP si demande utilisateur forte |
| Serializd | Reviews/diary soignés, esprit "Letterboxd pour séries" | Pas de scrobbling, saturé actuellement par l'afflux TV Time | Le social/reviews est une feature phase 2, pas MVP |
| Betaseries | Marque FR connue, contenu éditorial | Exécution technique datée — **la cible à dépasser** | On reprend leur position avec un produit qui marche réellement |

## Stack technique

- **Lovable** : a livré le MVP initial (voir section Découpage plus bas) — squelette, auth, écrans, intégrations API de base
- **Supabase** : backend (Postgres, Auth, Edge Functions, Storage, Cron)
- **TMDb API** : source de métadonnées (recherche, fiches, images, calendrier de sorties). Choix fait après comparaison avec TheTVDB — TVDB a une meilleure précision horaire mais nécessite une licence commerciale payante (négociée ou 12$/an/utilisateur), non viable pour un MVP gratuit. TMDb reste gratuit et couvre films + séries + images en un seul endroit.
- **Claude Code** : prend le relais après le MVP Lovable pour toute l'itération — logique métier fine, moteur de reco, notifications, polish, tests, corrections

### Ce que Claude Code NE doit PAS faire
- Retoucher Lovable pour du développement courant — Lovable n'est rouvert que pour une refonte visuelle large, décidée explicitement
- Regénérer un schéma Supabase depuis zéro — le schéma existant (voir plus bas) doit être respecté et étendu, pas réinventé
- Introduire TheTVDB sans validation explicite du coût de licence — TMDb reste la source unique tant que ce n'est pas tranché

## Schéma Supabase (état MVP, à faire évoluer, pas à casser)

- `profiles` — id (→ auth.users), username, avatar_url, created_at
- `shows` — cache partagé TMDb : tmdb_id, media_type (tv/movie), title, poster_path, overview, first_air_date, status, cached_at (TTL 24-48h)
- `seasons` — show_id, season_number, episode_count
- `episodes` — show_id, season_number, episode_number, title, air_date, overview
- `user_shows` — user_id, show_id, status (a_voir / en_cours / termine / abandonne / archive) — RLS user_id = auth.uid()
- `watch_status` — user_id, episode_id, watch_count, watched_at — **une ligne par visionnage**, pas un booléen, pour gérer les rewatchs nativement — RLS user_id = auth.uid()

Point de vigilance hérité de l'analyse concurrentielle : ne jamais coupler `status` (archivage/désarchivage) et l'historique d'épisodes vus dans la même table — c'est le bug précis qui rend Betaseries frustrant (désarchiver casse l'accès à l'historique).

## Découpage des features

### Livré par Lovable (MVP)
- Auth Supabase (email/password)
- Recherche TMDb (`search-media` edge function)
- Fiche série/film avec cache local (`get-show-details`)
- Tracking épisode par épisode avec gestion des rewatchs
- Bibliothèque avec statuts (à voir/en cours/terminé/abandonné/archivé — désarchivage fonctionnel)
- Calendrier des sorties (hero "Ce soir" + rail "Programme")
- Import CSV/JSON (export TV Time / Betaseries) avec matching TMDb et résolution manuelle des ambiguïtés
- Export JSON des données utilisateur
- Stats basiques (épisodes vus, temps estimé, séries en cours)

### Hors scope MVP — backlog Claude Code, à prioriser selon retours utilisateurs
- **Import Trakt** — option "connecter mon compte Trakt" en plus de l'import CSV, pour récupérer l'historique des utilisateurs Trakt existants. Nécessite OAuth2 Trakt côté utilisateur (friction d'inscription à peser avant de prioriser)
- **Moteur de recommandation** — le point faible le plus criant chez Betaseries (bot cassé une fois sur deux). Doit être construit correctement dès le départ plutôt que patché après coup
- **Reviews / social feed** — écrire sur un épisode/saison, suivre d'autres utilisateurs. Le point fort de Serializd, à ne pas négliger si la traction MVP est bonne
- **Scrobbling automatique streaming** — équivalent Simkl (extension navigateur Netflix/Disney+/Crunchyroll). Techniquement lourd, à ne considérer qu'après validation du socle
- **Notifications push** — nouvel épisode disponible pour une série suivie (le calendrier existe en MVP, la notification push est un ajout)
- **TheTVDB en complément** — uniquement si la précision horaire devient un vrai pain point remonté par les utilisateurs, avec évaluation du coût de licence à ce moment-là

## Direction design

**Concept** : évoquer le rituel du visionnage — la cassette, le compteur qui défile, le programme TV du soir — avec une exécution 2026, pas un pastiche. TV Time avait un ton ludique et coloré ; on garde la chaleur mais on remplace le cartoonesque par quelque chose de plus tenu, "vidéo-club nocturne modernisé".

### Tokens
```
--bg-void: #0B0E14              /* fond principal, écran éteint */
--bg-surface: #151A24           /* cartes, panneaux */
--bg-surface-raised: #1E2530    /* éléments surélevés, modales */
--accent-amber: #FF8A3D         /* primaire — CTA, statut "en cours" */
--accent-cyan: #4DD9C4          /* secondaire — statut "vu", stats, succès */
--text-primary: #F2EDE4         /* blanc chaud, effet phosphore */
--text-muted: #8B92A3
```

### Typographie
- Titres/headers : **Archivo Expanded** (bold, condensé)
- Corps de texte : **Inter**
- Chiffres/compteurs (progression, stats, épisodes) : **IBM Plex Mono** — tous les nombres doivent utiliser cette police pour l'effet "compteur numérique"

### Élément signature
Le suivi de progression (saison/épisode) n'est **jamais** une checkbox générique. C'est un **compteur mécanique façon bande VHS** : chiffres en Plex Mono dans un module à fond sombre (`--bg-surface-raised`), avec une légère animation d'incrément/défilement quand on marque un épisode vu. C'est le seul risque esthétique assumé du design — tout le reste reste sobre et discipliné autour de cet élément. Ne pas ajouter d'autres effets décoratifs qui diluraient cette signature. Une barre de progression continue reste acceptable en complément du compteur (ex. page fiche série) tant qu'elle reste sobre (fine, sans dégradé) et n'y substitue pas les chiffres Plex Mono.

### Layout
- Accueil = hero "Ce soir" : prochain épisode à voir, présenté comme un talon de billet/étiquette de cassette, avec le compteur signature
- Rail horizontal "Programme" sous le hero : calendrier des sorties à venir, façon grille TV
- Bottom navigation mobile-first : Accueil / Recherche / Bibliothèque / Profil
- Coins arrondis modérés (8-12px), pas de dégradés décoratifs superflus, pas de glassmorphism

### Ce qu'on évite explicitement
Les trois esthétiques par défaut de génération IA à ne jamais reproduire sans intention : fond crème + serif haut contraste + accent terracotta ; fond noir + accent acid-green/vermillon unique ; layout broadsheet avec hairlines et colonnes denses. Si un choix de design tombe naturellement dans une de ces trois cases sans justification liée au concept "vidéo-club nocturne", le reconsidérer.

## Nommage / branding

Nom de domaine en cours d'arbitrage — `.fr` privilégié comme domaine principal (peu de `.com` courts disponibles sur le champ lexical "TV", et le positionnement marché est volontairement francophone). Piste actuellement évaluée : **TVTrackd** — vérification de risque de marque en cours (proximité de construction avec "Trakt", à valider via TMview/INPI avant achat définitif du domaine). Ne pas committer le nom en dur dans le code/assets tant que ce point n'est pas tranché — utiliser une variable de configuration pour le nom de l'app.

## Principes de développement pour Claude Code

- Toujours vérifier le cache TMDb (`cached_at`, TTL 24-48h) avant de re-fetch — ne pas multiplier les appels API inutilement
- Actions de tracking en optimistic UI — le clic coche instantanément, la sync Supabase se fait en arrière-plan, jamais d'attente visible
- RLS Supabase strict sur toutes les tables utilisateur — vérifier systématiquement avant d'ajouter une nouvelle table
- Respecter le design system existant pour toute nouvelle feature — ne pas introduire de nouvelle police, de nouvelle couleur d'accent, ou de nouveau pattern de composant sans revoir cette section
