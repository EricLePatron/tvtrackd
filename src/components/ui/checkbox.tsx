import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

// Classes de teinte par état, gardées littérales (pas de concaténation
// dynamique de nom de classe) pour que le scanner Tailwind les détecte.
// `accent` reste générique (primary par défaut) pour ne pas coupler ce
// composant partagé à une sémantique métier particulière ; les consommateurs
// qui veulent un accent différent (ex. cyan = "vu") l'indiquent explicitement.
const ACCENT_CLASSES = {
  primary: {
    checked:
      "group-data-[state=checked]:border-primary group-data-[state=checked]:bg-primary group-data-[state=checked]:text-primary-foreground",
    indeterminate:
      "group-data-[state=indeterminate]:border-primary/60 group-data-[state=indeterminate]:bg-primary/15 group-data-[state=indeterminate]:text-primary",
  },
  cyan: {
    checked:
      "group-data-[state=checked]:border-cyan-accent group-data-[state=checked]:bg-cyan-accent group-data-[state=checked]:text-background",
    indeterminate:
      "group-data-[state=indeterminate]:border-cyan-accent/60 group-data-[state=indeterminate]:bg-cyan-accent/15 group-data-[state=indeterminate]:text-cyan-accent",
  },
} as const;

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & {
    /** Teinte de l'état coché/indéterminé. Par défaut `primary` (amber). */
    accent?: keyof typeof ACCENT_CLASSES;
  }
>(({ className, accent = "primary", checked, ...props }, ref) => (
  // Le bouton Radix (Root) porte toute la zone cliquable/focus (44px, cf.
  // a11y mobile) ; le petit carré visuel du "glyphe" checkbox reste séparé
  // (span interne 18px) pour ne pas faire grossir l'icône elle-même.
  <CheckboxPrimitive.Root
    ref={ref}
    checked={checked}
    className={cn(
      "group grid h-11 w-11 shrink-0 place-items-center rounded-md cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <span
      className={cn(
        "grid h-[18px] w-[18px] shrink-0 place-items-center rounded-sm border border-primary shadow transition-colors",
        ACCENT_CLASSES[accent].checked,
        ACCENT_CLASSES[accent].indeterminate,
      )}
    >
      <CheckboxPrimitive.Indicator className="grid place-content-center text-current">
        {checked === "indeterminate" ? (
          <Minus className="h-3.5 w-3.5" />
        ) : (
          <Check className="h-3.5 w-3.5" />
        )}
      </CheckboxPrimitive.Indicator>
    </span>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
