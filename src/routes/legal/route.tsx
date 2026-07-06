import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/legal")({
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
