import { createFileRoute } from "@tanstack/react-router";
import { BackButton } from "@/components/back-button";
import { APP_NAME } from "@/lib/app-config";

export const Route = createFileRoute("/legal/cgu")({
  head: () => ({
    meta: [
      { title: `CGU — ${APP_NAME}` },
      { name: "description", content: `Conditions générales d'utilisation de ${APP_NAME}.` },
    ],
  }),
  component: CGU,
});

function CGU() {
  return (
    <>
      <div className="px-4 pt-6">
        <BackButton fallbackTo="/" />
      </div>
      <article className="prose prose-invert max-w-none px-4 py-6 text-sm leading-relaxed text-foreground/90">
        <h1 className="mb-2 text-2xl font-bold tracking-tight">
          Conditions générales d&apos;utilisation
        </h1>
        <p className="text-xs text-muted-foreground">
          Dernière mise à jour&nbsp;: {new Date().toLocaleDateString("fr-FR")}
        </p>

        <h2 className="mt-6 mb-2 text-lg font-semibold">1. Objet</h2>
        <p>
          Les présentes conditions régissent l&apos;utilisation du site {APP_NAME}, service en ligne
          de suivi de séries et de films. En créant un compte ou en utilisant le service,
          l&apos;utilisateur accepte sans réserve les présentes conditions.
        </p>

        <h2 className="mt-6 mb-2 text-lg font-semibold">2. Accès au service</h2>
        <p>
          Le service est accessible gratuitement. La création d&apos;un compte nécessite une adresse
          e-mail valide et un mot de passe. L&apos;utilisateur est responsable de la confidentialité
          de ses identifiants.
        </p>

        <h2 className="mt-6 mb-2 text-lg font-semibold">3. Contenu utilisateur</h2>
        <p>
          L&apos;utilisateur reste propriétaire des données qu&apos;il saisit (bibliothèque,
          historique, listes). Il concède à l&apos;éditeur une licence non exclusive nécessaire au
          fonctionnement du service (stockage, affichage à l&apos;utilisateur lui-même).
        </p>

        <h2 className="mt-6 mb-2 text-lg font-semibold">4. Obligations de l&apos;utilisateur</h2>
        <ul className="list-disc pl-5">
          <li>Ne pas tenter d&apos;accéder aux données d&apos;autres utilisateurs.</li>
          <li>
            Ne pas utiliser le service à des fins illicites, ni pour surcharger l&apos;infrastructure
            (scraping massif, attaque par déni de service, etc.).
          </li>
          <li>Ne pas contourner les mécanismes de sécurité ou de quota d&apos;API.</li>
        </ul>

        <h2 className="mt-6 mb-2 text-lg font-semibold">5. Suppression de compte</h2>
        <p>
          L&apos;utilisateur peut supprimer son compte à tout moment depuis son profil. L&apos;éditeur
          se réserve le droit de suspendre ou supprimer tout compte en cas de manquement aux
          présentes conditions.
        </p>

        <h2 className="mt-6 mb-2 text-lg font-semibold">6. Disponibilité et évolutions</h2>
        <p>
          Le service est fourni « en l&apos;état », sans garantie de disponibilité continue. Des
          interruptions peuvent survenir pour maintenance ou en cas de défaillance des services
          tiers (TMDb, hébergeurs). L&apos;éditeur peut faire évoluer le service à tout moment.
        </p>

        <h2 className="mt-6 mb-2 text-lg font-semibold">7. Responsabilité</h2>
        <p>
          L&apos;éditeur ne saurait être tenu responsable des pertes de données résultant d&apos;une
          défaillance des services tiers ou d&apos;une utilisation non conforme du service.
          L&apos;utilisateur est invité à effectuer des exports réguliers de sa bibliothèque.
        </p>

        <h2 className="mt-6 mb-2 text-lg font-semibold">8. Droit applicable</h2>
        <p>
          Les présentes conditions sont soumises au droit français. Tout litige relève de la
          compétence des tribunaux français, sous réserve des dispositions légales applicables aux
          consommateurs.
        </p>
      </article>
    </>
  );
}
