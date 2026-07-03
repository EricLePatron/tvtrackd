import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { ScreenHeader } from "@/components/screen-header";

export const Route = createFileRoute("/_authenticated/search")({
  component: SearchScreen,
});

function SearchScreen() {
  return (
    <>
      <ScreenHeader eyebrow="Explorer" title="Recherche">
        Titres, réalisateurs, saisons. La connexion au catalogue est bientôt disponible.
      </ScreenHeader>
      <div className="mx-5">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            disabled
            placeholder="Chercher une série ou un film…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <span className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
            Soon
          </span>
        </div>

        <div className="mt-8 rounded-xl border border-dashed border-border bg-transparent p-6 text-center">
          <p className="font-counter text-[11px] uppercase tracking-widest text-muted-foreground">
            00 résultats
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            L'index TMDb sera branché à la prochaine étape.
          </p>
        </div>
      </div>
    </>
  );
}
