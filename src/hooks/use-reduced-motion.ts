import { useEffect, useState } from "react";

/**
 * Live `prefers-reduced-motion: reduce` — used to gate the app's "compteur
 * mécanique" bump/tween effects (`VhsCounter`'s own bump, and its duplicate
 * in `HeroTicket`, src/routes/_public/index.tsx): under `reduce`, callers
 * should skip the numeric tween (ticking count-up) and any `scale-*`
 * transform, jumping straight to the final value instead — a brief color
 * change (e.g. the cyan flash) is still fine to keep, since a color swap
 * isn't the kind of motion `prefers-reduced-motion` is meant to suppress.
 * Same SSR-agnostic pattern as `useIsMobile` (use-mobile.tsx): starts at a
 * default (`false`, i.e. "motion allowed") and corrects itself once mounted.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener("change", onChange);
    setReduced(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
