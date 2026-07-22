# Étude UX — Recherche utilisateur simulée (100 users)

> ⚠️ **Étude simulée, pas une recherche terrain.** Panel fictif de 100 profils construits à partir des personas de `CLAUDE.md`, testés sur un protocole de tâches simulé. Les verbatims sont des constructions crédibles dans le ton des communautés réelles (TV Time, BetaSeries, Trakt, Letterboxd, Serializd), **pas des citations attribuables à de vraies personnes**. Les chiffres sont des ordres de grandeur pour prioriser, pas des données mesurées. À valider par une vraie recherche primaire avant tout arbitrage lourd.

Synthèse de 3 vagues d'étude simulée (produit, design, puis analyse globale après deux évolutions produit : suppression du rewatch au profit d'un marquage/démarquage groupé jusqu'à la série entière, et modélisation de deux états d'utilisateur « à jour » / « en retard »).

---

## 1. Panel & méthodologie

Test de première utilisation simulé sur le MVP (auth, recherche/fiche TMDb, tracking épisode, bibliothèque avec statuts, calendrier hero « Ce soir » + rail « Programme », import CSV/JSON, export JSON, stats). Tâches types : inscription, import d'historique, marquage, calendrier, archivage/désarchivage, export.

### Segments du panel (n=100)

| Segment | n | Provenance | Device |
|---|---|---|---|
| Migrant TV Time traumatisé (perte de données) | 38 | TV Time (fermé 15/07) | Mobile |
| Déçu BetaSeries (reste par défaut) | 18 | BetaSeries | Mixte |
| Binger casual | 14 | TV Time / aucun | Mobile |
| Néophyte | 10 | Aucun | Mobile |
| Power-user Trakt | 8 | Trakt.tv | Desktop |
| Social / casual | 7 | TV Time / bouche-à-oreille | Mobile |
| Collectionneur de data | 5 | TV Time + Trakt + tableur | Desktop |

71 % mobile-first · 82 % francophones · âge médian ~27 ans (aile 35-45 chez les migrants de longue date).

### Nouveau croisement : l'état de visionnage

