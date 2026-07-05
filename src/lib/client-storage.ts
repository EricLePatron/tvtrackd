/**
 * Centralized, SSR-safe localStorage/sessionStorage helpers for the
 * anonymous-visitor onboarding flow (see CLAUDE.md — onboarding carousel,
 * post-auth action replay, recurrent-visitor nudge). Keeping every storage
 * key/read/write in one file makes them easy to audit and rename.
 */

function safeGet(storage: () => Storage, key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage: () => Storage, key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    storage().setItem(key, value);
  } catch {
    // Storage unavailable (private mode, quota, etc.) — fail silently, this
    // is all best-effort UX nudging, never load-bearing.
  }
}

function safeRemove(storage: () => Storage, key: string): void {
  if (typeof window === "undefined") return;
  try {
    storage().removeItem(key);
  } catch {
    // no-op
  }
}

const localStore = () => window.localStorage;
const sessionStore = () => window.sessionStorage;

// --- Onboarding carousel (§1) ------------------------------------------

const ONBOARDING_SEEN_KEY = "onboarding_seen";

export function hasSeenOnboarding(): boolean {
  return safeGet(localStore, ONBOARDING_SEEN_KEY) === "true";
}

export function markOnboardingSeen(): void {
  safeSet(localStore, ONBOARDING_SEEN_KEY, "true");
}

// --- Pending action intent, replayed after sign-in (§3) -----------------

export type PendingIntent =
  | { kind: "follow"; tmdbId: number; mediaType: "tv" | "movie" }
  | {
      kind: "mark_watched";
      tmdbId: number;
      mediaType: "tv" | "movie";
      seasonNumber: number;
      episodeNumber: number;
    };

const PENDING_INTENT_KEY = "pending_auth_intent";

export function savePendingIntent(intent: PendingIntent): void {
  safeSet(sessionStore, PENDING_INTENT_KEY, JSON.stringify(intent));
}

/** Reads and clears the pending intent in one go — it's replayed at most once. */
export function takePendingIntent(): PendingIntent | null {
  const raw = safeGet(sessionStore, PENDING_INTENT_KEY);
  if (!raw) return null;
  safeRemove(sessionStore, PENDING_INTENT_KEY);
  try {
    return JSON.parse(raw) as PendingIntent;
  } catch {
    return null;
  }
}

// --- Recurrent-visitor nudge (§4) ---------------------------------------

const VISIT_COUNT_KEY = "visit_count";
const SESSION_VISIT_MARKED_KEY = "visit_counted_this_session";
const SHOW_VIEWS_KEY = "show_views_this_session";
const RECURRENT_BANNER_SHOWN_KEY = "recurrent_banner_shown";

/** Increments the cross-session visit counter at most once per tab session. */
export function registerVisitOncePerSession(): void {
  if (safeGet(sessionStore, SESSION_VISIT_MARKED_KEY) === "true") return;
  safeSet(sessionStore, SESSION_VISIT_MARKED_KEY, "true");
  const current = Number(safeGet(localStore, VISIT_COUNT_KEY) ?? "0");
  safeSet(localStore, VISIT_COUNT_KEY, String(current + 1));
}

export function getVisitCount(): number {
  return Number(safeGet(localStore, VISIT_COUNT_KEY) ?? "0");
}

/** Increments the in-session show-detail page view counter. */
export function registerShowView(): void {
  const current = Number(safeGet(sessionStore, SHOW_VIEWS_KEY) ?? "0");
  safeSet(sessionStore, SHOW_VIEWS_KEY, String(current + 1));
}

export function getShowViewsThisSession(): number {
  return Number(safeGet(sessionStore, SHOW_VIEWS_KEY) ?? "0");
}

export function hasShownRecurrentBanner(): boolean {
  return safeGet(localStore, RECURRENT_BANNER_SHOWN_KEY) === "true";
}

export function markRecurrentBannerShown(): void {
  safeSet(localStore, RECURRENT_BANNER_SHOWN_KEY, "true");
}
