import { Link } from "@tanstack/react-router";
import type { NextReleaseItem } from "@/lib/schedule";
import { StatusPill } from "@/components/status-pill";

/**
 * "Nouvelle saison" spotlight card (Lot 2) — fine poster-left row, a
 * DELIBERATELY distinct silhouette from both the hero (`aspect-[16/10]`
 * backdrop card) and the "Bientôt"/"Sort aujourd'hui" gabarit
 * (`aspect-[16/7]` backdrop card, see `NextReleaseHeroCard`): no backdrop
 * image at all here, poster-led instead — reuses the "carte fine" fine-print
 * vocabulary already established elsewhere on this screen (`AnonymousHome`'s
 * "Mémoire durable" card: `rounded-2xl border border-white/[0.07]
 * bg-white/[0.018]`), rather than introducing a fourth card format.
 *
 * Deliberately NO `VhsCounter`/watched-total fraction/check mark — reserved
 * for the hero (CLAUDE.md's "compteur mécanique" signature is a watched/total
 * tally, meaningless for a premiere that hasn't aired at all yet, `daysUntil`
 * is always >= 1 by construction — see `selectPremiereSoon`). The countdown
 * here is a single, large, un-glowed number (unlike the hero's cyan digit,
 * which DOES glow) — no fraction, just "N" + "jour(s)".
 */
export function PremiereSoonCard({ item }: { item: NextReleaseItem }) {
  const { show, episode, daysUntil } = item;

  return (
    <Link
      to="/show/$mediaType/$tmdbId"
      params={{ mediaType: show.media_type, tmdbId: String(show.tmdb_id) }}
      className="flex gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.018] p-4"
    >
      <div className="aspect-[2/3] w-20 shrink-0 overflow-hidden rounded-lg bg-surface-elevated sm:w-24">
        {show.poster_path && (
          <img
            src={show.poster_path}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="self-start">
          <StatusPill label="PREMIÈRE" tone="cyan" />
        </div>
        <h3 className="mt-2 font-display text-base leading-tight text-foreground line-clamp-2">
          {show.title}
        </h3>
        <p className="mt-1 font-counter text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Saison {episode.season_number} · Première
        </p>

        <div className="mt-2 flex items-end justify-between gap-3">
          <div className="flex items-baseline gap-1.5 font-counter tabular-nums">
            <span className="text-[26px] leading-none text-cyan-accent">{daysUntil}</span>
            <span className="text-xs text-muted-foreground">
              {daysUntil === 1 ? "jour" : "jours"}
            </span>
          </div>
          {/* CTA décoratif — la carte entière est déjà le `Link`, ce n'est pas
              un second élément interactif/focusable. */}
          <span className="shrink-0 rounded-md bg-cyan-accent/10 px-3 py-1 font-counter text-xs font-semibold text-cyan-accent">
            Voir →
          </span>
        </div>
      </div>
    </Link>
  );
}
