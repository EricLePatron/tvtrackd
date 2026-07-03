import { createFileRoute } from "@tanstack/react-router";
import { EmptyPanel, ScreenHeader } from "@/components/screen-header";

export const Route = createFileRoute("/_authenticated/")({
  component: HomeScreen,
});

function HomeScreen() {
  return (
    <>
      <ScreenHeader eyebrow="Ce soir · 00:00" title="Bienvenue">
        Votre carnet de visionnage est prêt. Ajoutez une série pour commencer.
      </ScreenHeader>
      <div className="space-y-3">
        <EmptyPanel
          label="À reprendre"
          stat="0"
          hint="Les épisodes en cours de vos séries apparaîtront ici."
        />
        <EmptyPanel
          label="Sorties de la semaine"
          stat="—"
          hint="Le calendrier arrive bientôt."
        />
        <EmptyPanel
          label="Statistiques"
          stat="0h"
          hint="Temps de visionnage cumulé."
        />
      </div>
    </>
  );
}
