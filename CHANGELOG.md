# Changelog

Ce qui a changé pour vous, en langage simple. Les détails techniques restent dans les pull requests.

## Depuis vendredi 3 juillet

### 🎬 Nouveautés

- **Découverte** : des carrousels "tendances" et "nouveautés" sont apparus sur l'accueil et la recherche, pour trouver quoi regarder sans avoir déjà une idée en tête.
- **Programme sur 90 jours** : l'écran Programme affiche désormais tous les épisodes à venir de vos séries suivies, jour par jour, avec un défilement qui remonte aussi loin que nécessaire dans les épisodes déjà sortis.
- **Fiches série/film enrichies** : plus d'informations TMDb, un repère clair sur "où vous en êtes" (point de reprise), et un synopsis qui évite les spoilers.
- **Import d'historique plus fiable** : l'import de vos données TV Time ou Betaseries détecte mieux le format du fichier et déduit correctement si une série est déjà terminée, en cours ou pas commencée, au lieu de tout marquer "en cours" par défaut.
- **Découverte sans compte** : les nouveaux visiteurs peuvent maintenant parcourir l'app (onboarding en plein écran) avant de décider de s'inscrire.

### 🛠️ Améliorations

- **Accueil clarifié** : séparation nette entre "à voir maintenant" et le programme à venir, pour ne plus confondre un épisode déjà sorti avec un épisode pas encore diffusé.
- **Statut de série simplifié** : les 5 boutons de statut empilés ont été remplacés par un simple menu déroulant.
- **Moins de redondance** : le bouton "Suivre" et le sélecteur de statut ne se chevauchent plus visuellement sur une fiche série.
- **Onboarding plus accueillant** : repère de marque visible en permanence et premier écran plus chaleureux pour les nouveaux visiteurs.

### 🐛 Corrections

- Cliquer sur un épisode incrémentait le compteur au lieu de simplement basculer vu/non-vu — corrigé.
- Contraste insuffisant du badge "vu" sur les fiches série — corrigé.
- Un plantage de la fiche série en production (lié à une migration de genres non appliquée) — corrigé.
- Le bouton "Explorer d'abord" pouvait disparaître pendant le parcours d'onboarding — corrigé.
