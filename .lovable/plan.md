## Objectif
Rendre l'app consultable sans compte (accueil, recherche, calendrier, fiche série/film), et rediriger vers `/auth` uniquement quand une action nécessite un compte (suivre, marquer un épisode, etc.). Ajouter un CTA "Se connecter / Créer un compte" visible partout.

## Approche

### 1. Déplacer les routes consultables hors de `_authenticated/`
Les surfaces publiques deviennent des routes top-level (SSR-on par défaut) :
- `_authenticated/index.tsx` → `index.tsx` (remplace le placeholder actuel s'il y a lieu)
- `_authenticated/search.tsx` → `search.tsx`
- `_authenticated/calendar.tsx` → `calendar.tsx`
- `_authenticated/show.$mediaType.$tmdbId.tsx` → `show.$mediaType.$tmdbId.tsx`

Restent sous `_authenticated/` (nécessitent obligatoirement un compte) :
- `library.tsx` (bibliothèque perso)
- `profile.tsx` (profil + import/export)

### 2. Layout partagé public + privé
Créer un composant `AppShell` (layout wrapper avec `<BottomNav />` + max-w-lg + padding). Utilisé par :
- Un nouveau layout pathless `_public.tsx` qui wrap les routes publiques
- Le layout `_authenticated/route.tsx` (déjà en place, on remplace son JSX inline par `AppShell`)

Alternative plus simple : garder chaque route responsable de son shell, mais un layout partagé évite la duplication. → **Choix : layout `_app.tsx` pathless qui englobe tout** (public + privé), et `_authenticated` devient un layout enfant qui n'ajoute que le gate auth, sans shell. Structure finale :
```
_app.tsx                     (shell: BottomNav + container)
├── _app/index.tsx
├── _app/search.tsx
├── _app/calendar.tsx
├── _app/show.$mediaType.$tmdbId.tsx
└── _app/_authenticated.tsx  (ssr:false + gate auth uniquement)
    ├── _app/_authenticated/library.tsx
    └── _app/_authenticated/profile.tsx
```

### 3. Hook `useAuthGate`
Créer `src/hooks/use-auth-gate.ts` exposant :
```ts
const { requireAuth } = useAuthGate();
// usage : requireAuth(() => followShow(id), { reason: "suivre cette série" })
```
Si pas de session → toast "Connectez-vous pour suivre cette série" + `navigate({ to: "/auth", search: { redirect: currentPath } })`. Sinon exécute le callback.

### 4. Mettre à jour `auth.tsx`
Lire `redirect` en search param et rediriger dessus après succès (au lieu de `/`). Valider que c'est un chemin same-origin.

### 5. CTA de connexion omniprésent
- **BottomNav** : quand pas de session, remplacer les items "Bibliothèque" et "Profil" par un item unique "Se connecter" pointant vers `/auth`. (Les icônes restent identifiables.) Alternative : garder tous les items mais ceux qui pointent vers du protégé déclenchent la redirection auth naturellement via le gate `_authenticated`.
- **Header** : ajouter dans `screen-header.tsx` un bouton "Se connecter" à droite quand pas de session, un avatar/menu sinon.
- Sur les cartes/écrans avec CTA "Suivre" / "Marquer vu" : le bouton reste visible, le clic passe par `useAuthGate`.

### 6. Session côté client sur les routes publiques
Les routes publiques sont SSR : `useAuth()` (client-only) reste OK, mais l'état initial est "loading". Les composants qui affichent un CTA différent selon session doivent gérer le flash. → utiliser `useAuth()` avec fallback "non connecté" pendant le loading (le CTA "Se connecter" est le safe default).

### 7. Composants "Home" à ajuster
`home/ready-list-item.tsx`, `discovery-*`, `upcoming-*` : les actions "suivre" / "voir" doivent passer par le hook. Pas de changement de rendu pour les visiteurs — juste le handler protégé.

## Fichiers impactés
- Déplacements (git mv) : 4 routes de `_authenticated/` → nouveaux emplacements sous `_app/`
- Créés : `src/routes/_app.tsx`, `src/hooks/use-auth-gate.ts`, potentiellement `src/components/app-shell.tsx`
- Modifiés : `src/routes/_authenticated/route.tsx` (ou son remplaçant), `src/routes/auth.tsx`, `src/components/bottom-nav.tsx`, `src/components/screen-header.tsx`, composants home avec actions protégées, hooks `use-quick-follow.ts` (intégrer le gate)
- `routeTree.gen.ts` se régénère seul.

## Risques
- **SSR + Supabase auth** : les routes publiques rendent en SSR sans session → normal, le contenu public ne dépend pas de l'user. Ne PAS appeler de serverFn `requireSupabaseAuth` dans leurs loaders.
- **Fiche série** : actuellement sous `_authenticated`, elle appelle probablement des hooks utilisateur (statut suivi). À rendre tolérant à `user == null`.
- **BottomNav** : le rendu conditionnel session peut flash entre SSR (pas de session) et client (session hydratée). Acceptable, mais à surveiller.
- Les liens internes (`<Link to="/library">` etc.) restent valides — TanStack conserve les paths, seule l'arborescence de fichiers change.

## Vérification
- `bun run lint` + build
- Test navigateur sans session : accueil, recherche, calendrier, fiche série accessibles ; clic "suivre" → toast + redirect `/auth?redirect=…` ; après login, retour sur la page d'origine
- Test avec session : comportement inchangé, bibliothèque + profil OK

---

Valides-tu cette approche ? Points à trancher si besoin :
1. **Structure de routes** : option `_app.tsx` + `_app/_authenticated/` (proposée) vs garder plat et dupliquer le shell — je recommande l'option `_app`.
2. **BottomNav pour visiteurs** : cacher Bibliothèque/Profil ou les laisser (avec redirect auto au clic) ? Je recommande de les laisser visibles avec redirect — plus découvrable.
3. **Fiche série publique** : OK pour rendre la fiche entièrement lisible sans compte, avec seulement les actions (suivre/marquer) gatées ?
