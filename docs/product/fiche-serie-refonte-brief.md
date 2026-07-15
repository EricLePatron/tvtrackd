# Brief de refonte — Fiche série immersive & émotionnelle

Synthèse des trois notes (produit, design, marketing) pour la refonte de
`src/routes/_public/show.$mediaType.$tmdbId.tsx`. Ce document est le brief unifié
qui sert de base à l'implémentation (`tvtrackd-developer`, plan → validation).

Notes sources :
- Produit : `docs/product/fiche-serie-emotion.md`
- Design & marketing : intégrés ci-dessous.

## Intention

Faire passer la fiche série d'une page **utilitaire et plate** (poster 112px +
liste d'épisodes) à une page **immersive et émotionnelle**, sans nouvelle
feature lourde ni migration : le gisement d'émotion est déjà en base et dans le
design system, c'est un travail de **hiérarchie et de mise en scène**, pas de
nouvelles données.

Trois émotions à servir (par ordre stratégique) :
1. **Fierté de la progression** — élever le compteur VHS au rang de pièce maîtresse.
2. **Mémoire durable / nostalgie** — « avec cette série depuis [date], ≈ X h vues » (anti-thèse TV Time).
3. **Anticipation** — le « prochain épisode » traité comme un rendez-vous, façon talon de billet.

## Hiérarchie de page cible

1. **Hero backdrop immersif** (remplace le header compact)
2. **Compteur agrégé série entière** + « ton histoire avec cette série » (si suivie)
3. **Prochain épisode / reprise** fusionnés en un ticket cliquable
4. **Bouton Suivre / statut** (empty state soigné si visiteur)
5. **Synopsis, genres, note, networks, plateformes** (factuel, médian)
6. **Saisons/épisodes + VhsCounter** (cœur fonctionnel, inchangé)
7. **Rail « Similaires »** (inchangé)

## 1. Hero immersif (design)

- Full-bleed (seul élément à rompre le `mx-5`), `relative h-[44vh] min-h-[260px] max-h-[400px] w-full overflow-hidden`.
- Image : `show.backdrop_path ?? show.poster_path`, `object-cover object-top`. Fallback `bg-surface-elevated`.
  - `backdrop_path` est **déjà retourné** par `get-show-details` (colonne existante) — il manque juste au type `ShowRow` et à l'UI. Aucun changement de schéma.
- Overlays (repris de `HeroTicket`, `index.tsx:417-426`) :
  - Fondu bas : `bg-gradient-to-t from-background from-[5%] via-background/85 via-45% to-transparent to-75%`
  - Scrim haut (lisibilité back button) : `bg-gradient-to-b from-background/70 to-transparent`, `h-24`
- Header sur hero : `BackButton` + eyebrow `Série · 2024 · En diffusion` en absolu, `top-4 px-5`, `bg-card/80 backdrop-blur-sm`.
- Bloc titre ancré en bas (`absolute inset-x-0 bottom-0 px-5 pb-5`) :
  - Titre `font-display text-[28px] leading-[1.05] line-clamp-2`
  - Tagline `mt-1 text-sm italic text-muted-foreground line-clamp-1`
  - Note en **badge cyan** `border-cyan-accent/40 bg-cyan-accent/10 ... font-counter` (au lieu du texte cyan actuel)
- **Arbitrage — mini-poster (A: aucun / B: mini-poster ancré bas-gauche)** → reco **B** (`h-24 w-16 rounded-md border shadow-md`), fiable quand le backdrop est faible/absent.
- **Arbitrage — scroll (statique / parallax / fondu)** → reco **statique** pour ce cycle (zéro jank Safari iOS, comme `HeroTicket`).

## 2. Compteur agrégé & « ton histoire » (design + produit)

- Nouveau bloc sous le hero, avant les genres, réutilisant l'ADN de `VhsCounter` variante `hero` (pastille `rounded-md bg-surface-elevated`, `font-counter`, `tabular-nums`, bump existant).
  - Gauche `SAISON X/Y`, droite fraction épisodes vus/total avec bump (`scale-110 text-cyan-accent`).
  - Barre fine optionnelle (autorisée par CLAUDE.md) : `h-[2px] bg-muted-foreground/15` + `bg-primary`.
