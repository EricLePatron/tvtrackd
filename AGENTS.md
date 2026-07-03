<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Politique de développement

Toute implémentation de code sur ce repo (features, fixes, refactors,
migrations) doit être déléguée à l'agent `.claude/agents/tvtrackd-developer.md`.
C'est le seul agent autorisé à écrire ou modifier du code applicatif. Il
fonctionne en deux temps : il propose d'abord un plan de recherche/développement
et n'implémente qu'après validation explicite de ce plan par l'utilisateur.

Les décisions produit (benchmark concurrentiel, priorisation, personas) relèvent
de l'agent `.claude/agents/entertainment-product-expert.md`.

