/**
 * Retry léger avec petit backoff linéaire, pour les fetch critiques appelés
 * depuis un `loader` de route TanStack Router. Un `loader` ne bénéficie PAS
 * du retry par défaut de react-query (3 tentatives) qu'avait le `useQuery`
 * équivalent avant le passage en SSR (cf. QA P0-1, majeur #3) — sans ce
 * filet, une erreur TMDb transitoire qui était auparavant absorbée
 * silencieusement devient un écran d'erreur immédiat. Volontairement
 * minimal : pas de jitter, pas de backoff exponentiel, pas de configuration
 * par erreur — juste de quoi retrouver la résilience perdue.
 */
export async function retry<T>(fn: () => Promise<T>, attempts = 2, baseDelayMs = 300): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === attempts) break;
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * (attempt + 1)));
    }
  }
  throw lastError;
}
