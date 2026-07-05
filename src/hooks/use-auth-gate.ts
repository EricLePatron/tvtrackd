import { useCallback } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { savePendingIntent, type PendingIntent } from "@/lib/client-storage";

/**
 * Gates any action that requires an authenticated user. If a session exists,
 * runs the callback; otherwise nudges the user to `/auth` with a toast and a
 * `redirect` search param so they land back where they were after signing
 * in. When an `intent` is provided, it's persisted (sessionStorage) before
 * redirecting so `useReplayPendingIntent` can replay the action automatically
 * once the user is signed in — see `src/hooks/use-replay-pending-intent.ts`.
 */
export function useAuthGate() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const requireAuth = useCallback(
    (fn: () => void | Promise<void>, opts?: { reason?: string; intent?: PendingIntent }) => {
      if (loading) return;
      if (user) return void fn();
      if (opts?.intent) savePendingIntent(opts.intent);
      const message = opts?.reason
        ? `Connectez-vous pour ${opts.reason}`
        : "Gardez une trace de ce que vous regardez";
      toast(message, {
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
