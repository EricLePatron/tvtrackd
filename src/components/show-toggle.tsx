import { Check } from "lucide-react";

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

const BUTTON_BASE_CLASSES =
  "mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-md border border-white/[0.07] bg-white/[0.02] px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

/**
 * Action pleine largeur pour marquer/démarquer une série entière (tous
 * épisodes de toutes saisons déjà diffusés) — pendant show-level du
 * `SeasonToggle`. Même habillage et même logique tri-state, seuls les
 * libellés et la copie de confirmation changent.
 */
export function ShowToggle({
  state,
  disabled,
  onMark,
  onUnmark,
}: {
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
            className={cn(
              BUTTON_BASE_CLASSES,
              "border-cyan-accent/40 bg-cyan-accent/10 text-cyan-accent hover:text-cyan-accent",
            )}
          >
            <Check className="h-3.5 w-3.5" />
            Démarquer toute la série
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Démarquer toute la série ?</AlertDialogTitle>
            <AlertDialogDescription>
              Ça supprime l'historique de visionnage de tous les épisodes de la série, y compris
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
    <button type="button" disabled={disabled} onClick={onMark} className={BUTTON_BASE_CLASSES}>
      <Check className="h-3.5 w-3.5 opacity-60" />
      {state === "indeterminate"
        ? "Marquer le reste de la série comme vue"
        : "Marquer toute la série comme vue"}
    </button>
  );
}
