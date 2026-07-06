import { createFileRoute } from "@tanstack/react-router";
import { BackButton } from "@/components/back-button";
import { APP_NAME } from "@/lib/app-config";

export const Route = createFileRoute("/legal/confidentialite")({
  head: () => ({
    meta: [
      { title: `Politique de confidentialité — ${APP_NAME}` },
      {
        name: "description",
        content: `Comment ${APP_NAME} collecte, utilise et protège vos données personnelles.`,
      },
    ],
  }),
  component: Confidentialite,
});

function Confidentialite() {
  return (
    <>
      <div className="px-4 pt-6">
        <BackButton fallbackTo="/" />
      </div>
      <article className="prose prose-invert max-w-none px-4 py-6 text-sm leading-relaxed text-foreground/90">
        <h1 className="mb-2 text-2xl font-bold tracking-tight">Politique de confidentialité</h1>
        <p className="text-xs text-muted-foreground">
          Dernière mise à jour&nbsp;: {new Date().toLocaleDateString("fr-FR")}
        </p>

        <h2 className="mt-6 mb-2 text-lg font-semibold">1. Responsable de traitement</h2>
        <p>
          Le responsable de traitement des données collectées sur {APP_NAME} est{" "}
          <em>[Nom / raison sociale de l&apos;éditeur]</em>. Contact&nbsp;:{" "}
          <em>[email de contact]</em>.
        </p>

        <h2 className="mt-6 mb-2 text-lg font-semibold">2. Données collectées</h2>
        <ul className="list-disc pl-5">
          <li>
            <strong>Compte&nbsp;:</strong> adresse e-mail, mot de passe (haché), nom d&apos;utilisateur,
            avatar optionnel.
          </li>
          <li>
            <strong>Usage&nbsp;:</strong> séries et films suivis, statuts (à voir / en cours / terminé /
            abandonné / archivé), historique des épisodes vus, dates de visionnage.
          </li>
          <li>
            <strong>Techniques&nbsp;:</strong> journaux d&apos;accès (adresse IP, user-agent) conservés
            à des fins de sécurité et de diagnostic.
          </li>
        </ul>

        <h2 className="mt-6 mb-2 text-lg font-semibold">3. Finalités et bases légales</h2>
        <ul className="list-disc pl-5">
          <li>Fournir le service de suivi de séries et films — <em>exécution du contrat</em>.</li>
          <li>Sécurité, prévention de la fraude, diagnostic — <em>intérêt légitime</em>.</li>
          <li>Respect des obligations légales — <em>obligation légale</em>.</li>
        </ul>

        <h2 className="mt-6 mb-2 text-lg font-semibold">4. Sous-traitants</h2>
        <ul className="list-disc pl-5">
          <li>
            <strong>Supabase</strong> (base de données, authentification, fonctions serveur) —
            hébergement des données utilisateur.
          </li>
          <li>
            <strong>Cloudflare</strong> — hébergement et distribution du site via Lovable.
          </li>
          <li>
            <strong>TMDb (The Movie Database)</strong> — fournisseur des métadonnées films/séries.
            Aucune donnée personnelle ne lui est transmise.
          </li>
        </ul>

        <h2 className="mt-6 mb-2 text-lg font-semibold">5. Durée de conservation</h2>
        <p>
          Les données de compte sont conservées tant que le compte est actif. À la suppression du
          compte, les données sont effacées sous 30 jours, sauf obligation légale de conservation.
        </p>

        <h2 className="mt-6 mb-2 text-lg font-semibold">6. Vos droits</h2>
        <p>
          Conformément au RGPD et à la loi Informatique et Libertés, vous disposez d&apos;un droit
          d&apos;accès, de rectification, d&apos;effacement, de limitation, d&apos;opposition et de
          portabilité de vos données. Vous pouvez exporter vos données depuis votre profil, ou
          exercer vos droits en écrivant à <em>[email de contact]</em>. Vous pouvez également
          introduire une réclamation auprès de la{" "}
          <a href="https://www.cnil.fr" target="_blank" rel="noreferrer" className="underline">
            CNIL
          </a>
          .
        </p>

        <h2 className="mt-6 mb-2 text-lg font-semibold">7. Transferts hors UE</h2>
        <p>
          Certains sous-traitants (Cloudflare) peuvent traiter des données hors de l&apos;Union
          européenne. Ces transferts sont encadrés par les clauses contractuelles types de la
          Commission européenne.
        </p>

        <h2 className="mt-6 mb-2 text-lg font-semibold">8. Sécurité</h2>
        <p>
          Les mots de passe sont hachés et les accès aux données protégés par une politique de
          contrôle d&apos;accès stricte (Row-Level Security). Malgré toutes les mesures prises,
          aucun système n&apos;est infaillible&nbsp;: en cas de violation, les utilisateurs concernés
          seront informés conformément à la réglementation.
        </p>
      </article>
    </>
  );
}
