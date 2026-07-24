import { describe, expect, it } from "vitest";
import { isEligibleForSitemap } from "./sitemap-shows";

describe("isEligibleForSitemap", () => {
  it("série avec synopsis est éligible même sans providers ni saisons", () => {
    expect(
      isEligibleForSitemap(
        { overview: "Un synopsis.", watch_providers: null, media_type: "tv" },
        false,
      ),
    ).toBe(true);
  });

  it("série avec providers est éligible même sans synopsis ni saisons", () => {
    expect(
      isEligibleForSitemap(
        { overview: null, watch_providers: { flatrate: [{ provider_id: 1 }] }, media_type: "tv" },
        false,
      ),
    ).toBe(true);
  });

  it("série sans synopsis ni providers mais avec au moins une saison en cache est éligible", () => {
    expect(
      isEligibleForSitemap({ overview: null, watch_providers: {}, media_type: "tv" }, true),
    ).toBe(true);
  });

  it("série sans synopsis, sans providers et sans saison connue est exclue (thin content)", () => {
    expect(
      isEligibleForSitemap({ overview: "", watch_providers: {}, media_type: "tv" }, false),
    ).toBe(false);
  });

  it("synopsis composé uniquement d'espaces est traité comme absent", () => {
    expect(
      isEligibleForSitemap({ overview: "   ", watch_providers: null, media_type: "tv" }, false),
    ).toBe(false);
  });

  it("film sans synopsis ni providers est exclu — les saisons ne s'appliquent pas aux films", () => {
    expect(
      isEligibleForSitemap({ overview: null, watch_providers: null, media_type: "movie" }, true),
    ).toBe(false);
  });

  it("film avec synopsis est éligible", () => {
    expect(
      isEligibleForSitemap(
        { overview: "Un film.", watch_providers: null, media_type: "movie" },
        false,
      ),
    ).toBe(true);
  });
});
