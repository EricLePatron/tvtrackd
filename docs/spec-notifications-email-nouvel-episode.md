# Spec produit — Notifications e-mail « nouvel épisode disponible »

> Cadrage QUOI, pas COMMENT. Le COMMENT (edge function, cron Supabase, provider d'envoi, prompt Lovable) revient à l'agent développeur. Cette spec doit rester exploitable telle quelle pour écrire ce prompt.

**Statut** : brouillon à trancher — voir §7 pour les décisions ouvertes.
**Contexte** : identifié comme levier de rétention n°1 dans `etude-etat-des-lieux-2026-08.md` (§5-6, item #1 du tableau impact/effort). Aujourd'hui la boucle produit est *pull* (l'utilisateur doit penser à ouvrir l'app) — cette feature est le premier mécanisme *push* du produit.

---

## 0. Faits d'ancrage (vérifiés dans le code, à ne pas contredire)

- `profiles(id, username, avatar_url, created_at)` — **aucune colonne de préférence de notification, aucune colonne e-mail.** L'e-mail vit dans `auth.users.email`, hors de portée RLS classique côté client ; toute lecture d'e-mail pour l'envoi doit passer par une edge function avec `service_role` (le développeur le sait déjà, mais ça conditionne où vit la préférence d'opt-in : `public.profiles` peut porter le flag, pas l'adresse).
- `user_shows(user_id, show_id, status)`, status ∈ `a_voir / en_cours / termine / abandonne / archive`.
- `episodes(show_id, season_number, episode_number, title, air_date)` — `air_date` est une **date**, pas un datetime avec heure de diffusion précise (cohérent avec le choix TMDb documenté dans `CLAUDE.md`, TVDB aurait une meilleure précision horaire mais coût de licence non tranché).
- `watch_status(user_id, episode_id, watch_count, watched_at)` — sert à savoir si un épisode a déjà été vu par l'utilisateur (pas de ligne = pas vu, dans l'usage courant hors import).
- **0 edge function de notification/cron aujourd'hui** (11 fonctions existantes, toutes TMDb/import/export : `search-media`, `get-show-details`, `trending-media`, `new-releases-media`, `similar-media`, `show-credits`, `person-credits`, `public-calendar`, `export-data`, `import-history`, `_shared/tmdb.ts`).
- **0 analytics en prod** — toute mesure d'ouverture/clic doit être portée par la feature elle-même (tracking pixel + colonnes dédiées), pas déléguée à un outil déjà en place.
- Nom de domaine **non tranché** (`.fr` pressenti, marque « tvtrackd » en cours de vérification INPI/TMview) → adresse d'expéditeur et SPF/DKIM sont un point ouvert, pas un détail d'implémentation à ignorer.
- Design system : accent ambre (`--accent-amber`, statut « en cours »), accent cyan (`--accent-cyan`, statut « vu »/succès), typo compteurs = IBM Plex Mono, ton « vidéo-club nocturne modernisé », pas de gamification à points (exclue explicitement par `CLAUDE.md` et par l'étude §8).

---

## 1. Déclencheur & périmètre MVP

**Déclencheur** : un épisode dont `episodes.air_date = date du jour` (fuseau à trancher, voir §2) appartient à une série (`show_id`) que l'utilisateur suit, ET n'est pas encore marqué vu (`watch_status` absent pour cet `episode_id` chez cet utilisateur).

**Statuts `user_shows` qui qualifient** :

| Statut | Qualifie pour notif MVP | Justification |
|---|---|---|
| `en_cours` | **Oui** | Cœur de cible : l'utilisateur suit activement, c'est le signal de rétention le plus fort. |
| `a_voir` | **Oui** | L'utilisateur a explicitement ajouté la série à sa liste mais n'a rien regardé — un nouvel épisode qui sort est un signal pertinent pour l'inciter à démarrer. À trancher si ça génère trop de bruit pour des séries jamais commencées (voir option B ci-dessous). |
| `termine` | Non | Série terminée pour l'utilisateur ; un nouvel épisode signifie en réalité un retour de la série (nouvelle saison) — cas limite traité en exclusion MVP (§ ci-dessous), pas en inclusion silencieuse. |
| `abandonne` | Non | Signal explicite de désintérêt — relancer par notif serait perçu comme intrusif, à l'opposé du positionnement « respect de l'utilisateur ». |
| `archive` | Non | Point de vigilance direct de `CLAUDE.md` : l'archivage ne doit jamais rouvrir un flux actif côté produit, cohérent avec la séparation stricte statut/historique déjà actée. |

**Option à trancher (§7)** : si `a_voir` génère trop de notifications pour des séries que l'utilisateur n'a jamais commencées (ex. ajoutées "pour plus tard" sans intention immédiate), restreindre le MVP à `en_cours` seul et ajouter `a_voir` en v1.1 une fois le volume observé. **Recommandation** : démarrer avec `en_cours` uniquement — périmètre le plus resserré, le plus défendable côté anti-spam, et le plus proche du signal réel ("je suis en train de regarder cette série").

**Ce qu'on EXCLUT explicitement du MVP** :
- Les films (`shows.media_type = 'movie'`) — pas de notion de "sortie d'épisode", et le tracking film est déjà identifié comme un trou fonctionnel plus large (étude §3) à traiter séparément.
- La reprise d'une série `termine` par l'utilisateur mais renouvelée par la chaîne (nouvelle saison après un `termine` utilisateur) — cas réel mais périphérique, à traiter en v1.1 avec une communication différente ("la série reprend") plutôt que noyé dans le digest standard.
- Les rappels de rattrapage ("vous avez 12 épisodes en retard, non vus depuis 3 semaines") — mécanique différente (relance vs annonce de sortie), hors périmètre, à évaluer séparément si la reco v1 ou un "digest hebdo" est priorisé plus tard.
- Toute notification push web / mobile — le canal MVP est l'e-mail exclusivement, cohérent avec le choix déjà documenté dans l'étude (§8, "email d'abord = pas de service worker, cron Supabase suffit").
- La granularité horaire de diffusion (ex. "disponible à 21h") — TMDb ne la fournit pas de façon fiable, donc le mail ne promet jamais une heure de disponibilité, seulement une date.

---

## 2. Cadence — digest quotidien recommandé

**Recommandation : (b) un digest quotidien unique**, regroupant toutes les sorties du jour pour un utilisateur donné, plutôt que (a) un mail par épisode.

**Justification** :
- **Cas binge-drop** (Netflix qui sort 8 épisodes d'une saison le même jour) : un mail par épisode enverrait 8 mails d'un coup à un même utilisateur — c'est le scénario spam le plus évident, et le rejet immédiat du positionnement "sobre, pas spammy". Le digest absorbe nativement ce cas : "8 épisodes de [Série] vous attendent".
- **Cas séries hebdo classiques** (diffusion US un épisode/semaine) : le digest quotidien dégénère naturellement en "1 épisode" quand un seul sort ce jour-là — aucune perte d'information, le format s'adapte sans branche de code séparée.
- **Cas utilisateur suivant plusieurs séries** avec sorties le même jour (ex. lundi = jour de sortie fréquent) : un seul mail groupé "3 séries ont un nouvel épisode aujourd'hui" est strictement supérieur à 3 mails distincts pour la charge cognitive et la délivrabilité (moins de risque de filtrage spam par les fournisseurs de messagerie qui pénalisent la fréquence d'envoi depuis une même adresse).
- Le digest simplifie aussi le calcul d'anti-spam (§5) : un seul envoi/jour/utilisateur à dédupliquer, pas un système de suivi par épisode individuellement envoyé.

**Heure d'envoi** : fin de journée, cohérent avec le concept "Ce soir" déjà central sur l'accueil (`NextReleaseHeroCard`, hero "talon de billet"). **Proposition : 18h00, heure locale de l'utilisateur** — assez tôt pour laisser le temps de regarder le soir même, assez tard pour capter les sorties mises à jour par TMDb dans la journée. C'est un choix produit non définitif, à trancher (§7) — 18h est une hypothèse de bon sens, pas une donnée validée par un test.

**Gestion des fuseaux horaires** : hypothèse de départ **à vérifier avec le développeur** — `profiles` n'a aujourd'hui aucune colonne de fuseau horaire. Deux options :
1. **MVP simplifié** : un seul envoi à heure fixe UTC+1/UTC+2 (Europe/Paris), cohérent avec le positionnement volontairement francophone du produit (cf. `CLAUDE.md`, choix `.fr`). Pas de colonne fuseau à ajouter, un cron unique.
2. **Version robuste** : colonne `profiles.timezone` (déclarée à l'inscription ou déduite du navigateur), cron qui tourne toutes les heures et sélectionne les utilisateurs dont l'heure locale correspond à 18h.

**Recommandation** : option 1 pour le MVP (marché francophone assumé, complexité cron minimale) ; l'option 2 devient pertinente si l'app s'internationalise — pas une urgence vu le positionnement actuel.

---

## 3. Opt-in / opt-out

**Défaut à l'inscription** : **activé par défaut (opt-out)**, avec une réserve de cohérence à trancher explicitement (§7) — c'est le point le plus tendu de cette spec.

**Argumentaire pour opt-out par défaut** :
- C'est un e-mail de service directement lié au job-to-be-done principal ("un épisode que vous suivez est sorti"), pas une notification marketing — la distinction RGPD entre "communication nécessaire au service souscrit" et "prospection" est pertinente ici, même si elle mérite une validation légale que cette spec ne tranche pas.
- Sans notification, l'étude documente que **61/100 profils simulés** citent l'absence de déclencheur de retour comme frein n°1 — un opt-in strict (case à cocher explicite, désactivée par défaut) réduirait fortement l'adoption réelle de la feature dès le lancement, ce qui viderait l'investissement de sa valeur.
- TV Time envoyait sa notif du soir sans reconsentement agressif — c'est une attente de catégorie, pas une innovation intrusive.

**Argumentaire pour opt-in strict (à considérer)** :
- Le positionnement produit est explicitement "post-traumatisme data, respect de l'utilisateur" (`CLAUDE.md`, §"Pourquoi ce projet existe" — la thèse de fiabilité et de respect vs Betaseries). Un opt-out par défaut peut être perçu comme la même logique de "case pré-cochée" reprochée à d'autres apps.
- Le décret français/RGPD sur les cookies/consentements pousse vers l'opt-in explicite pour tout ce qui n'est pas strictement transactionnel — un e-mail de rétention n'est pas un e-mail transactionnel au sens strict (pas "votre compte a été créé"), donc la marge d'interprétation légale existe. **Point à faire trancher par un avis juridique réel avant lancement**, cette spec ne peut pas se substituer à ce conseil.

**Recommandation opérationnelle** : opt-out par défaut (case activée), mais avec deux garde-fous qui atténuent le risque de perception négative :
1. **Mention explicite et visible au moment de l'inscription** ("Vous recevrez un e-mail quand un épisode suivi sort — désactivable à tout moment"), pas une activation silencieuse.
2. **Lien de désabonnement en un clic, sans connexion requise**, dans chaque e-mail (obligatoire de toute façon légalement, mais à traiter comme argument de confiance produit, pas comme contrainte cachée en petit texte).

**Granularité** : **MVP = interrupteur global uniquement** ("recevoir les notifications de nouveaux épisodes : oui/non"), pas de granularité par série. Justification effort/impact : la granularité par série est un vrai raffinement UX mais complexifie le modèle de données (table de préférences par `user_show` ou colonne dédiée) pour un MVP dont l'objectif est de prouver que le mécanisme de diffusion marche, pas d'optimiser sa précision dès le jour 1. À élever en v1.1 si des retours utilisateurs remontent une demande de silence sur certaines séries (ex. rewatch en cours d'une vieille série suivie par ailleurs).

**Lien de désabonnement** : obligatoire, dans le pied de chaque mail, sans authentification préalable (token signé dans l'URL), conforme à ce qui est attendu de toute app d'e-mailing sérieuse (CAN-SPAM/RGPD) — point non négociable techniquement, à porter dans le prompt Lovable.

---

## 4. Contenu du mail

**Ton** : sobre, factuel, chaleureux sans être ludique — aligné avec le principe déjà acté dans le design ("on garde la chaleur, on remplace le cartoonesque"). Pas d'emoji, pas de badge/points, pas de tournure marketing agressive ("Ne ratez rien !!"). Le mail doit ressembler à un avis de passage, pas à une notification d'app mobile bruyante.

**Structure du corps** :
1. En-tête minimal (nom de l'app via `APP_NAME`, pas de logo lourd — cohérent avec le fait que le nom n'est pas encore tranché légalement).
2. Ligne d'ouverture factuelle : "Ce soir au programme" ou équivalent, écho direct au hero d'accueil "Ce soir" déjà existant — continuité de langage entre le produit et le mail, pas deux voix différentes.
3. Liste des séries avec sortie du jour : titre de la série, numéro de saison/épisode (format `S02·E06`, cohérent avec le format déjà utilisé dans le chip compact de la grille bibliothèque), et si plusieurs épisodes de la même série sortent le même jour, un compteur groupé ("4 épisodes de [Série] disponibles").
4. Un CTA unique et clair vers l'app (pas un CTA par série listée — un seul bouton vers l'accueil ou le calendrier, qui est déjà l'écran le mieux exécuté du produit selon l'étude).
5. Pied de page : lien de désabonnement + lien vers les préférences de compte.

**Objet** : doit donner l'information sans obliger à ouvrir le mail (les gens scannent l'objet avant de décider d'ouvrir) — cohérent avec la logique "friction minimale".

**Exemple concret** (illustratif, à affiner en v1 réelle — pas un texte final validé) :

> **Objet** : Ce soir : un nouvel épisode de *Severance* vous attend
>
> **Objet (cas multi-séries)** : Ce soir : 3 séries suivies ont un nouvel épisode
>
> **Corps** :
> ```
> Ce soir au programme.
>
> Severance — S02·E07 "Chikhai Bardo"
> The Bear — S04·E01 "Amends"
> Slow Horses — S05·E03, S05·E04 (2 épisodes)
>
> [ Voir mon calendrier ]
>
> ---
> Vous recevez cet e-mail car vous suivez ces séries sur tvtrackd.
> Se désabonner des notifications · Gérer mes préférences
> ```

Le CTA pointe vers le calendrier ou l'accueil (état `normal`/`ready_only` déjà construits), pas vers une page dédiée à créer — réutilise l'écran le plus abouti du produit plutôt que d'en générer un nouveau pour cette feature.

---

## 5. Anti-spam / fréquence

- **Cap dur : 1 mail maximum par jour et par utilisateur.** Le digest (§2) rend ce cap presque automatique par construction, mais il doit être une règle explicite et testée, pas une conséquence implicite de l'implémentation.
- **Dédup stricte : un épisode donné ne doit jamais apparaître dans deux digests successifs pour le même utilisateur.** Implique de marquer/logger les épisodes déjà notifiés (voir colonnes proposées en §6) pour éviter qu'un run de cron en échec partiel ne renvoie deux fois la même sortie.
- **Silence si rien de neuf** : si aucun épisode ne sort ce jour-là pour les séries suivies par un utilisateur donné, **aucun mail n'est envoyé** — pas de "digest vide" de courtoisie. Cohérent avec "pas spammy" ; un mail vide ou générique ("rien aujourd'hui, mais restez connecté") serait perçu comme du remplissage, l'antithèse du positionnement.
- **Cas dégénéré** : un utilisateur qui suit énormément de séries actives simultanément (edge case du power user / testeur import massif) ne doit jamais recevoir plusieurs mails le même jour même si le traitement se fait par lots techniques — la dédup doit être au niveau utilisateur, pas au niveau lot de traitement.

---

## 6. Mesure — colonnes/events minimaux à prévoir

Sans analytics en prod (fait acté, §0), la feature doit porter sa propre instrumentation minimale pour être jugée. Proposition de champs à discuter avec le développeur (noms indicatifs, pas un schéma figé) :

| Donnée | Pourquoi | Niveau |
|---|---|---|
| Log d'envoi (date, user_id, liste des `episode_id` inclus dans le digest) | Base de la dédup (§5) et de toute mesure de volume | Indispensable MVP |
| Statut d'envoi (réussi / échoué / bounce) | Fiabilité de délivrabilité — un mail non fiable serait exactement le reproche fait à Betaseries, à ne pas reproduire silencieusement | Indispensable MVP |
| Timestamp d'ouverture (pixel de tracking) | Mesurer si le mail est seulement envoyé ou réellement vu — sans ça impossible de juger l'impact réel du levier | Recommandé MVP (simple à ajouter, fort signal) |
| Clic sur le CTA (paramètre UTM dans le lien vers l'app, cohérent avec le pattern déjà existant dans `showShareUrl`) | Mesure de l'intention de retour, plus fiable que l'ouverture seule | Recommandé MVP — réutilise un pattern déjà présent dans le code (`utm_source` dans `app-config.ts`) |
| Retour effectif dans l'app dans les 24h suivant l'envoi (comparaison timestamp visite / timestamp envoi) | La vraie métrique de rétention recherchée — le clic seul ne prouve pas l'usage | Souhaitable, mais dépend d'un minimum de session tracking qui n'existe pas encore (cf. item #3 de l'étude, "Analytics produit en prod" à traiter en parallèle) |

**Recommandation** : ne pas attendre l'analytics complet (item #3 de l'étude) pour lancer cette feature — les deux premières lignes du tableau (log d'envoi + statut) sont indispensables pour la fiabilité anti-spam elle-même, indépendamment de toute mesure de rétention. Les lignes "ouverture" et "clic" sont un ajout à faible coût qui donne un signal exploitable même en l'absence d'un vrai outil d'analytics produit.

---

## 7. Décisions à trancher par le porteur

| # | Décision | Options | Recommandation de cette spec | Impact si retardé |
|---|---|---|---|---|
| 1 | Opt-in par défaut à l'inscription | Opt-out (activé) vs opt-in strict (désactivé, case à cocher) | Opt-out avec mention explicite + désabonnement 1-clic — mais **avis juridique RGPD recommandé avant de trancher définitivement** | Bloquant avant tout envoi réel — c'est une question de conformité, pas seulement d'UX |
| 2 | Périmètre statut MVP | `en_cours` seul vs `en_cours` + `a_voir` | `en_cours` seul au lancement, `a_voir` en v1.1 selon volume observé | Faible — extension facile plus tard, aucun risque de dette |
| 3 | Heure d'envoi et gestion fuseau | 18h Europe/Paris fixe (MVP) vs heure locale par utilisateur (nécessite colonne `timezone`) | Fixe Europe/Paris pour le MVP, marché francophone assumé | Moyen si internationalisation future — migration simple, pas urgent |
| 4 | Adresse d'expéditeur / domaine d'envoi | Dépend du nom de domaine non tranché (`CLAUDE.md`) | Ne peut pas être tranché avant la décision de nom de domaine — utiliser un domaine d'envoi provisoire (ex. sous-domaine du provider transactionnel) documenté comme temporaire, jamais committer une adresse finale en dur | **Bloquant technique réel** : sans domaine stable, pas de SPF/DKIM fiable, donc risque de délivrabilité dégradée (mails en spam) — expliciter ce risque à l'agent développeur |
| 5 | Traitement du cas "série reprise après `termine` utilisateur" | Inclure dans le digest standard vs message dédié différencié vs hors MVP | Hors MVP, traiter en v1.1 avec un message différencié ("la série reprend") plutôt que noyé | Faible — cas peu fréquent, report sans risque |
| 6 | Granularité opt-out par série | Interrupteur global (MVP) vs préférence fine par série | Global au MVP | Faible — ajout additif plus tard |

---

## Fichiers de référence

- `/home/user/tvtrackd/CLAUDE.md` — schéma, design system, positionnement.
- `/home/user/tvtrackd/etude-etat-des-lieux-2026-08.md` — étude source, §5-6 et §8 en particulier.
- `/home/user/tvtrackd/src/lib/app-config.ts` — `APP_NAME`, `SITE_URL`, pattern `utm_source` déjà existant à réutiliser pour le tracking de clic.
- `/home/user/tvtrackd/supabase/migrations/20260703094535_c9e306dc-1e21-4707-b150-9e210e30df9b.sql` — schéma de base `profiles`/`shows`/`episodes`/`user_shows`/`watch_status`.
- `/home/user/tvtrackd/supabase/migrations/20260703095703_c8c24b4c-c76d-4966-aadd-c13b12752640.sql` — contrainte `UNIQUE(user_id, episode_id)` sur `watch_status`.
- `/home/user/tvtrackd/supabase/functions/` — 11 edge functions existantes (aucune de notification/cron à ce jour).
