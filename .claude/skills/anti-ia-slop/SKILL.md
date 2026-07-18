---
name: anti-ia-slop
description: >-
  Méthode pour reconnaître et éviter le "slop" visuel de génération IA — ces
  designs statistiquement moyens qui pourraient appartenir à n'importe quel
  produit et ne différencient donc aucun. À utiliser dès qu'on conçoit, maquette
  ou relit un écran, un composant, une landing page, un choix de tokens
  (couleurs, typo, layout, motion) ou une refonte visuelle pour tvtrackd. Ne
  déclenche PAS seulement quand l'utilisateur dit "slop" ou "trop IA" :
  déclenche aussi dès qu'il faut trancher une direction esthétique, choisir une
  palette/typo, poser un hero, une grille de cartes, un empty state, ou juger si
  une proposition "fait générée". Fournit un test de différenciation, un
  catalogue de marqueurs IA daté (2026) et une méthode pour ancrer chaque choix
  dans le concept produit et le marché plutôt que dans la moyenne d'un template.
---

# Anti IA-slop

## Le problème, correctement posé

Un modèle qui génère du design retombe par défaut vers le **centre statistique**
de ce qu'il a vu. Ce centre a une esthétique reconnaissable : gradients violets,
glassmorphism, hero + trois cartes à icône, tout centré, tout arrondi. On
l'appelle « slop ».

L'erreur est de croire que le slop est **laid**. Il ne l'est pas — il est
souvent propre, symétrique, « moderne ». Son défaut est ailleurs : il est
**non-marqué**. Il ne porte aucune information sur *ce* produit-ci. Un design
slop pourrait habiller n'importe quel SaaS ; c'est exactement pourquoi il n'en
distingue aucun.

Reformulé pour tvtrackd : notre thèse produit est qu'on **exécute correctement
là où Betaseries échoue**. Un design qui pourrait être celui de n'importe quelle
app détruit cette thèse avant même le premier pixel de contenu. Le slop n'est
pas un problème de goût, c'est un problème de **positionnement**.

## Le test central : le swap de marque

