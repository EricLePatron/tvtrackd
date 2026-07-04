import { useCallback } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

/**
 * Gates any action that requires an authenticated user. If a session exists,
 * runs the callback; otherwise nudges the user to `/auth` with a toast and a
 * `redirect` search param so they land back where they were after signing in.
 */
export function useAuthGate() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const requireAuth = useCallback(
    (fn: () => void | Promise<void>, opts?: { reason?: string }) => {
      if (loading) return;
      if (user) return void fn();
      toast(opts?.reason ? `Connectez-vous pour ${opts.reason}` : "Connectez-vous pour continuer", {
        action: {
          label: "Se connecter",
          onClick: () => navigate({ to: "/auth", search: { redirect: pathname } }),
        },
      });
      navigate({ to: "/auth", search: { redirect: pathname } });
    },
    [user, loading, navigate, pathname],
  );

  return { requireAuth, isAuthenticated: !!user, loading };
}
