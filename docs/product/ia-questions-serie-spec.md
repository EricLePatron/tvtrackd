# Spec — Assistant IA de questions sur une fiche série

> Statut : brouillon de cadrage produit. À reprendre par `tvtrackd-developer` pour un plan
> d'implémentation détaillé (edge function + migration + UI) avant tout code.
> Nom de code : `ask-show`.

## 1. Problème & opportunité

Les utilisateurs de trackers de séries se posent en permanence des questions pendant/après
un visionnage : « qui est ce personnage déjà ? », « pourquoi X fait ça ? », « explique-moi la
fin de l'épisode ». Aujourd'hui ils quittent l'app pour Google / Reddit / fandom wikis — et s'y
font spoiler en permanence, parce que ces sources ignorent où ils en sont.

TV Time ferme le 15 juillet 2026 en pivotant justement « vers l'IA » sans jamais avoir livré cet
usage. Betaseries ne l'a pas non plus. Il y a un espace pour l'exécuter correctement.

## 2. La thèse : le spoiler-safe natif comme différenciateur

Un chatbot générique collé sur une fiche est interchangeable (et tombe pile dans le « slop IA »
que le projet refuse). **Ce que seul tvtrackd peut faire**, c'est répondre en connaissant
l'avancement exact de l'utilisateur :

- `watch_status` (une ligne par visionnage) ⋈ `episodes` → dernier épisode vu = **plafond spoiler**.
- L'IA ne reçoit **jamais** de contexte au-delà de ce plafond. Impossible de spoiler ce qui n'a
  pas été vu, même si l'utilisateur pose une question qui invite au spoiler.

C'est l'alignement avec le job-to-be-done n°3 (« social/découverte qui marche ») et l'item
ROADMAP #9 (« anti-spoiler basique », encore non fait). L'anti-spoiler devient une **capacité
serveur réutilisable**, pas juste une consigne d'affichage.

## 3. Périmètre

### MVP
- Module « Poser une question » sur la fiche série (`show.$mediaType.$tmdbId.tsx`), série uniquement
  d'abord (les questions d'intrigue ont plus de sens sur une série que sur un film unitaire).
- Questions en langage naturel, réponses courtes et factuelles.
- **Plafond spoiler strict côté serveur** : le contexte fourni au modèle est filtré aux épisodes
  vus, calculé serveur, jamais confié au prompt seul.
- 2-3 questions suggérées pour amorcer (« Résume-moi où j'en suis », « Qui est [perso principal] ? »).
- Rate-limit par utilisateur (coût API réel) + cache des réponses génériques.
- Utilisateur non connecté : soit CTA de connexion, soit réponses limitées au synopsis global
  (aucune donnée d'avancement disponible → on assume un plafond « saison 1 non commencée »).

### Hors MVP (V2+)
- Films.
- Conversation multi-tours (historique).
- Questions transverses (« quelles séries ressemblent à ça et que je n'ai pas vues »).
- Réponses citant des timestamps / numéros d'épisode cliquables.
- Curseur de spoiler manuel (« je veux quand même la réponse complète »), opt-in explicite.

## 4. Contrainte anti-spoiler (règle dure)

1. Le plafond est calculé **serveur** à partir de `watch_status`, jamais envoyé par le client.
2. Le contexte transmis au modèle = synopsis série + métadonnées/synopsis des épisodes **≤ plafond**.
   Rien au-delà n'entre dans le prompt. La sûreté ne repose pas sur « le modèle a promis de ne pas
   spoiler » : elle repose sur l'absence physique de l'info dans le contexte.
3. Si la réponse *exigerait* une info non-vue, le modèle répond explicitement « tu n'en es pas
   encore là, reviens après l'épisode X » plutôt que d'inventer.

## 5. Esquisse technique (à confirmer par le dev)

- **Edge function `ask-show`** (pattern `get-show-details` : Deno, `_shared/cors.ts`, client
  service-role). Entrée `{ tmdb_id, media_type, question }`. Dérive `user_id` du JWT.
- Calcul du plafond spoiler (RPC ou requête `watch_status` ⋈ `episodes`).
- Assemblage du contexte borné (réutiliser le cache TMDb `shows`/`episodes`, respecter le TTL,
  ne pas re-fetch inutilement — cf. principes CLAUDE.md).
- **Provider LLM : Claude** (défaut CLAUDE.md pour les apps IA). Haiku 4.5 pour le rapport
  coût/latence sur du Q&A court. Nouveau secret Supabase `ANTHROPIC_API_KEY`.
- Prompt système : rôle = aide-mémoire spoiler-safe, ton sobre, ancrage strict sur le contexte
  fourni, refus des hors-sujet, réponse en français.
- Rate-limit + cache (table dédiée ou réutilisation d'un mécanisme existant).

## 6. Garde-fous produit

- **Fiabilité factuelle** : ancrer les réponses sur les synopsis TMDb réels, pas la mémoire du
  modèle (risque d'hallucination sur intrigues précises). Ton « aide à la mémoire », pas « oracle ».
- **Coût** : le rate-limit et le cache ne sont pas optionnels — c'est de l'API payante par requête.
- **UX** : module sobre cohérent « vidéo-club nocturne », pas de widget chatbot flottant générique.
  Pas de nouvelle police/couleur d'accent (design system existant).
- **RLS** : aucune nouvelle table utilisateur sans RLS `user_id = auth.uid()` (log de questions,
  compteur de rate-limit).

## 7. Mesure du succès (à cadrer avec entertainment-analytics-expert)

- Taux d'utilisation du module par fiche vue.
- Taux de questions suggérées vs libres.
- Rétention / satisfaction déclarée (« la réponse t'a aidé ? » pouce haut/bas).
- Coût API par utilisateur actif (garde-fou économique).

## 8. Risques

- Hallucination sur intrigues → perte de confiance. Mitigation : ancrage TMDb + ton mesuré.
- Coût qui dérape → rate-limit + cache + Haiku.
- Fuite de spoiler par un contexte mal borné → tests dédiés sur le calcul du plafond (cas rewatch,
  série jamais commencée, épisodes hors ordre, saisons partielles).
- Feature perçue comme gadget → l'ancrer sur l'angle spoiler-safe dès le MVP, pas en V2.
