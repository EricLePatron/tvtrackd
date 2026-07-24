import { createFileRoute, Link } from "@tanstack/react-router";
import { BackButton } from "@/components/back-button";
import { ScreenHeader } from "@/components/screen-header";
import { APP_NAME, SITE_URL } from "@/lib/app-config";
import { Bullet, Faq, SourceBlock, StepCard } from "@/components/import/import-guide-content";

const CANONICAL_URL = `${SITE_URL}/alternative-tv-time`;

const TITLE = `Alternative à TV Time en français, avec vos données incluses — ${APP_NAME}`;
const DESCRIPTION = `TV Time a fermé le 15 juillet 2026. ${APP_NAME} importe votre historique TV Time ou Betaseries en un clic et vous laisse exporter vos données à tout moment. Un tracker de séries fiable, en français.`;

// Les 6 questions affichées plus bas — réutilisées telles quelles pour le
// JSON-LD `FAQPage` (mainEntity = uniquement les questions réellement
// affichées, cf. brief SEO).
const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "Quand TV Time a-t-il fermé exactement ?",
    a: "TV Time a fermé le 15 juillet 2026. L'éditeur, Whip Media (racheté par Blue Torch Capital en 2025), a communiqué la fermeture avec environ deux semaines de préavis aux utilisateurs.",
  },
  {
    q: "Comment récupérer mon historique TV Time maintenant que le service est fermé ?",
    a: `Si vous avez déjà reçu votre archive d'export RGPD (un fichier .zip envoyé par e-mail), vous pouvez l'importer directement dans ${APP_NAME} : créez un compte gratuit puis déposez le fichier dans l'écran d'import. Si vous n'avez pas encore fait la demande, contactez le support TV Time pour vérifier si un accès à vos données reste possible.`,
  },
  {
    q: "Je n'ai pas exporté mes données avant la fermeture, que puis-je faire ?",
    a: `Exercez votre droit d'accès RGPD directement auprès de TV Time / Whip Media : même après la fermeture du service, l'éditeur reste responsable de vos données personnelles et tenu d'y répondre. ${APP_NAME} n'a accès à aucune donnée TV Time tant qu'elle ne vous a pas été remise et que vous ne l'avez pas importée vous-même.`,
  },
  {
    q: `${APP_NAME} importe-t-il aussi les exports Betaseries ?`,
    a: "Oui. L'écran d'import accepte le .zip TV Time, le .csv Betaseries, ainsi qu'un export .json d'un autre outil. Chaque série est automatiquement mise en correspondance avec sa fiche TMDb ; les cas ambigus sont signalés pour une résolution manuelle.",
  },
  {
    q: "Mes données pourront-elles un jour être prises en otage comme sur TV Time ?",
    a: "Non : l'export complet de votre bibliothèque au format JSON est disponible à tout moment depuis votre profil, dès votre première série ajoutée — pas seulement en cas de fermeture du service. C'est un principe de conception, pas une promesse marketing.",
  },
  {
    q: "Combien de temps prend l'import de mon historique complet ?",
    a: "La lecture du fichier est quasi instantanée ; le rapprochement avec les fiches officielles prend environ une seconde par série, soit 1 à 3 minutes pour une bibliothèque de 100 à 300 séries.",
  },
];

export const Route = createFileRoute("/_public/alternative-tv-time")({
  component: AlternativeTvTimeScreen,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: CANONICAL_URL },
    ],
    links: [{ rel: "canonical", href: CANONICAL_URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          url: CANONICAL_URL,
          name: TITLE,
          description: DESCRIPTION,
          inLanguage: "fr-FR",
          isPartOf: { "@id": `${SITE_URL}/#website` },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ_ITEMS.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        }),
      },
    ],
  }),
});

function SectionEyebrow({ children }: { children: string }) {
  return (
    <p className="font-counter text-[10px] uppercase tracking-[0.24em] text-primary">{children}</p>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.018] p-[18px]">
      {children}
    </div>
  );
}

