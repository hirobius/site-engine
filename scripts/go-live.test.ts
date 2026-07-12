import { describe, expect, it, vi } from "vitest";
import { readSiteUrl, runArmedBuild } from "./go-live.js";

describe("runArmedBuild", () => {
  it("refuses to proceed (returns false) when the armed build fails", () => {
    const spawnImpl = vi.fn().mockReturnValue({ status: 1 });
    expect(runArmedBuild("some-slug", spawnImpl)).toBe(false);
  });

  it("returns true when the armed build passes", () => {
    const spawnImpl = vi.fn().mockReturnValue({ status: 0 });
    expect(runArmedBuild("some-slug", spawnImpl)).toBe(true);
  });

  it("builds the right filtered package with SITE_LIVE=true", () => {
    const spawnImpl = vi.fn().mockReturnValue({ status: 0 });
    runArmedBuild("some-slug", spawnImpl);
    expect(spawnImpl).toHaveBeenCalledWith(
      "pnpm",
      ["--filter", "@hirobius/some-slug", "build"],
      expect.objectContaining({ env: expect.objectContaining({ SITE_LIVE: "true" }) }),
    );
  });
});

describe("readSiteUrl", () => {
  it("reads seo.siteUrl out of the app's client.config.ts", async () => {
    await expect(readSiteUrl("_template")).resolves.toBe("https://example.com");
  });
});
