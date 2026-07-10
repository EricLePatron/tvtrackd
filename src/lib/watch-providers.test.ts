import { describe, expect, it } from "vitest";
import {
  buildCategories,
  canonicalBrand,
  type WatchProvider,
  type WatchProviders,
} from "./watch-providers";

/**
 * Couvre uniquement `buildCategories`/`canonicalBrand`, la logique pure (pas
 * de rendu React) : catégories affichées (Abonnement/Gratuit uniquement,
 * Location/Achat exclus), fusion `free`+`ads`, et dédoublonnage par marque
 * (variantes TMDb/JustWatch d'un même distributeur, y compris entre
 * catégories).
 */

const provider = (id: number, name = `Provider ${id}`): WatchProvider => ({
  provider_id: id,
  provider_name: name,
  logo_path: null,
});

describe("canonicalBrand", () => {
  it("strips 'standard with ads' suffix", () => {
    expect(canonicalBrand("Netflix Standard With Ads")).toBe("netflix");
  });

  it("strips 'on prime video' suffix", () => {
    expect(canonicalBrand("HBO Max on Prime video")).toBe("hbo max");
  });

  it("strips 'with ads' suffix", () => {
    expect(canonicalBrand("Amazon Prime Video with Ads")).toBe("amazon prime video");
  });

  it("leaves a plain brand name untouched (lowercased)", () => {
    expect(canonicalBrand("Netflix")).toBe("netflix");
  });
});

describe("buildCategories", () => {
  it("returns [] for null", () => {
    expect(buildCategories(null)).toEqual([]);
  });

  it("returns [] for an empty object", () => {
    expect(buildCategories({})).toEqual([]);
  });

  it("never produces Location or Achat categories, even when rent/buy have data", () => {
    const watchProviders: WatchProviders = {
      buy: [provider(1)],
    };
    expect(buildCategories(watchProviders)).toEqual([]);
  });

  it("orders categories Abonnement -> Gratuit only, ignoring rent/buy entirely", () => {
    const watchProviders: WatchProviders = {
      buy: [provider(4)],
      rent: [provider(3)],
      free: [provider(2)],
      flatrate: [provider(1)],
    };
    const categories = buildCategories(watchProviders);
    expect(categories.map((c) => c.label)).toEqual(["Abonnement", "Gratuit"]);
  });

  it("merges free + ads under Gratuit, deduplicated by provider_id", () => {
    const shared = provider(1, "Shared");
    const watchProviders: WatchProviders = {
      free: [shared],
      ads: [shared, provider(2, "AdsOnly")],
    };
    const categories = buildCategories(watchProviders);
    const gratuit = categories.find((c) => c.key === "free");
    expect(gratuit).toBeDefined();
    expect(gratuit!.providers.map((p) => p.provider_id)).toEqual([1, 2]);
  });

  it("omits categories with no providers", () => {
    const watchProviders: WatchProviders = {
      flatrate: [provider(1)],
    };
    const categories = buildCategories(watchProviders);
    expect(categories.map((c) => c.key)).toEqual(["flatrate"]);
  });

  it("collapses brand variants within a category, keeping the shortest name", () => {
    const watchProviders: WatchProviders = {
      flatrate: [provider(1, "Netflix"), provider(2, "Netflix Standard With Ads")],
    };
    const categories = buildCategories(watchProviders);
    const abonnement = categories.find((c) => c.key === "flatrate");
    expect(abonnement!.providers).toHaveLength(1);
    expect(abonnement!.providers[0].provider_name).toBe("Netflix");
  });

  it("keeps a brand present in flatrate out of free (flatrate wins)", () => {
    const watchProviders: WatchProviders = {
      flatrate: [provider(1, "Netflix")],
      free: [provider(2, "Netflix Standard With Ads")],
    };
    const categories = buildCategories(watchProviders);
    expect(categories.map((c) => c.key)).toEqual(["flatrate"]);
    expect(categories[0].providers.map((p) => p.provider_name)).toEqual(["Netflix"]);
  });
});
