import { createFileRoute } from "@tanstack/react-router";
import { BackButton } from "@/components/back-button";
import { APP_NAME } from "@/lib/app-config";

export const Route = createFileRoute("/legal/mentions-legales")({
  head: () => ({
    meta: [
      { title: `Mentions légales — ${APP_NAME}` },
      { name: "description", content: `Mentions légales du site ${APP_NAME}.` },
    ],
  }),
  component: MentionsLegales,
});

function MentionsLegales() {
  return (
    <>
      <div className="px-4 pt-6">
        <BackButton fallbackTo="/" />
      </div>
      <article className="prose prose-invert max-w-none px-4 py-6 text-sm leading-relaxed text-foreground/90">
        <h1 className="mb-6 text-2xl font-bold tracking-tight">Mentions légales</h1>

        <h2 className="mt-6 mb-2 text-lg font-semibold">1. Éditeur du site</h2>
        <p>
          Le site {APP_NAME} est édité par&nbsp;: <em>[Nom / raison sociale à compléter]</em>,
          <em> [statut juridique]</em>, dont le siège est situé <em>[adresse]</em>.
        </p>
        <ul className="list-disc pl-5">
          <li>SIREN / SIRET&nbsp;: <em>[à compléter]</em></li>
          <li>Directeur de la publication&nbsp;: <em>[à compléter]</em></li>
          <li>Contact&nbsp;: <em>[email de contact]</em></li>
        </ul>

        <h2 className="mt-6 mb-2 text-lg font-semibold">2. Hébergeur</h2>
        <p>
          Le site est hébergé par <strong>Lovable</strong> (Lovable AB), sur l&apos;infrastructure
          de <strong>Cloudflare, Inc.</strong> — 101 Townsend Street, San Francisco, CA 94107, USA.
        </p>

        <h2 className="mt-6 mb-2 text-lg font-semibold">3. Propriété intellectuelle</h2>
        <p>
          L&apos;ensemble des contenus, marques, logos, textes et éléments graphiques présents sur
          {" "}{APP_NAME} sont protégés par le droit d&apos;auteur et le droit des marques. Toute
          reproduction ou représentation, totale ou partielle, sans autorisation écrite préalable
          est interdite. Les métadonnées de films et séries proviennent de{" "}
          <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer" className="underline">
            The Movie Database (TMDb)
          </a>{" "}
          — ce produit utilise l&apos;API TMDb mais n&apos;est ni approuvé ni certifié par TMDb.
        </p>

        <h2 className="mt-6 mb-2 text-lg font-semibold">4. Responsabilité</h2>
        <p>
          L&apos;éditeur s&apos;efforce d&apos;assurer l&apos;exactitude des informations diffusées
          sur {APP_NAME} mais ne peut garantir l&apos;absence d&apos;erreurs ou l&apos;actualité
          permanente des données provenant de sources tierces.
        </p>

        <h2 className="mt-6 mb-2 text-lg font-semibold">5. Contact</h2>
        <p>
          Pour toute question relative au site, écrire à <em>[email de contact]</em>.
        </p>
      </article>
    </>
  );
}
