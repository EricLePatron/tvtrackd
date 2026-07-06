import { Check, Minus } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TOGGLE_BASE_CLASSES =
  "grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

/**
 * Toggle tri-state pour marquer une saison entière vue/non vue.
 * - Non coché / indéterminé -> clic = marquer vu (n'affecte que les épisodes
 *   déjà diffusés et pas encore vus, cf. logique côté appelant).
 * - Coché (saison entièrement vue) -> clic = démarquer, avec confirmation
 *   car ça supprime l'historique de rewatch de toute la saison.
 */
export function SeasonToggle({
  seasonNumber,
  state,
  disabled,
  onMark,
  onUnmark,
}: {
  seasonNumber: number;
  state: boolean | "indeterminate";
  disabled: boolean;
  onMark: () => void;
  onUnmark: () => void;
}) {
  if (state === true) {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-pressed="true"
            aria-label={`Marquer la saison ${seasonNumber} non vue`}
            className={cn(
              TOGGLE_BASE_CLASSES,
              "border-cyan-accent bg-cyan-accent/10 text-cyan-accent hover:bg-cyan-accent/20",
            )}
          >
            <Check className="h-4 w-4" />
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Démarquer la saison {seasonNumber} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Ça supprime l'historique de visionnage de tous les épisodes de cette saison, y compris
              les revisionnages. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={onUnmark}
              className={cn(buttonVariants({ variant: "destructive" }))}
            >
              Démarquer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  if (state === "indeterminate") {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onMark}
        aria-pressed="mixed"
        aria-label={`Marquer le reste de la saison ${seasonNumber} vue`}
        className={cn(
          TOGGLE_BASE_CLASSES,
          "border-primary/60 bg-primary/15 text-primary hover:border-primary hover:bg-primary/20",
        )}
      >
        <Minus className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onMark}
      aria-pressed="false"
      aria-label={`Marquer la saison ${seasonNumber} vue`}
      className={cn(
        TOGGLE_BASE_CLASSES,
        "border-border bg-surface-elevated text-muted-foreground hover:text-primary hover:border-primary/60",
      )}
    >
      <Check className="h-4 w-4 opacity-40" />
    </button>
  );
}
