import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkLaunchRecord, readSiteUrl, runArmedBuild } from "./go-live.js";

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

describe("checkLaunchRecord", () => {
  const roots: string[] = [];
  function root(record?: string): string {
    const dir = mkdtempSync(join(tmpdir(), "go-live-"));
    roots.push(dir);
    if (record !== undefined) {
      mkdirSync(join(dir, "docs", "launches"), { recursive: true });
      writeFileSync(join(dir, "docs", "launches", "acme.md"), record);
    }
    return dir;
  }
  afterEach(() => roots.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

  it("fails naming the skill, the file and the line when there is no record", () => {
    const r = checkLaunchRecord("acme", root());
    expect(r.ok).toBe(false);
    expect(r.message).toContain("shipping-and-launch");
    expect(r.message).toContain("docs/launches/acme.md");
    expect(r.message).toContain("Shipping-Checklist: PASS");
  });

  it("fails when the record says FAIL or is missing the result line", () => {
    expect(checkLaunchRecord("acme", root("Shipping-Checklist: FAIL - no rollback plan\n")).ok).toBe(false);
    expect(checkLaunchRecord("acme", root("# Launch notes\nlooks fine\n")).ok).toBe(false);
  });

  it("fails on PASS with no summary", () => {
    expect(checkLaunchRecord("acme", root("Shipping-Checklist: PASS\n")).ok).toBe(false);
  });

  it("passes when the record carries a PASS line with a summary", () => {
    const r = checkLaunchRecord("acme", root("Shipping-Checklist: PASS - monitoring, rollback, DNS, verify-live reviewed\n"));
    expect(r.ok).toBe(true);
  });
});
