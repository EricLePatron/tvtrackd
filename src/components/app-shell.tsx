import type { ReactNode } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { LegalFooter } from "@/components/legal-footer";
import { useReplayPendingIntent } from "@/hooks/use-replay-pending-intent";

export function AppShell({ children }: { children: ReactNode }) {
  useReplayPendingIntent();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-lg pb-24 md:max-w-3xl lg:max-w-5xl xl:max-w-6xl">
        {children}
        <LegalFooter />
      </div>
      <BottomNav />
    </div>
  );
}

