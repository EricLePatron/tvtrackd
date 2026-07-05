import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { OnboardingCarousel } from "@/components/onboarding/onboarding-carousel";
import { useVisitorRecurrenceNudge } from "@/hooks/use-visitor-recurrence-nudge";

export const Route = createFileRoute("/_public")({
  component: PublicLayout,
});

function PublicLayout() {
  useVisitorRecurrenceNudge();

  return (
    <>
      <OnboardingCarousel />
      <AppShell>
        <Outlet />
      </AppShell>
    </>
  );
}
