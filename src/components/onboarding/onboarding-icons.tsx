import type { SVGProps } from "react";

/**
 * Bespoke line-art pictograms for the onboarding carousel (§1 of the
 * onboarding plan). Deliberately not lucide-react — these are custom
 * drawings called out by the design spec, not generic icons. Sizing is
 * controlled by the caller via `className` (width/height utilities);
 * color mostly follows `currentColor` so the caller also controls tone via
 * `text-*` classes, except where a specific accent is spec'd (cyan fill,
 * background-colored cutouts) which is hardcoded via `fill-*` utilities.
 */

type IconProps = SVGProps<SVGSVGElement>;

/** Card 1 — VHS cassette, front view: shell, two reels, blank label window, tick graduation. */
export function CassetteIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 100 70" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect x="4" y="5" width="92" height="60" rx="8" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="30" cy="24" r="8" fill="currentColor" />
      <circle cx="70" cy="24" r="8" fill="currentColor" />
      <rect x="24" y="38" width="52" height="16" rx="2" stroke="currentColor" strokeWidth="2.5" />
      <line
        x1="18"
        y1="59"
        x2="18"
        y2="53"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <line
        x1="38"
        y1="59"
        x2="38"
        y2="53"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <line
        x1="62"
        y1="59"
        x2="62"
        y2="53"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <line
        x1="82"
        y1="59"
        x2="82"
        y2="53"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Card 2, icon 1 — "Marquer vu": ticket-punch frame + cyan check disc. */
export function MarkWatchedIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect
        x="6"
        y="6"
        width="36"
        height="36"
        rx="9"
        className="stroke-foreground"
        strokeWidth="2"
      />
      <circle cx="42" cy="6" r="4.5" className="fill-background" />
      <circle cx="24" cy="24" r="10" className="fill-cyan-accent" />
      <path
        d="M19.5 24.5 L22.5 27.5 L28.5 20.5"
        className="stroke-background"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Card 2, icon 2 — "Suivre": dashed progress ring around a play disc. */
export function TrackProgressIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle
        cx="24"
        cy="24"
        r="19"
        className="stroke-muted-foreground"
        strokeWidth="2"
        strokeDasharray="6 6"
        strokeLinecap="round"
      />
      <circle cx="24" cy="24" r="11" className="fill-secondary" />
      <path d="M20.5 18 L30 24 L20.5 30 Z" className="fill-foreground" />
    </svg>
  );
}

/** Card 2, icon 3 — "Calendrier": 3x2 grid, single filled cell ("ce soir"). */
export function CalendarGridIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect
        x="5"
        y="8"
        width="38"
        height="32"
        rx="4"
        className="stroke-foreground"
        strokeWidth="2"
      />
      <line x1="5" y1="21.33" x2="43" y2="21.33" className="stroke-foreground" strokeWidth="2" />
      <line x1="5" y1="29.67" x2="43" y2="29.67" className="stroke-foreground" strokeWidth="2" />
      <line x1="17.67" y1="8" x2="17.67" y2="40" className="stroke-foreground" strokeWidth="2" />
      <line x1="30.33" y1="8" x2="30.33" y2="40" className="stroke-foreground" strokeWidth="2" />
      <rect x="18.3" y="22" width="11.4" height="7.4" className="fill-cyan-accent" />
    </svg>
  );
}

/**
 * Card 3 — data safety: a thick arrow dropping into a ticket-perforated
 * tray, with two document silhouettes fanned out behind it. The only
 * amber element in the whole carousel.
 */
export function ImportExportIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      {/* Document silhouettes, fanned behind the tray */}
      <path
        d="M30 34 h16 l6 6 v22 h-22 z"
        className="stroke-muted-foreground"
        strokeWidth="2"
        strokeLinejoin="round"
        transform="rotate(-8 38 46)"
      />
      <path
        d="M74 34 h16 l6 6 v22 h-22 z"
        className="stroke-muted-foreground"
        strokeWidth="2"
        strokeLinejoin="round"
        transform="rotate(8 82 46)"
      />
      {/* Thick arrow dropping down */}
      <line
        x1="60"
        y1="16"
        x2="60"
        y2="62"
        className="stroke-primary"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M45 50 L60 68 L75 50"
        className="stroke-primary"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Open tray with ticket-style notches */}
      <path
        d="M24 78 h72 v20 a4 4 0 0 1 -4 4 h-64 a4 4 0 0 1 -4 -4 z"
        className="stroke-primary"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <circle cx="42" cy="78" r="4" className="fill-background" />
      <circle cx="78" cy="78" r="4" className="fill-background" />
    </svg>
  );
}
