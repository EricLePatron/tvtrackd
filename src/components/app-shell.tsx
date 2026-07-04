import type { ReactNode } from "react";
import { BottomNav } from "@/components/bottom-nav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-lg pb-24">{children}</div>
      <BottomNav />
    </div>
  );
}
