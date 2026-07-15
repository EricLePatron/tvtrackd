import { useEffect, useState } from "react";

/**
 * Anime un entier de sa valeur d'affichage courante vers `target`, par
 * petits paliers arrondis — logique extraite de `VhsCounter` (l'animation de
 * "bump" existante) pour être réutilisée par tout compteur mono qui doit
 * "rouler" plutôt que sauter instantanément (cf. refonte fiche série,
 * compteur agrégé "Votre progression").
 *
 * - `enabled=false` : l'affichage reste figé à sa valeur initiale (0 si le
 *   compteur n'a jamais été activé) — utilisé pour bloquer l'anim tant
 *   qu'un bloc n'est pas encore révélé au scroll (cf. `useInViewOnce`).
 *   Quand `enabled` passe à `true`, l'anim se déclenche automatiquement de
 *   la valeur figée vers `target`.
 * - `reducedMotion=true` : saute directement à `target`, jamais de palier.
 */
export function useRollingNumber(
  target: number,
  options: { enabled?: boolean; reducedMotion?: boolean } = {},
) {
  const { enabled = true, reducedMotion = false } = options;
  const [display, setDisplay] = useState(enabled ? target : 0);
  const [bump, setBump] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    if (reducedMotion) {
      setDisplay(target);
      setBump(false);
      return;
    }
    if (display === target) return;
    setBump(true);
    const diff = target - display;
    const steps = Math.min(Math.abs(diff), 6);
    const step = diff / (steps || 1);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setDisplay((d) => (i >= steps ? target : Math.round(d + step)));
      if (i >= steps) {
        clearInterval(id);
        setTimeout(() => setBump(false), 200);
      }
    }, 40);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, enabled, reducedMotion]);

  return { display, bump };
}
