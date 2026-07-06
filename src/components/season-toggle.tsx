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
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

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
          <Checkbox
            checked
            disabled={disabled}
            aria-label={`Marquer la saison ${seasonNumber} non vue`}
          />
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

  return (
    <Checkbox
      checked={state}
      disabled={disabled}
      onCheckedChange={onMark}
      aria-label={`Marquer la saison ${seasonNumber} vue`}
    />
  );
}
