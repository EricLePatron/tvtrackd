import { describe, expect, it, vi } from "vitest";
import { retry } from "./retry";

describe("retry", () => {
  it("returns the result immediately when the first attempt succeeds", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(retry(fn, 2, 1)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries and eventually succeeds", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce("ok");
    await expect(retry(fn, 2, 1)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws the last error once attempts are exhausted", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(retry(fn, 2, 1)).rejects.toThrow("boom");
    // 1 tentative initiale + 2 retries = 3 appels au total.
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
