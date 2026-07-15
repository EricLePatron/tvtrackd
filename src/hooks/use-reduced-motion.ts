import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Hook générique `prefers-reduced-motion`, réutilisable au-delà de la fiche
 * série. SSR-safe : `window.matchMedia` n'existe pas côté serveur (TanStack
 * Start), donc l'état initial est `false` et se corrige au montage — jamais
 * de throw, jamais d'animation lancée par erreur côté serveur puisque
 * aucune animation ne s'exécute avant l'hydratation de toute façon.
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
