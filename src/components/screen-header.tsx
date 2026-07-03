import type { ReactNode } from "react";

export function ScreenHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="px-5 pt-8 pb-6">
      <p className="font-counter text-[11px] uppercase tracking-[0.25em] text-primary">
        {eyebrow}
      </p>
      <h1 className="mt-2 font-display text-3xl text-foreground">{title}</h1>
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
