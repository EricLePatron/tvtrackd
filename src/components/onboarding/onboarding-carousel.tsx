import { useEffect, useRef, useState } from "react";
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
// `justify-[safe_center]` (not the plain `justify-center`) matters here: when
// this panel's content overflows a short viewport (landscape mobile), a
// plain centered flex axis makes the overflow at the *start* (icon + title)
// unreachable by scroll — only the *end* overflow scrolls into view. `safe`
// falls back to start-alignment once content no longer fits, keeping 100%
// of the card reachable. See https://github.com/philipwalton/flexbugs/issues/53
const CARD_PANEL =
  "flex flex-col items-center justify-[safe_center] overflow-y-auto rounded-xl border border-border bg-card px-8 py-6 text-center";

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
      <div className="grid grid-cols-3 items-center px-5 pt-[calc(1.25rem+env(safe-area-inset-top))]">
        <span className="flex items-center gap-0.5 justify-self-start font-counter text-xs tracking-widest text-muted-foreground">
          {String(index + 1).padStart(2, "0")}/03
          {index < 2 ? <ChevronRight className="h-3 w-3 text-primary" /> : null}
        </span>
        <span className="flex items-center gap-1.5 justify-self-center font-display text-sm text-foreground">
          <CassetteIcon className="h-4 w-4 shrink-0" />
          {APP_NAME}
        </span>
        {index < 2 ? (
          <button
            type="button"
            onClick={dismiss}
            className="justify-self-end font-counter text-xs uppercase tracking-widest text-muted-foreground"
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
      <CassetteIcon className="h-[120px] w-[120px] shrink-0 text-foreground" />
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
          <MarkWatchedIcon className="h-12 w-12 shrink-0" />
          <span className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
            Marquer vu
          </span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <TrackProgressIcon className="h-12 w-12 shrink-0" />
          <span className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
            Suivre
          </span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <CalendarGridIcon className="h-12 w-12 shrink-0" />
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
  // Unlike CardOne/CardTwo, this card ends in the two exit-path buttons —
  // they must never scroll out of view, so only the icon/text block above
  // them (not the whole card) is allowed to shrink and scroll on short
  // viewports. See CARD_PANEL comment for the `safe_center` overflow issue
  // this also has to account for.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showMoreHint, setShowMoreHint] = useState(false);

  // Fades the bottom edge of the scrollable block whenever it's actually
  // truncated (and hides once scrolled to the end) — an invisible-scrollbar
  // `overflow-y-auto` on mobile otherwise gives no sign that the pitch text
  // continues below the fold.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setShowMoreHint(el.scrollHeight - el.scrollTop - el.clientHeight > 1);
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      className={`${CARD_HEIGHT} flex flex-col rounded-xl border border-border bg-card px-8 py-6 text-center`}
    >
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          className="flex h-full flex-col items-center justify-[safe_center] overflow-y-auto"
        >
          <ImportExportIcon className="h-24 w-24 shrink-0" />
          <h2 className="mt-6 font-display text-2xl text-foreground">
            Vos données ne sont jamais piégées ici
          </h2>
          <p className="mt-2 font-display text-lg font-bold text-primary">
            {APP_NAME} est gratuit.
          </p>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Importez votre historique TV Time ou Betaseries (CSV/JSON) dès l'inscription. Exportez
            vos données quand vous le voulez.
          </p>
        </div>
        {showMoreHint ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card to-transparent" />
        ) : null}
      </div>

      <div className="mx-auto mt-3 flex w-full max-w-xs shrink-0 flex-col gap-2">
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
