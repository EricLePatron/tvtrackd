import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { hasSeenOnboarding, markOnboardingSeen } from "@/lib/client-storage";
import { APP_NAME } from "@/lib/app-config";
import {
  CalendarGridIcon,
  CassetteIcon,
  ImportExportIcon,
  MarkWatchedIcon,
  TrackProgressIcon,
} from "@/components/onboarding/onboarding-icons";

const CARD_HEIGHT = "h-[calc(100dvh-6.5rem)]";
const CARD_PANEL =
  "flex flex-col items-center justify-center overflow-y-auto rounded-xl border border-border bg-card px-8 py-6 text-center";

/**
 * Full-screen, swipeable first-run onboarding for anonymous visitors.
 * Shown at most once (localStorage `onboarding_seen`, see
 * `src/lib/client-storage.ts`), both exit paths ("Créer un compte" and
 * "Explorer d'abord") set the flag so it never reappears.
 */
export function OnboardingCarousel() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [api, setApi] = useState<CarouselApi>();
  const [index, setIndex] = useState(0);

  // Client-only check: avoids SSR/hydration flashing the carousel to a
  // user whose session/onboarding-seen state can only be known in-browser.
  useEffect(() => {
    if (loading) return;
    setVisible(!user && !hasSeenOnboarding());
    setReady(true);
  }, [user, loading]);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setIndex(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  if (!ready || !visible) return null;

  // The underlying route is already rendered beneath this overlay (see
  // `_public.tsx`) — dismissing just hides the carousel, no navigation
  // needed, so a visitor onboarded from a deep-linked show page stays there.
  function dismiss() {
    markOnboardingSeen();
    setVisible(false);
  }

  function goToAuth() {
    markOnboardingSeen();
    setVisible(false);
    navigate({ to: "/auth", search: { redirect: pathname } });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between px-5 pt-[calc(1.25rem+env(safe-area-inset-top))]">
        <span className="flex items-center gap-0.5 font-counter text-xs tracking-widest text-muted-foreground">
          {String(index + 1).padStart(2, "0")}/03
          {index < 2 ? <ChevronRight className="h-3 w-3 text-primary" /> : null}
        </span>
        {index < 2 ? (
          <button
            type="button"
            onClick={dismiss}
            className="font-counter text-xs uppercase tracking-widest text-muted-foreground"
          >
            Passer
          </button>
        ) : null}
      </div>

      <Carousel
        setApi={setApi}
        opts={{ align: "start", loop: false }}
        className="group relative mt-2"
      >
        <CarouselContent className="ml-4">
          <CarouselItem className="basis-[84vw] pl-4">
            <CardOne />
          </CarouselItem>
          <CarouselItem className="basis-[84vw] pl-4">
            <CardTwo />
          </CarouselItem>
          <CarouselItem className="basis-[84vw] pl-4">
            <CardThree onCreateAccount={goToAuth} onExplore={dismiss} />
          </CarouselItem>
        </CarouselContent>
        <CarouselPrevious className="left-4 hidden opacity-0 transition-opacity md:flex group-hover:opacity-100" />
        <CarouselNext className="right-4 hidden opacity-0 transition-opacity md:flex group-hover:opacity-100" />
      </Carousel>
    </div>
  );
}

function CardOne() {
  return (
    <div className={`${CARD_HEIGHT} ${CARD_PANEL}`}>
      <CassetteIcon className="h-[120px] w-[120px] text-foreground" />
      <h2 className="mt-8 font-display text-2xl text-foreground">
        Un tracker qui fait bien les choses simples
      </h2>
      <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
        {APP_NAME} suit vos séries et films, épisode par épisode. Simple à utiliser. Fiable au
        quotidien. Là quand vous en avez besoin. Gratuit.
      </p>
    </div>
  );
}

function CardTwo() {
  return (
    <div className={`${CARD_HEIGHT} ${CARD_PANEL}`}>
      <div className="flex items-start gap-8">
        <div className="flex flex-col items-center gap-2">
          <MarkWatchedIcon className="h-12 w-12" />
          <span className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
            Marquer vu
          </span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <TrackProgressIcon className="h-12 w-12" />
          <span className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
            Suivre
          </span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <CalendarGridIcon className="h-12 w-12" />
          <span className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
            Calendrier
          </span>
        </div>
      </div>
      <h2 className="mt-8 font-display text-2xl text-foreground">Marquez, suivez, retrouvez</h2>
      <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
        Marquez un épisode vu en un geste. Suivez vos séries en cours. Retrouvez votre programme du
        soir dans le calendrier des sorties.
      </p>
    </div>
  );
}

function CardThree({
  onCreateAccount,
  onExplore,
}: {
  onCreateAccount: () => void;
  onExplore: () => void;
}) {
  return (
    <div className={`${CARD_HEIGHT} ${CARD_PANEL}`}>
      <ImportExportIcon className="h-[135px] w-[135px]" />
      <h2 className="mt-8 font-display text-2xl text-foreground">
        Vos données ne sont jamais piégées ici
      </h2>
      <p className="mt-2 font-display text-lg font-bold text-primary">{APP_NAME} est gratuit.</p>
      <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
        Importez votre historique TV Time ou Betaseries (CSV/JSON) dès l'inscription. Exportez vos
        données quand vous le voulez.
      </p>

      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        <Button onClick={onCreateAccount} className="h-12 w-full text-base font-medium">
          Créer un compte
        </Button>
        <Button
          onClick={onExplore}
          variant="ghost"
          className="h-12 w-full text-base font-medium text-cyan-accent hover:bg-cyan-accent/10 hover:text-cyan-accent"
        >
          Explorer d'abord →
        </Button>
      </div>
    </div>
  );
}
