import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { LogIn, User } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

/**
 * Accès au profil, désormais en haut à droite de chaque écran (il a quitté
 * la bottom nav, remplacé par l'entrée Calendrier).
 */
export function ProfileLink() {
  return (
    <Link
      to="/profile"
      aria-label="Profil"
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-elevated text-foreground transition-colors hover:border-primary/60 hover:text-primary"
    >
      <User className="h-4 w-4" />
    </Link>
  );
}


export function ScreenHeader({
  eyebrow,
  title,
  children,
  hideAuthPill = false,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
  /** Suppresses the "Se connecter" pill on screens that already surface their own auth CTAs (e.g. the anonymous Home hero). */
  hideAuthPill?: boolean;
}) {
  const { user, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="px-5 pt-10 pb-7">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-counter text-[11px] uppercase tracking-[0.25em] text-primary">
            {eyebrow}
          </p>
          <h1 className="mt-2 font-display text-4xl leading-[1.05] text-foreground sm:text-5xl">
            {title}
          </h1>
        </div>
        {!user && !loading && !hideAuthPill && (
          <Link
            to="/auth"
            search={{ redirect: pathname }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/60 bg-primary/10 px-3 py-1.5 font-counter text-[10px] uppercase tracking-widest text-primary transition-colors hover:bg-primary/20"
          >
            <LogIn className="h-3.5 w-3.5" />
            Se connecter
          </Link>
        )}
      </div>
      {children ? <div className="mt-3 text-[15px] text-muted-foreground">{children}</div> : null}
    </header>

  );
}

export function EmptyPanel({
  label,
  stat,
  hint,
  action,
}: {
  label: string;
  stat: string;
  hint: string;
  /** Optional call-to-action rendered under `hint` (e.g. library's "Exporter mes données" link on the empty Archive tab). Absent by default — every other empty state stays text-only. */
  action?: ReactNode;
}) {
  return (
    <div className="mx-5 rounded-xl border border-border bg-card p-6">
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
        <span className="font-counter text-2xl text-foreground">{stat}</span>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{hint}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