Avant de valider un choix visuel majeur (palette, typo, structure d'un écran,
traitement d'un composant signature), applique **le test du swap** :

> Si je remplace le logo et les textes par ceux d'un autre produit — un CRM, une
> app de fitness, un outil de facturation — est-ce que quelqu'un remarquerait
> que le design ne lui appartient pas ?

- **Si la maquette survit au swap sans broncher → c'est du slop.** Le design est
  détaché du produit ; il flotte.
- **Si la maquette « casse » au swap** (le compteur VHS n'a plus de sens sur un
  CRM, le hero « Ce soir » sonne faux sur une app de facturation) → le design est
  **soudé au concept**. C'est ce qu'on veut.

Un bon design est *fragile au swap* par construction. Cette fragilité est la
preuve qu'il dit quelque chose de spécifique.

## Catalogue des marqueurs (daté 2026 — à réviser)

Ces motifs ne sont pas interdits en soi. Ils sont des **drapeaux** : leur
présence exige une justification liée au concept, sinon on les retire. La plupart
sont slop parce qu'ils sont *le réglage par défaut d'un générateur*, pas un choix.

**Palette / couleur**
- Le dégradé violet→indigo→bleu « SaaS 2020-2024 » posé sans raison.
- Halos lumineux (glow) et blur diffus derrière les titres pour « faire premium ».
- Glassmorphism par défaut (au-delà d'un `backdrop-blur` fonctionnel sur un
  contrôle posé sur une image).
- Les trois défauts déjà listés dans CLAUDE.md, à traiter comme des cas
  particuliers de slop : crème + serif haut-contraste + terracotta ; noir +
  accent acid-green/vermillon unique ; broadsheet à hairlines et colonnes denses.

**Structure / layout**
- Hero centré + exactement **trois cartes** de features à icône dans un rond.
- Bento grid utilisée comme décor, indépendamment du contenu à organiser.
- Tout centré, tout de poids égal (l'œil ne sait pas où regarder → « mur de blocs »).
- Symétrie parfaite, aucune tension intentionnelle, aucun élément qui « déborde ».
- Sur-arrondi généralisé (tout en pill), ombres portées uniformes partout.

**Typo / iconographie**
- Une seule police « moderne » (Inter/Geist) sans hiérarchie assumée.
- Emoji comme marqueurs de section ou de features.
- Icônes rondes décoratives sans fonction (un rond coloré derrière chaque icône).

**Motion**
- `fade-up on scroll` appliqué à *chaque* élément, sans hiérarchie d'événement.
- Animations en boucle continue qui décorent au lieu de signaler.

**Copie (le slop textuel trahit le slop visuel)**
- Microcopy interchangeable : « Elevate your experience », « Seamless »,
  « Effortless », « The future of… ».
- Stats rondes non sourcées (« 10k+ utilisateurs », « 99% de satisfaction »)
  posées pour remplir. Sur tvtrackd, une stat non réellement calculée est
  doublement interdite (c'est le remplissage cassé reproché à Betaseries).

Quand un de ces marqueurs apparaît, pose-toi une seule question : *est-ce un
choix relié au concept, ou le réglage par défaut ?* Si tu ne peux pas répondre en
une phrase reliée au concept, c'est le défaut — retire ou remplace.

## La moitié constructive : concevoir depuis le marché, pas depuis la moyenne

Éviter le slop en supprimant des marqueurs ne suffit pas : on obtient un design
*vide* au lieu de *générique*. La sortie n'est pas la soustraction, c'est
**l'ancrage**. Tout choix visuel structurant doit pouvoir se tracer à l'un de ces
trois ancrages — sinon c'est un candidat slop :

1. **Le concept** — « vidéo-club nocturne modernisé », le rituel du visionnage,
   le compteur mécanique façon VHS. (cf. CLAUDE.md, section Direction design)
2. **Le marché** — tracker francophone dont l'émotion centrale est la *fiabilité
   perçue* ; audience traumatisée par la fermeture de TV Time sur la question de
   la donnée durable. La sobriété EST une émotion ici.
3. **L'écart concurrentiel** — ce que Betaseries rate (exécution datée,
   incohérence, bugs) et qu'on occupe en faisant l'inverse : tenue, cohérence,
   finesse.

Méthode de travail :
- **Avant de concevoir**, nomme explicitement l'ancrage visé pour l'écran. Une
  phrase : « cet écran sert l'anticipation du prochain épisode, traité comme un
  talon de billet ». Pas d'ancrage nommé → tu vas glisser vers le défaut.
- **Pendant**, passe chaque choix majeur au test du swap.
- **Après**, audite contre le catalogue de marqueurs ci-dessus.
- Pour les choix **signature**, écris une *note de provenance* d'une ligne :
  quel choix, tracé à quel ancrage, pourquoi lui plutôt que le défaut. Si tu ne
  peux pas l'écrire, le choix n'est probablement pas mérité.

## « Adapté aux marchés » : le slop est relatif à un marché

Le point le plus important, et le plus négligé : **il n'existe pas d'esthétique
universellement anti-slop.** Ce qui lit comme « générique » dépend du marché, de
la culture et du set de références de l'audience.

- Le look « dark + gradient violet façon Vercel/Linear » est lui-même un **défaut
  régional** (SaaS US). Le transplanter tel quel sur un produit francophone grand
  public de suivi de séries, c'est importer le slop d'un *autre* marché — ça sonne
  « template traduit de l'US », pas « natif ».
- Le set de références pertinent pour tvtrackd n'est pas celui des landing pages
  YC : c'est **Betaseries, Allociné, TV Time, Letterboxd, l'app Apple TV, les
  codes du programme TV et du vidéo-club**. Concevoir « adapté au marché » = puiser
  dans *ce* set-là, pas dans la moyenne globale d'un générateur.

Règles d'adaptation au marché :
- **Connaître le set de références réel de l'audience** avant de trancher une
  direction (au besoin, vérifier via WebSearch/WebFetch une UI concurrente
  récente plutôt que se fier à un souvenir daté).
- **Localiser les conventions** : densité d'information, ton, formulations, unités
  (dates FR, « saison/épisode » et non « S/E » anglo), ce qui lit comme premium ou
  comme cheap varie d'un marché à l'autre.
- **Ne jamais transplanter un template d'un autre marché en bloc.** Un motif
  emprunté doit être re-justifié dans *notre* concept et *notre* marché, sinon
  c'est le swap qui échoue.

Le slop, au fond, c'est la moyenne d'un marché qui n'est pas le nôtre, appliquée
au nôtre.

## Garde-fous propres à tvtrackd

- **Ne pas sur-corriger vers un autre cliché.** Fuir le slop générique en tombant
  dans le pastiche VHS littéral (scanlines, texture bruit, icône cassette) est le
  même échec sous un autre masque : c'est un défaut *de genre* au lieu d'un défaut
  *de SaaS*. La signature VHS reste un compteur mécanique sobre, un seul risque
  esthétique assumé, tout le reste discipliné autour.
- **Rester dans les tokens** (accents ambre `#FF8A3D` / cyan `#4DD9C4`, polices
  Archivo Expanded / Inter / IBM Plex Mono). Introduire une couleur ou une police
  « pour faire moderne » est un marqueur slop en soi.
- **L'anti-slop ne justifie jamais** d'ajouter de la latence à une action de
  tracking (optimistic UI non négociable) ni d'inventer une donnée pour « habiller »
  un écran.
- En cas de doute entre deux directions à fort impact, présente les options avec
  leur note de provenance et leurs trade-offs plutôt que de trancher seul —
  l'anti-slop est un cadre de jugement, pas un verdict automatique.

## En une phrase

Ne demande pas « est-ce que c'est beau ? » — demande **« est-ce que ce serait
exactement pareil pour un autre produit, sur un autre marché ? »**. Si oui,
c'est du slop, quelle que soit sa propreté. Si le design casse quand on retire
tvtrackd de dessous, il est à sa place.
