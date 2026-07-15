import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

/**
 * Révélation "une seule fois" au scroll (fondu+montée des cartes, roll des
 * compteurs VHS, remplissage des barres — cf. refonte fiche série). Se
 * déconnecte de l'IntersectionObserver dès la première intersection : pas de
 * ré-animation en boucle si l'utilisateur remonte/redescend la page.
 *
 * Garde-fou `prefers-reduced-motion` : `inView` vaut `true` dès le montage,
 * sans jamais observer — tout ce qui dépend de ce hook doit donc traiter
 * `inView === true` comme "état final", jamais comme un signal d'anime.
 */
export function useInViewOnce<T extends HTMLElement>(threshold = 0.25) {
  const ref = useRef<T | null>(null);
  const reducedMotion = useReducedMotion();
  const [inView, setInView] = useState(reducedMotion);

  useEffect(() => {
    if (reducedMotion) {
      setInView(true);
      return;
    }
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      // Pas d'IO disponible (SSR, environnement de test) : révéler
      // directement plutôt que de laisser le contenu invisible pour de bon.
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            io.disconnect();
          }
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reducedMotion, threshold]);

  return { ref, inView };
}
