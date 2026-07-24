import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { FileArchive, ArrowLeft } from "lucide-react";
import { ScreenHeader } from "@/components/screen-header";
import { ImportPanel } from "@/components/import/import-panel";
import { APP_NAME } from "@/lib/app-config";
import { Bullet, Faq, SourceBlock, StepCard } from "@/components/import/import-guide-content";

export const Route = createFileRoute("/_authenticated/import")({
  component: ImportScreen,
});

function ImportScreen() {
  const qc = useQueryClient();

  return (
    <>
      <ScreenHeader eyebrow="Compte" title="Importer ma bibliothèque" />
      <div className="mx-5 space-y-4 pb-24">
        <Link
          to="/profile"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Retour au profil
        </Link>

        {/* Intro / pitch */}
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="font-counter text-[11px] uppercase tracking-widest text-primary">
            Migration TV Time · Betaseries
          </p>
          <h2 className="mt-2 font-display text-xl text-foreground">
            Récupérez vos années de tracking, sans en perdre une ligne.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            TV Time ferme le 15 juillet 2026. {APP_NAME} importe votre historique en une fois :
            séries suivies, épisodes vus, statuts « terminé » et « archivé » — tout est remis à sa
            place, prêt à reprendre là où vous en étiez.
          </p>
        </div>

        {/* Étape 1 — Récupérer l'export */}
        <StepCard number={1} title="Récupérez votre export">
          <div className="space-y-3">
            <SourceBlock
              name="TV Time"
              description="Demandez votre archive GDPR à TV Time. Vous recevrez un e-mail avec un .zip contenant tout votre historique — c'est ce fichier qu'on va utiliser."
              cta="Demander mes données TV Time"
              href="https://gdpr.tvtime.com/gdpr/self-service"
              hint="⚠️ TV Time ferme le 15 juillet 2026. Faites la demande maintenant : ils envoient l'e-mail sous 24–48h."
            />
            <SourceBlock
              name="Betaseries"
              description="Depuis Betaseries, ouvrez vos préférences → Données personnelles → Exporter mes séries. Vous obtenez un fichier .csv à téléverser tel quel."
              cta="Ouvrir Betaseries"
              href="https://www.betaseries.com/parametres/general"
            />
          </div>
        </StepCard>

        {/* Étape 2 — Uploader */}
        <StepCard number={2} title="Téléversez le fichier reçu">
          <p className="text-xs text-muted-foreground">
            Pas besoin de dézipper l'archive TV Time : déposez le .zip directement.
          </p>
          <div className="mt-3">
            <ImportPanel
              variant="guided"
              onImported={() =>
                qc.invalidateQueries({ queryKey: ["import-runs"] })
              }
            />
          </div>
          <div className="mt-3 flex gap-2 rounded-md bg-surface-elevated/40 p-3">
            <FileArchive className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Formats acceptés : <span className="text-foreground">.zip</span> (TV Time),{" "}
              <span className="text-foreground">.csv</span> (Betaseries), ou{" "}
              <span className="text-foreground">.json</span> (export {APP_NAME} ou autre outil). Le
              fichier reste sur votre appareil — seules les données de tracking (titres, saisons,
              épisodes, dates) sont envoyées.
            </p>
          </div>
        </StepCard>

        {/* Étape 3 — Vérification */}
        <StepCard number={3} title="Vérifiez, ajustez si besoin">
          <ul className="space-y-2 text-xs text-muted-foreground">
            <Bullet>
              Chaque série est mise en correspondance automatiquement avec sa fiche officielle.
            </Bullet>
            <Bullet>
              Les rares séries ambiguës apparaissent dans « À résoudre » — choisissez la bonne
              fiche puis cliquez « Relancer l'import ».
            </Bullet>
            <Bullet>
              Vous pouvez ré-importer plusieurs fois : les épisodes déjà marqués ne sont pas
              dupliqués.
            </Bullet>
          </ul>
        </StepCard>

        {/* FAQ courte */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-display text-sm uppercase tracking-widest text-foreground">
            Questions fréquentes
          </h3>
          <div className="mt-3 space-y-3">
            <Faq q="Combien de temps ça prend ?">
              La lecture du fichier est instantanée. Le rapprochement avec les fiches officielles
              prend environ 1 seconde par série — comptez 1 à 3 minutes pour une bibliothèque de
              100 à 300 séries.
            </Faq>
            <Faq q="Mes statuts « terminé » et « archivé » sont-ils préservés ?">
              Oui. Les séries marquées comme terminées dans TV Time ou archivées dans Betaseries
              gardent leur statut. Les triggers de {APP_NAME} recalculent ensuite « en cours » /
              « terminé » automatiquement à partir de votre progression.
            </Faq>
            <Faq q="Et si je ré-importe le même fichier ?">
              Aucun doublon. Les épisodes déjà marqués vus ne sont pas ré-insérés, et les statuts
              choisis manuellement ne sont jamais écrasés.
            </Faq>
            <Faq q="Comment récupérer mes films TV Time ?">
              L'export GDPR TV Time contient un CSV films séparé. Déposez-le à son tour dans la
              zone d'import ci-dessus — support des films en cours d'amélioration.
            </Faq>
          </div>
        </div>
      </div>
    </>
  );
}

