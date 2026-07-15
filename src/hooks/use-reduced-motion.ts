import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Live `prefers-reduced-motion: reduce` — utilisé pour désactiver l'anim
 * "compteur mécanique" (tween + `scale-*`) partout où elle apparaît :
 * `VhsCounter`'s own bump, sa duplication locale dans `HeroTicket`
 * (`src/routes/_public/index.tsx`), et les blocs de la fiche série
 * (`ProgressCard`, `NextEpisodeCard`, dérive du hero). Sous `reduce`, les
 * appelants doivent sauter directement à la valeur finale et ne jamais
 * appliquer de `scale-*` — un changement de couleur (ex. le flash cyan)
 * reste acceptable, ce n'est pas le type de mouvement que
 * `prefers-reduced-motion` vise à supprimer.
 *
 * SSR-safe : `window.matchMedia` n'existe pas côté serveur (TanStack Start).
 * L'état initial est `false` ("mouvement autorisé") et se corrige au
 * montage — même garde-fou que `useIsMobile` (`use-mobile.tsx`), utile ici
 * car ce hook est maintenant appelé depuis des routes rendues côté serveur.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(QUERY);
    setReduced(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