| État | n/100 | Profil type | Besoin de home |
|---|---|---|---|
| **À jour** (a tout vu, attend les sorties) | 28 | Power-users Trakt, néophytes | Anticipation : compte à rebours, calendrier |
| **Mixte** (à jour sur certaines séries, en retard sur d'autres) | 46 | Majorité par défaut dès 3+ séries suivies | Les deux à la fois |
| **En retard** (backlog à rattraper) | 26 | Bingers, migrants au backlog révélé | Rattrapage : reprise rapide, nettoyage backlog |

> 💡 **Insight structurant** : le cas réaliste par défaut est **mixte (46/100)**. Concevoir la home pour un seul état pénalise mécaniquement plus de la moitié du panel.

---

## 2. Compréhension — les utilisateurs savent-ils quoi faire ?

Lecture écran par écran de la clarté de l'action principale (affordance), du wording et de la hiérarchie visuelle.

| Écran | Compris d'emblée | Friction / mauvaise lecture | n/100 |
|---|---|---|---|
| **Hero « Ce soir » — sens** | 73/100 | Ambiguïté « ma prochaine série » vs « grille TV générale » — le libellé seul ne porte pas la personnalisation | 27 |
| **Hero « Ce soir » — affordance** | 61/100 | Perçu comme décoratif (« étiquette de cassette »), l'utilisateur cherche un bouton ailleurs | 39 |
| Rail « Programme » | 82/100 | Scroll horizontal non détecté sur mobile (pas d'indice de continuité en bord) | 18 |
| Recherche | 93/100 | Versions confondues (remake US/UK) faute de badge différenciant | 7 |
| Fiche série (statuts) | 88/100 | Statut actif peu distinct quand les boutons se ressemblent en poids | 12 |
| Chip grille bibliothèque (`S02·E06` sans fraction) | 67/100 | Complétionnistes cherchent la fraction chiffrée « 8/12 », pas seulement la barre | 33 |
| Écran d'import (résolution ambiguïtés) | 76/100 | Effet d'un « passer » non expliqué (importé quand même ? ignoré ?) | 24 |
| Export JSON | 81/100 | Aucune confirmation « X séries / Y épisodes exportés » | 19 |

> 🎯 **Le pain point de compréhension le plus persistant = le hero « Ce soir ».** 27/100 ne comprennent pas qu'il s'agit de *leur* prochain épisode (vs une grille TV générale), et 39/100 ne perçoivent pas qu'il est **cliquable/actionnable**. C'est un problème sur le tout premier écran vu par un nouvel utilisateur. *« Au début j'ai cru que c'était une grille de chaînes, j'ai mis 10 secondes à comprendre que c'était MA série. »* · *« Le visuel est chouette mais je pensais que c'était juste illustratif. »*

### Découvrabilité des features

| Feature | Découverte spontanée | Commentaire |
|---|---|---|
| Marquage d'épisode vu | 98/100 | Aucune ambiguïté sur l'action de base |
| Calendrier « Programme » | 82/100 | Visible dès l'accueil |
| Changement de statut | 74/100 | Trouvé sur la fiche, moins depuis la grille |
| Archivage | 68/100 | Pas de point d'entrée unique mémorisé |
| Stats basiques | 61/100 | Peu mises en avant, jamais consultées en récurrent |
| **Export** | 54/100 | Enfoui dans le profil — jamais découvert « en passant » |
| **Persistance historique après désarchivage** | Faible spontanément, 100 % de succès une fois guidé | La fonctionnalité marche parfaitement mais reste invisible |

> 🔒 **Paradoxe stratégique** : les deux features de **confiance** censées convaincre les migrants — l'**export** et la **persistance de l'historique après désarchivage** (le bug signature de BetaSeries, ici jamais reproduit) — sont précisément les plus **enterrées** dans l'UI. Problème de mise en scène, pas de fonctionnalité manquante.

---

## 3. Jugement design & parti-pris « vidéo-club nocturne »

**Parti-pris global** : Aimé 61 · Neutre 27 · Rejeté 12. ~70/100 le jugent **plus premium que BetaSeries**.

**Compteur VHS signature** : Aimé 58 · Neutre 29 · « Gimmick » 13. Rejet concentré chez bingers & power-users (ralentit le marquage en rafale).

- **Nostalgiques VHS (28/100)** : adhésion forte et émotionnelle. *« Ça me rappelle le magnétoscope de mes parents, bien trouvé sans être too much. »*
- **Jeunes sans référence VHS (34/100)** : mitigés — lisent « thème sombre avec chiffres orange » sans percevoir la référence culturelle.
- **Accessibilité** : contraste `--text-muted` trop faible en plein soleil sur mobile (19/100), chiffres Plex Mono trop petits dans le chip grille pour les 35+ (11/100), statuts ambre/cyan distingués par la seule couleur — risque daltonisme (4/100).

---

## 4. Les deux évolutions produit — ce que ça change

**✅ Résolu par la fin du rewatch + marquage groupé (épisode / saison / série)**

- **Pas d'action groupée « marquer la saison/série vue » (61/100)** — le pain point le plus fréquent de toute l'étude disparaît.
- **Ambiguïté « 2e tap = annuler ou revoir ? » (42/100)** — le modèle mental redevient un toggle binaire universel (comme TV Time / BetaSeries / Trakt). Le pire risque de compréhension n'a plus de raison d'être.
- **Compteur VHS « gimmick ralentisseur » chez les bingers** — passe de 8/14 à 3/14 : le « saut » du compteur lors d'un marquage groupé devient *satisfaisant* plutôt qu'une gêne.

**🆕 Nouveaux risques introduits**

- **Démarquage accidentel en masse (24/100, sévérité élevée)** — sans historique multi-lignes, un mauvais clic sur « tout démarquer » au niveau série efface des années d'historique sans filet. *« Un mauvais clic et je perds 6 ans d'un coup. »* → besoin de **confirmation / undo** avant de mettre en avant le marquage groupé.
- **Perte du comptage de rewatch (9/100, faible mais réelle)** — surtout les collectionneurs de data. À surveiller, pas urgent.
- **Le compteur VHS doit gérer le « saut en bloc »**, pas seulement l'incrément unitaire.

---

## 5. La home différenciée — le nouveau centre de gravité

La home actuelle (hero « Ce soir » mono-slot) suppose implicitement « j'ai un truc à voir maintenant » — un seul des trois états.

| État | Ce qui cloche aujourd'hui | Signal chiffré | Risque de rétention |
|---|---|---|---|
| **À jour** | Hero vide/inerte entre deux sorties, pas de compte à rebours | 33/100 exposés à l'état vide ; **21/33 décrochent** | Désengagement silencieux des utilisateurs **les plus assidus** |
| **En retard** | Hero met en avant *un* épisode alors qu'il y a un backlog entier ; volume brut anxiogène | 51/100 « la home ne reflète pas ma situation » ; 29/100 découragés par le volume | Procrastination / abandon par submersion |
| **Mixte (majoritaire)** | Le slot unique ne montre qu'un état et masque l'autre | 38/46 disent ne voir « que la moitié du tableau » | Cumule les deux risques |

> 🏠 **Besoin clé** : une **home à deux signaux** — un signal « à rattraper » (nb d'épisodes en attente + accès direct au marquage groupé pour nettoyer le backlog) et un signal « à venir » (prochaine sortie / compte à rebours) — coexistant, hiérarchisés, sans se concurrencer. Synergie forte : le marquage groupé est exactement l'outil qui apaise le risque de submersion des « en retard ».

---

## 6. Daily active — revu par état

| État | Nature du risque | Levier de rappel pertinent |
|---|---|---|
| **À jour** | Désengagement par absence de stimulus — rien à montrer entre deux sorties | **Notification push « nouvel épisode » = condition structurelle** du daily active (sans elle, aucune raison objective de revenir) + compte à rebours passif |
| **En retard** | Procrastination / découragement (pas un oubli d'ouvrir) | PAS plus de stimuli — relance douce après inactivité + reprise facilitée + nettoyage par marquage groupé |
| **Mixte** | Les deux en parallèle sur des séries différentes | Notifications différenciées **par série** + home à deux signaux |

Hooks complémentaires (récap hebdo poussé, jalons célébrés sur le compteur VHS) : utiles surtout aux « à jour », car ils créent des occasions de rappel **indépendantes de la sortie d'un épisode**.

---

## 7. Tableau des évolutions classées par priorité

Classement par priorité d'exécution. **P0** = à faire avant/juste après la mise en avant du marquage groupé · **P1** = quick wins à fort ratio impact/effort · **P2** = paris structurants · **P3** = backlog / veille · **Arb.** = à arbitrer, pas à trancher en recherche.

| Prio | Évolution | Problème résolu (chiffré) | Impact activ./rétention | Effort | Agent / lien |
|---|---|---|---|---|---|
| **P0** | Confirmation / undo avant démarquage en masse (niveau série) | Nouveau risque : démarquage accidentel (24/100) | Élevé (confiance) | Faible | `entertainment-product-expert` |
| **P1** | Hero « Ce soir » : lever l'ambiguïté de sens (wording explicite « votre prochain épisode ») **et** renforcer l'affordance cliquable | Compréhension : 27/100 (sens) + 39/100 (affordance) | Élevé | Faible | `entertainment-design-expert` |
| **P1** | État vide du hero → compte à rebours vers la prochaine sortie (au lieu d'un néant) | Décrochage « à jour » (21/33 exposés) | Élevé | Faible-moyen | `entertainment-design-expert` |
| **P1** | Mettre en avant le marquage groupé comme outil de « nettoyage de backlog » (post-import + home « en retard ») | Submersion « en retard » (29/100) | Élevé | Faible (réutilise l'acquis) | `entertainment-product-expert` + design |
| **P1** | Rendre visible la persistance de l'historique après désarchivage (message de réassurance) | Feature de confiance invisible (anti-BetaSeries) | Élevé (confiance) | Faible | `entertainment-design-expert` |
| **P1** | Sortir l'export de son enfouissement + résumé post-export (« X séries, Y épisodes ») | Export peu découvert (54/100) + doute complétude (19/100) | Élevé (confiance) | Faible-moyen | `entertainment-product-expert` |
| **P1** | Auth sociale Google / Apple à l'inscription | Friction onboarding (39/100) | Moyen-élevé | Faible | `entertainment-product-expert` |
| **P1** | Export CSV en complément du JSON | Portabilité jugée faible (21/100, segment prescripteur) | Moyen (bouche-à-oreille) | Faible | `entertainment-product-expert` |
| **P1** | Remonter le contraste de `--text-muted` (lisibilité extérieure) + repère non-couleur pour les statuts (a11y) | Accessibilité (19/100 + 4/100) | Moyen | Faible (token) | `entertainment-design-expert` |
| **P1** | Cadrage doux du volume de backlog à l'import (éviter « 340 épisodes non vus » brut) | Découragement à l'import (29/100) | Moyen-élevé | Faible (copie) | `entertainment-design-expert` (microcopy) |
| **P1** | Indiquer le résultat d'un « passer » pendant la résolution d'ambiguïtés d'import | Confusion import (24/100) | Moyen | Faible | `entertainment-design-expert` |
| **P2** | **Home à deux signaux** : compte à rebours prochaine sortie (« à jour ») + backlog visible avec accès marquage groupé (« en retard ») | Rétention sur les 3 états (touche la quasi-totalité du panel) | Très élevé | Élevé (refonte hero) | `entertainment-product-expert` + design |
| **P2** | Notifications push différenciées par état (« nouvel épisode » pour à jour · relance réengagement pour en retard) | Daily active (51/100) — vital pour ~30 % du panel | Très élevé | Élevé (backlog CLAUDE.md) | `entertainment-product-expert` |
| **P2** | Barre de progression + aperçu avant import (dry-run) | Anxiété/abandon import (44-54/100) | Élevé | Moyen | `entertainment-product-expert` |
| **P2** | Affinage du scoring de matching TMDb (auto-accepter les correspondances sûres, ne remonter que les vraies ambiguïtés) | Charge de résolution sur gros historiques / anime (54/100) | Élevé | Moyen | `entertainment-product-expert` |
| **P2** | Adapter l'animation du compteur VHS au marquage groupé (saut lisible et satisfaisant) | Préserve l'élément signature après le changement | Moyen | Faible-moyen | `entertainment-design-expert` |
| **P2** | Moteur de recommandation / découverte | Absence de reco (33/100) | Moyen | Élevé | `entertainment-product-expert` |
| **P3** | Import Trakt via OAuth (« connecter mon compte ») | Segment minoritaire mais prescripteur (23/100) | Moyen (fidélise) | Élevé | `entertainment-product-expert` |
| **P3** | Récap hebdo/mensuel poussé (à partir des stats existantes) | Hook de rappel indépendant des sorties | Élevé (rétention « à jour ») | Moyen | `entertainment-product-expert` |
| **P3** | Affiches plus grandes façon Letterboxd sur certains écrans | Attente « collection » (16/100) | Faible-moyen | Moyen | `entertainment-design-expert` |
| **P3** | Messaging de réassurance sur la pérennité / le modèle économique | Méfiance post-TV Time (22-26/100) | Moyen | Faible (contenu) | `marketing-communication-expert` |
| **P3** | Veille : regret de la perte du comptage de rewatch (option légère type badge « revu ») | Signal minoritaire (9/100) | Faible | — | `entertainment-product-expert` (veille) |
| **Arb.** | Ré-examiner le chip de grille sans fraction chiffrée | Complétionnistes frustrés (33/100) — mais choix déjà assumé dans CLAUDE.md | Moyen | Faible à doc. | `entertainment-design-expert` |
| **Arb.** | Thème clair / mode jour | Demande (17/100) — contredit l'identité « écran éteint » | Faible | Élevé | `entertainment-design-expert` |
| **Arb.** | Demande de couleur/ludique façon TV Time | 22/100 — à **refuser** (cartoonesque abandonné), compenser la chaleur par micro-interactions | — | — | `entertainment-design-expert` + skill anti-ia-slop |

> 🧭 **Lecture d'ensemble** : les deux évolutions produit éliminent les frictions les plus coûteuses de l'étude (marquage groupé 61/100, ambiguïté du 2e tap 42/100) et déplacent le problème central vers **la home** — qui, conçue pour un seul scénario, laisse décrocher les plus assidus (vide inerte) et submerge les retardataires. Les deux leviers qui décident du daily active sont désormais la **home à deux signaux** et les **notifications différenciées par état**. Seul prérequis avant de mettre en avant le marquage groupé : la **confirmation/undo sur le démarquage série** (P0).

---

## 8. Limites

Simulation construite pour éclairer la priorisation, pas une mesure réelle. Deux priorités de validation terrain : (1) tester si l'état vide du hero produit un décrochage mesurable chez les « à jour » ; (2) valider par test d'utilisabilité qu'une home à deux signaux reste lisible sans contredire la sobriété du design system. Un test modéré sur les écrans **hero « Ce soir »**, **import** et **home par état** donnerait la base la plus fiable.

Deux faits ancrés par desk research réelle : conditions de fermeture de TV Time (annonce 02/07/2026, ~13 jours pour exporter avant suppression le 15/07) et bugs de synchro BetaSeries documentés sur le forum officiel.