function AlternativeTvTimeScreen() {
  return (
    <div className="pb-24">
      <div className="px-5 pt-4">
        <BackButton fallbackTo="/" />
      </div>

      <ScreenHeader
        eyebrow="Migration TV Time"
        title="L'alternative à TV Time qui ne vous fait plus jamais perdre votre historique"
      >
        TV Time a fermé le 15 juillet 2026. {APP_NAME} importe votre historique TV Time ou
        Betaseries en un clic, et vous laisse exporter vos données à tout moment — pas seulement en
        cas de fermeture.
      </ScreenHeader>

      <div className="mx-5 space-y-8">
        {/* H2 — TV Time ferme le 15 juillet 2026 */}
        <section>
          <h2 className="font-display text-xl text-foreground">
            TV Time ferme le 15 juillet 2026 : ce qu'il faut savoir
          </h2>

          <div className="mt-4 space-y-4">
            <Card>
              <h3 className="font-display text-base text-foreground">Pourquoi TV Time s'arrête</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                TV Time, l'un des plus gros trackers de séries au monde (plus de 25 millions
                d'utilisateurs revendiqués), a fermé le 15 juillet 2026. Son éditeur, Whip Media,
                racheté par le fonds Blue Torch Capital en 2025, a choisi de réorienter son activité
                plutôt que de continuer à opérer le produit — avec environ deux semaines de préavis
                communiquées aux utilisateurs.
              </p>
            </Card>

            <Card>
              <h3 className="font-display text-base text-foreground">
                Vous n'avez pas encore exporté vos données ? Ce qui reste possible
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Si vous n'avez pas demandé votre export avant la fermeture, la seule voie possible
                reste de contacter directement le support TV Time / Whip Media pour exercer votre
                droit d'accès RGPD — {APP_NAME} n'a accès à aucune donnée TV Time tant qu'elle ne
                vous a pas été remise et que vous ne l'avez pas importée vous-même. Si vous avez
                encore une archive .zip reçue par e-mail, même ancienne, elle reste utilisable avec
                l'import ci-dessous.
              </p>
            </Card>
          </div>
        </section>

        {/* H2 — Exporter vos données (ancre #exporter-vos-donnees) */}
        <section id="exporter-vos-donnees" className="scroll-mt-6">
          <h2 className="font-display text-xl text-foreground">
            Exporter vos données TV Time (ou Betaseries) en 3 étapes
          </h2>

          <div className="mt-4 space-y-3">
            <StepCard number={1} title="Étape 1 — Demandez votre export TV Time (RGPD)">
              <div className="space-y-3">
                <SourceBlock
                  name="TV Time"
                  description="Demandez votre archive RGPD à TV Time. Vous recevrez un e-mail avec un .zip contenant tout votre historique — c'est ce fichier qu'on utilisera à l'étape 3."
                  cta="Demander mes données TV Time"
                  href="https://gdpr.tvtime.com/gdpr/self-service"
                  hint="TV Time a fermé le 15 juillet 2026 — si le service ne répond plus, l'e-mail de demande reste la seule voie possible."
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Vous venez de Betaseries plutôt que de TV Time ? L'export est immédiat, pas besoin
                  de demande RGPD : Préférences → Données personnelles → Exporter mes séries.
                </p>
              </div>
            </StepCard>

            <StepCard
              number={2}
              title="Étape 2 — Récupérez votre fichier (zip TV Time ou CSV Betaseries)"
            >
              <p className="text-xs leading-relaxed text-muted-foreground">
                TV Time envoie l'archive .zip par e-mail sous 24 à 48h. Betaseries propose un
                fichier .csv en téléchargement immédiat. Dans les deux cas, gardez le fichier tel
                quel — pas besoin de le dézipper ni de le convertir avant l'étape suivante.
              </p>
            </StepCard>

            <StepCard number={3} title={`Étape 3 — Importez tout dans ${APP_NAME} en un clic`}>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <Bullet>
                  Créez un compte gratuit, puis déposez le fichier (.zip, .csv ou .json) dans
                  l'écran d'import.
                </Bullet>
                <Bullet>
                  Chaque série est mise en correspondance automatiquement avec sa fiche officielle
                  TMDb ; les cas ambigus sont signalés pour une résolution manuelle.
                </Bullet>
                <Bullet>
                  Statuts « terminé » et « archivé », épisodes vus, rewatchs : tout est remis à sa
                  place.
                </Bullet>
              </ul>
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="mt-4 inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground"
              >
                Créer un compte gratuit
              </Link>
            </StepCard>
          </div>
        </section>

        {/* H2 — Pourquoi APP_NAME plutôt que Betaseries, Trakt ou Simkl */}
        <section>
          <h2 className="font-display text-xl text-foreground">
            Pourquoi {APP_NAME} plutôt que Betaseries, Trakt ou Simkl
          </h2>

          <div className="mt-4 space-y-4">
            <Card>
              <h3 className="font-display text-base text-foreground">
                Fiabilité : pas de désynchronisation, un désarchivage qui fonctionne
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Un tracker de séries doit d'abord faire les choses basiques correctement : marquer
                un épisode vu, gérer les rewatchs, et permettre d'archiver puis de désarchiver une
                série sans perdre l'historique associé. C'est un point précis signalé de façon
                récurrente par des utilisateurs de Betaseries. Chez {APP_NAME}, l'archivage (statut
                de bibliothèque) et l'historique d'épisodes vus sont deux mécanismes indépendants
                dès la conception, justement pour éviter ce type de blocage.
              </p>
            </Card>

            <Card>
              <h3 className="font-display text-base text-foreground">
                Vos données ne seront jamais prises en otage
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                L'export complet de votre bibliothèque (format JSON) est disponible dès votre
                première série ajoutée, pas seulement en cas de fermeture du service. Vous pouvez à
                tout moment récupérer l'intégralité de votre historique — un principe de conception,
                pas une réponse de circonstance à la fermeture de TV Time.
              </p>
            </Card>

            <Card>
              <h3 className="font-display text-base text-foreground">
                Pensé en français, pour tous les fans de séries — pas seulement les power users
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Des outils comme Trakt ou Simkl sont solides techniquement mais restent anglophones
                et pensés pour un public plus technique (scrobbling, comptes tiers, API). {APP_NAME}{" "}
                vise un usage plus direct : suivi épisode par épisode, calendrier des sorties,
                import guidé — en français, sans étape de configuration supplémentaire.
              </p>
            </Card>
          </div>
        </section>

        {/* H2 — FAQ */}
        <section>
          <h2 className="font-display text-xl text-foreground">Questions fréquentes</h2>
          <div className="mt-4 space-y-3">
            {FAQ_ITEMS.map((item) => (
              <Faq key={item.q} q={item.q}>
                {item.a}
              </Faq>
            ))}
          </div>
        </section>

        {/* H2 — CTA final */}
        <section>
          <Card>
            <SectionEyebrow>Mémoire durable</SectionEyebrow>
            <h2 className="mt-2 font-display text-xl text-foreground">
              Prêt à récupérer votre bibliothèque ?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Créez un compte gratuit, importez votre historique TV Time ou Betaseries, et gardez la
              main sur vos données — export complet disponible à tout moment.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground"
              >
                Créer un compte gratuit
              </Link>
              <Link
                to="/auth"
                search={{ mode: "signin" }}
                className="inline-flex h-11 items-center justify-center rounded-md border border-border px-5 text-sm font-medium text-foreground"
              >
                J'ai déjà un compte
              </Link>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
