import { useEffect, useRef } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  getShowViewsThisSession,
  getVisitCount,
  hasSeenOnboarding,
  hasShownRecurrentBanner,
  markRecurrentBannerShown,
  registerShowView,
  registerVisitOncePerSession,
} from "@/lib/client-storage";

const SHOW_ROUTE_PREFIX = "/show/";

/**
 * Nudges anonymous visitors who keep coming back without an account: once
 * they've been through onboarding (or explicitly skipped it) and either
 * started a 2nd anonymous visit or viewed 3+ show/movie pages in this
 * session, show a single dismissible Sonner toast, never again after that.
 *
 * Mounted once in `PublicLayout` (`src/routes/_public.tsx`).
 */
export function useVisitorRecurrenceNudge() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const shownRef = useRef(false);

  // Count this tab's visit once, on first mount.
  useEffect(() => {
    registerVisitOncePerSession();
  }, []);

  // Count each new show/movie detail page visited this session.
  const lastCountedPathRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pathname.startsWith(SHOW_ROUTE_PREFIX)) return;
    if (lastCountedPathRef.current === pathname) return;
    lastCountedPathRef.current = pathname;
    registerShowView();
  }, [pathname]);

  useEffect(() => {
    if (loading || user || shownRef.current) return;
    if (!hasSeenOnboarding() || hasShownRecurrentBanner()) return;

    const qualifies = getVisitCount() >= 2 || getShowViewsThisSession() >= 3;
    if (!qualifies) return;

    shownRef.current = true;
    markRecurrentBannerShown();
    toast("Vous êtes déjà fidèle. Un compte gratuit garde tout en mémoire, épisode par épisode.", {
      action: {
        label: "Créer un compte",
        onClick: () => navigate({ to: "/auth" }),
      },
    });
    // Re-evaluate after each show-page view / navigation, not just on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, pathname]);
}
