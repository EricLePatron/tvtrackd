import { ArrowLeft } from "lucide-react";
import { useRouter } from "@tanstack/react-router";

/**
 * Bouton retour qui utilise l'historique du navigateur/router pour revenir
 * à la page précédente. Si aucune entrée précédente n'est disponible
 * (ex : accès direct par URL), on retombe sur `fallbackTo` (par défaut `/`).
 */
export function BackButton({
  fallbackTo = "/",
  className = "rounded-full border border-border bg-card p-2 text-muted-foreground",
  ariaLabel = "Retour",
}: {
  fallbackTo?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const router = useRouter();

  const onClick = () => {
    // history.length > 1 signifie qu'il y a au moins une entrée précédente
    // dans la session courante ; sinon on renvoie vers le fallback.
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.history.back();
    } else {
      router.navigate({ to: fallbackTo });
    }
  };

  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className={className}>
      <ArrowLeft className="h-4 w-4" />
    </button>
  );
}