- Ligne secondaire discrète (mono, muted, sans icône) : `≈ 14 h vues`.
  - Durée = somme runtimes × `watch_count`. **Runtime réel absent du schéma** → utiliser l'heuristique existante `AVG_EPISODE_MIN = 42` (`profile.tsx`), libellé **explicitement approximatif** (`≈`).
  - « Depuis [date] » via `user_shows.created_at` (déjà en base, non exploité).
- **Un seul compteur visible par zone d'écran** — ne pas dupliquer la même fraction (hero / ticket / agrégat / saison).
- **Reduced motion** : cette refonte rend le bump central → ajouter `motion-reduce:transition-none` et sauter à la valeur finale (garde-fou absent aujourd'hui dans `vhs-counter.tsx`).

## 3. Ticket « prochain épisode » (design + marketing)

- Remplacer l'empilement texte (lignes 582-595) par une carte façon talon de billet, **sans nouvelle image** (un 2e backdrop diluerait la signature) :
  `mx-5 mt-4 flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3.5`
  - Perforation : un seul hairline pointillé `border-l border-dashed border-border pl-3`.
  - S/E à droite en `font-counter text-primary`, sans fraction (l'agrégat couvre déjà ce rôle).
- **Fusionner avec le lien « Reprendre / Commencer avec SxxExx »** (lignes 610-628) : rendre le ticket lui-même cliquable (scroll-to-episode). Deux signaux faibles redondants → un point focal fort. **Arbitrage produit** avant implémentation.
- Copy : garder « Prochain épisode » ; **arbitrage** variante « Rendez-vous » (plus courte, plus rituel télé) à trancher avec le design.
- Verbes conservés : « Commencer avec S01E01 » / « Reprendre S03E04 ».

## 4. Empty state (série non suivie) (design + marketing)

- Le hero se rend intégralement (backdrop, titre, note) même sans suivi — il porte l'argument émotionnel avant l'engagement.
- Bloc agrégat **masqué** pour un visiteur (rien à compter) — ne pas simuler un compteur vide gamifié.
- CTA « Suivre » conservé + accroche discrète `font-counter text-[10px] uppercase tracking-widest text-muted-foreground` : « Suivez cette série pour activer le compteur ».

## 5. Copy & ton (marketing)

Registre : phrases courtes, vouvoiement, français idiomatique (pas d'anglicisme), aucune exclamation ni emoji. Un seul fil émotionnel par zone ; le compteur VHS fait le travail, le texte reste exact et sobre.

- **CTA « Suivre »** : garder tel quel (clarté fonctionnelle > évocation à ce stade).
- **État « À jour » manquant** (gap) : quand `userShow && !manual_override && !firstUnwatched && anyWatched && nextUpcomingEpisode`, rien ne s'affiche. Ajouter un signal sobre : **« À jour. »** ou **« Vous avez tout vu jusqu'ici. »**
- **Jalons uniquement** (pas de « Bravo » à chaque épisode) : fin de saison **« Saison [N] bouclée. »**, fin de série **« Vous êtes à jour sur toute la série. »**
- **Toast reprise** (ligne 253, actuellement « Reprise de suivi détectée ») → reco **« Suivi repris automatiquement. »** ou **« De retour sur cette série — le suivi reprend. »**
- **Dialogue « Ne plus suivre »** (le point le plus stratégique — moment de doute max, névralgique post-TV Time). Reco **variante B** :
  > « La série disparaît de votre bibliothèque, pas votre historique : chaque épisode vu reste enregistré, prêt à être retrouvé — ou exporté — quand vous le voulez. »
  (l'export JSON est réellement livré, donc factuel ; c'est le **seul** endroit de la fiche où appuyer franchement sur l'argument « données jamais prises en otage »).
- Ne **pas** dupliquer l'argument « historique en sécurité » ailleurs sur la fiche ; ne pas nommer « TV Time » dans le produit.
- Ne pas renommer « Abandonné » ici (statut transversal à toute l'app — arbitrage produit global si souhaité).
- `aria-label` restent strictement fonctionnels (pas de ton chaleureux dans l'a11y).

## 6. Garde-fous (transverses)

- **Optimistic UI non négociable** : aucun ajout émotionnel n'ajoute latence/clic au geste de cocher.
- **Aucune donnée inventée** (pas de « regardé par X personnes », pas de stat non calculée) — c'est le remplissage cassé reproché à Betaseries.
- Toute estimation reste explicitement approximative (`≈`).
- **Rester dans les tokens** : pas de nouvel accent, pas de nouvelle police. Garder la **bichromie ambre/cyan** visible dès le premier écran (éviter le hero mono-accent = esthétique IA proscrite n°2).
- **Pas de pastiche VHS littéral** (pas de scanlines, texture bruit, icône cassette, bordure boîtier), pas de glassmorphism au-delà du `backdrop-blur-sm` fonctionnel, pas de grille de hairlines (esthétique proscrite n°3).
- Un seul point d'entrée immersif par page (le hero) ; le reste reste en surfaces plates.
- Ne pas toucher la liste saisons/épisodes ni `EpisodeRow` : le contraste « hero riche / liste calme » est voulu (pattern Apple TV / Letterboxd).

## 7. À signaler hors périmètre (handoff)

- **Nom d'app en dur** : `head()` committe « tvtrackd » (lignes 54, 59, 67, 73), contraire à la règle de nommage CLAUDE.md (nom non tranché). → passer en variable de config.
- **Écart schéma `watch_status`** : CLAUDE.md décrit « une ligne par visionnage » mais l'implémentation est une ligne unique par `(user_id, episode_id)` avec `watched_at` écrasé à chaque rewatch. La date de **première** découverte n'est donc pas conservée — un futur module « journal » serait fiable seulement hors rewatch. Décision de modèle de données **séparée**, pas dans cette refonte.
- **Cibles tactiles** : toggles épisode en `h-8 w-8` (32px < 44px) — dette a11y préexistante, à traiter séparément. *Mise à jour post-implémentation : corrigée dans cette itération (coche épisode passée à 44×44px), à l'occasion de la refonte plutôt que dans un correctif séparé.*

### Décisions produit actées explicitement pendant cette itération (pas des écarts non validés)

Les deux points suivants s'écartent de ce que décrivait ce brief au moment de sa rédaction. Ce ne sont **pas** des dérives d'implémentation non validées : ce sont des décisions produit prises explicitement par l'utilisateur en cours d'itération, au moment de valider le plan d'implémentation. Notées ici pour lever toute ambiguïté à la relecture (QA notamment).

- **Suppression de l'UI de rewatch « pour le moment »** (décision utilisateur). Le bouton de revisionnage par épisode (et la mutation `addRewatch` associée) a été retiré de la fiche série. La donnée `watch_count` et son affichage rétroactif (`×N` sur la coche, pour les rewatchs déjà enregistrés avant cette refonte) sont **conservés** — rien n'est perdu côté historique. **Suivi ouvert** : cette suppression est assumée comme temporaire, pas comme un abandon de la fonctionnalité — le rewatch natif reste un différenciateur produit identifié dans la thèse CLAUDE.md (mémoire durable / historique fiable) et devra être réintroduit, avec une UI repensée, dans une itération ultérieure.
- **Saisons en accordéons fermés par défaut** (décision utilisateur, pour réduire le scroll sur les séries à beaucoup de saisons/épisodes). Compromis assumé : cocher un épisode nécessite désormais un clic supplémentaire pour déplier sa saison avant d'accéder à la liste d'épisodes, contrairement à l'ancienne liste toujours dépliée. Ce coût de friction a été jugé acceptable au regard du gain de lisibilité en tête de page ; à réévaluer si des retours utilisateurs signalent que ça ralentit le geste de logging au quotidien (cf. CLAUDE.md, principe de vitesse de logging).

## Arbitrages à trancher avant implémentation

| # | Question | Recommandation |
|---|----------|----------------|
| 1 | Mini-poster dans le hero | **Option B** (mini-poster ancré) |
| 2 | Scroll du hero | **Statique** (parallax en v2 éventuelle) |
| 3 | Fusionner ticket « prochain épisode » + lien « Reprendre » | **Oui** |
| 4 | « Prochain épisode » vs « Rendez-vous » | À trancher (léger) |
| 5 | Bloc « ton histoire » visible pour non-suiveur | **Masqué** |
| 6 | Renommer « Abandonné » (portée produit globale) | Hors périmètre de cette refonte |
