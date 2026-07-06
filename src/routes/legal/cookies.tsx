import { createFileRoute } from "@tanstack/react-router";
import { BackButton } from "@/components/back-button";
import { APP_NAME } from "@/lib/app-config";

export const Route = createFileRoute("/legal/cookies")({
  head: () => ({
    meta: [
      { title: `Cookies — ${APP_NAME}` },
      { name: "description", content: `Politique cookies de ${APP_NAME}.` },
    ],
  }),
  component: Cookies,
});

function Cookies() {
  return (
    <>
      <div className="px-4 pt-6">
        <BackButton fallbackTo="/" />
      </div>
      <article className="prose prose-invert max-w-none px-4 py-6 text-sm leading-relaxed text-foreground/90">
        <h1 className="mb-2 text-2xl font-bold tracking-tight">Politique cookies</h1>
        <p className="text-xs text-muted-foreground">
          Dernière mise à jour&nbsp;: {new Date().toLocaleDateString("fr-FR")}
        </p>

        <h2 className="mt-6 mb-2 text-lg font-semibold">1. Cookies utilisés</h2>
        <p>
          {APP_NAME} n&apos;utilise <strong>aucun cookie de mesure d&apos;audience, de publicité,
          ni de traceur tiers</strong>. Aucun bandeau de consentement n&apos;est donc requis pour
          l&apos;utilisation du service.
        </p>

        <h2 className="mt-6 mb-2 text-lg font-semibold">2. Stockage strictement nécessaire</h2>
        <p>
          Pour fonctionner, le service utilise uniquement des mécanismes de stockage local
          (<code>localStorage</code>, cookies de session) strictement nécessaires&nbsp;:
        </p>
        <ul className="list-disc pl-5">
          <li>
            <strong>Session d&apos;authentification&nbsp;:</strong> jeton permettant de rester
            connecté d&apos;une visite à l&apos;autre.
          </li>
          <li>
            <strong>Préférences d&apos;interface&nbsp;:</strong> état de navigation, actions en
            attente après connexion.
          </li>
        </ul>
        <p>
          Ces éléments sont dispensés de consentement au titre de l&apos;article 82 de la loi
          Informatique et Libertés (finalité strictement nécessaire à la fourniture du service
          expressément demandé par l&apos;utilisateur).
        </p>

        <h2 className="mt-6 mb-2 text-lg font-semibold">3. Gestion</h2>
        <p>
          Vous pouvez à tout moment supprimer les données stockées par le site depuis les réglages
          de votre navigateur. La suppression entraînera votre déconnexion.
        </p>

        <h2 className="mt-6 mb-2 text-lg font-semibold">4. Évolution</h2>
        <p>
          Si {APP_NAME} venait à intégrer à l&apos;avenir des outils de mesure d&apos;audience ou de
          publicité, un bandeau de consentement conforme aux recommandations de la CNIL serait mis
          en place et la présente politique mise à jour.
        </p>
      </article>
    </>
  );
}
