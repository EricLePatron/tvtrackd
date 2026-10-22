// Reporter d'erreurs neutre (remplace l'ancien hook Lovable `__lovableEvents`).
// Point d'accroche unique pour brancher un vrai service (Sentry, etc.) plus tard :
// il suffira de compléter le corps de `reportError` sans toucher aux appelants.
export function reportError(error: unknown, context: Record<string, unknown> = {}) {
  const route = typeof window !== "undefined" ? window.location.pathname : undefined;
  console.error("[tvtrackd] error", { route, ...context }, error);
}
