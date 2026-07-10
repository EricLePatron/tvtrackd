// Logique pure du bloc "Où regarder" (page série/film) : catégorisation et
// dédoublonnage des offres de streaming TMDb/JustWatch. Volontairement sans
// aucun import React/UI pour rester testable par `vitest.config.ts`, qui ne
// résout pas l'alias de chemin `@/*` (cf. commentaire en tête de ce fichier
// de config — portée limitée aux fonctions pures de `src/lib`).

export type WatchProvider = {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
};

export type WatchProviders = {
  link?: string | null;
  flatrate?: WatchProvider[];
  rent?: WatchProvider[];
  buy?: WatchProvider[];
  ads?: WatchProvider[];
  free?: WatchProvider[];
};

export type NetworkRef = {
  id: number;
  name: string;
  logo_path: string | null;
};

export const MAX_VISIBLE_PER_CATEGORY = 6;

// Location (`rent`) et Achat (`buy`) ne sont volontairement plus affichés :
// décision produit pour réduire le bruit (lignes quasi-identiques d'un
// distributeur à l'autre pour un tracker, pas une boutique). Le backend
// continue de les stocker (`WatchProviders.rent`/`buy`), simplement ignorés
// ici.
export const CATEGORY_LABELS = {
  flatrate: "Abonnement",
  free: "Gratuit",
} as const;

export type CategoryKey = keyof typeof CATEGORY_LABELS;
export const CATEGORY_ORDER: CategoryKey[] = ["flatrate", "free"];

export type Category = { key: CategoryKey; label: string; providers: WatchProvider[] };

export function dedupeProviders(providers: WatchProvider[]): WatchProvider[] {
  const seen = new Set<number>();
  const out: WatchProvider[] = [];
  for (const p of providers) {
    if (seen.has(p.provider_id)) continue;
    seen.add(p.provider_id);
    out.push(p);
  }
  return out;
}

// Suffixes de variante TMDb/JustWatch à retirer pour retomber sur la marque
// de base (ex. "Netflix Standard With Ads" / "HBO Max on Prime video" sont
// la même marque que "Netflix" / "HBO Max" pour l'utilisateur). Ordre
// important : les suffixes les plus spécifiques d'abord, un seul suffixe
// retiré par appel (le premier qui matche).
export const BRAND_SUFFIXES = [
  "standard with ads",
  "with ads",
  "amazon channel",
  "apple tv+ channel",
  "apple tv channel",
  "channel",
  "on prime video",
];

export function canonicalBrand(name: string): string {
  const lower = name.toLowerCase();
  for (const suffix of BRAND_SUFFIXES) {
    if (lower.endsWith(suffix)) {
      return lower.slice(0, lower.length - suffix.length).trim();
    }
  }
  return lower.trim();
}

// Dédoublonne par marque canonique : en cas de collision, garde l'entrée au
// `provider_name` le plus court (la variante "de base"), et départage les
// égalités par le plus petit `provider_id`.
export function dedupeByBrand(
  providers: WatchProvider[],
  excludeBrands: ReadonlySet<string> = new Set(),
): WatchProvider[] {
  const byBrand = new Map<string, WatchProvider>();
  for (const p of providers) {
    const brand = canonicalBrand(p.provider_name);
    if (excludeBrands.has(brand)) continue;
    const existing = byBrand.get(brand);
    if (!existing) {
      byBrand.set(brand, p);
      continue;
    }
    const isShorter = p.provider_name.length < existing.provider_name.length;
    const isTieBroken =
      p.provider_name.length === existing.provider_name.length &&
      p.provider_id < existing.provider_id;
    if (isShorter || isTieBroken) {
      byBrand.set(brand, p);
    }
  }
  return Array.from(byBrand.values());
}

export function buildCategories(watchProviders: WatchProviders | null): Category[] {
  if (!watchProviders) return [];

  const flatrate = dedupeByBrand(dedupeProviders(watchProviders.flatrate ?? []));
  const flatrateBrands = new Set(flatrate.map((p) => canonicalBrand(p.provider_name)));

  // "Gratuit" fusionne les catégories TMDb `free` (gratuit avec compte) et
  // `ads` (gratuit avec publicité) : la distinction n'est pas utile pour
  // l'utilisateur. Une marque déjà retenue en Abonnement ne réapparaît pas
  // ici (Abonnement gagne le conflit de marque).
  const freeMerged = dedupeProviders([
    ...(watchProviders.free ?? []),
    ...(watchProviders.ads ?? []),
  ]);
  const free = dedupeByBrand(freeMerged, flatrateBrands);

  const byCategory: Record<CategoryKey, WatchProvider[]> = { flatrate, free };

  return CATEGORY_ORDER.filter((key) => byCategory[key].length > 0).map((key) => ({
    key,
    label: CATEGORY_LABELS[key],
    providers: byCategory[key],
  }));
}

export function providerInitials(providerName: string): string {
  return Array.from(providerName.trim()).slice(0, 2).join("").toUpperCase();
}
