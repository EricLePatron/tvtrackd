import { createFileRoute } from "@tanstack/react-router";
import { ScreenHeader } from "@/components/screen-header";

const tabs = ["À voir", "En cours", "Terminé", "Abandonné", "Archive"];

export const Route = createFileRoute("/_authenticated/library")({
  component: LibraryScreen,
});

function LibraryScreen() {
  return (
    <>
      <ScreenHeader eyebrow="Ma collection" title="Bibliothèque">
        Vos suivis, classés par statut.
      </ScreenHeader>

      <div className="px-5">
        <div className="-mx-1 overflow-x-auto">
          <div className="flex gap-2 px-1 pb-2">
            {tabs.map((t, i) => (
              <button
                key={t}
                className={`shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  i === 0
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                <span className="font-counter mr-1.5">0</span>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[2/3] rounded-md border border-border bg-surface-elevated"
            />
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground font-counter uppercase tracking-widest">
          — vide —
        </p>
      </div>
    </>
  );
}
