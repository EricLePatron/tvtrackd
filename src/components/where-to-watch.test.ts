import { describe, expect, it } from "vitest";
import { buildCategories, type WatchProvider, type WatchProviders } from "./where-to-watch";

/**
 * Couvre uniquement `buildCategories`, la logique pure (pas de rendu React) :
 * ordre des catégories, fusion `free`+`ads` avec dédoublonnage, et exclusion
 * des catégories vides.
 */

const provider = (id: number, name = `Provider ${id}`): WatchProvider => ({
  provider_id: id,
  provider_name: name,
  logo_path: null,
});

describe("buildCategories", () => {
  it("returns [] for null", () => {
    expect(buildCategories(null)).toEqual([]);
  });

  it("returns [] for an empty object", () => {
    expect(buildCategories({})).toEqual([]);
  });

  it("orders categories Abonnement -> Gratuit -> Location -> Achat regardless of input order", () => {
    const watchProviders: WatchProviders = {
      buy: [provider(4)],
      rent: [provider(3)],
      free: [provider(2)],
      flatrate: [provider(1)],
    };
    const categories = buildCategories(watchProviders);
    expect(categories.map((c) => c.label)).toEqual(["Abonnement", "Gratuit", "Location", "Achat"]);
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
      rent: [],
      buy: undefined,
    };
    const categories = buildCategories(watchProviders);
    expect(categories.map((c) => c.key)).toEqual(["flatrate"]);
  });
});
