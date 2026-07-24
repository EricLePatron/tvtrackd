import type { ReactNode } from "react";
import { CheckCircle2, ExternalLink, Info } from "lucide-react";

/**
 * Blocs de présentation partagés entre le guide d'import authentifié
 * (`_authenticated/import.tsx`) et la landing publique `/alternative-tv-time`
 * (cf. P0-3 SEO) — extraits pour ne pas dupliquer le texte des sources
 * d'export (TV Time / Betaseries) à deux endroits qui pourraient diverger.
 * Purement présentationnels, aucune logique d'import ici.
 */

export function StepCard({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/15 font-counter text-sm text-primary">
          {String(number).padStart(2, "0")}
        </div>
        <h3 className="font-display text-base text-foreground">{title}</h3>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function SourceBlock({
  name,
  description,
  cta,
  href,
  hint,
}: {
  name: string;
  description: string;
  cta: string;
  href: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-elevated/40 p-4">
      <p className="font-display text-sm text-foreground">{name}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
      >
        {cta}
        <ExternalLink className="h-3 w-3" />
      </a>
      {hint && (
        <div className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-cyan-accent">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{hint}</span>
        </div>
      )}
    </div>
  );
}

export function Bullet({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary" />
      <span>{children}</span>
    </li>
  );
}

export function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="group rounded-md bg-surface-elevated/40 p-3">
      <summary className="cursor-pointer list-none text-xs font-medium text-foreground marker:hidden">
        {q}
        <span className="float-right font-counter text-[10px] text-muted-foreground group-open:hidden">
          +
        </span>
        <span className="float-right hidden font-counter text-[10px] text-muted-foreground group-open:inline">
          −
        </span>
      </summary>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{children}</p>
    </details>
  );
}
