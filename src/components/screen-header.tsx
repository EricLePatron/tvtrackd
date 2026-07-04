import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { LogIn } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function ScreenHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  const { user, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="px-5 pt-8 pb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-counter text-[11px] uppercase tracking-[0.25em] text-primary">
            {eyebrow}
          </p>
          <h1 className="mt-2 font-display text-3xl text-foreground">{title}</h1>
        </div>
        {!user && !loading && (
          <Link
            to="/auth"
            search={{ redirect: pathname }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-primary/60 bg-primary/10 px-3 py-1.5 font-counter text-[10px] uppercase tracking-widest text-primary transition-colors hover:bg-primary/20"
          >
            <LogIn className="h-3.5 w-3.5" />
            Se connecter
          </Link>
        )}
      </div>
      {children ? <div className="mt-3 text-sm text-muted-foreground">{children}</div> : null}
    </header>
  );
}

export function EmptyPanel({
  label,
  stat,
  hint,
}: {
  label: string;
  stat: string;
  hint: string;
}) {
  return (
    <div className="mx-5 rounded-xl border border-border bg-card p-6">
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <span className="font-counter text-2xl text-foreground">{stat}</span>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}
