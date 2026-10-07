import { describe, expect, it } from "vitest";
import { resolveChromiumExecutable } from "./resolve-playwright-browser.js";

const exists = (set: Set<string>) => (p: string) => set.has(p);

describe("resolveChromiumExecutable", () => {
  it("returns undefined when no pre-installed browser is present (CI/local)", () => {
    expect(resolveChromiumExecutable({ env: {}, exists: exists(new Set()) })).toBeUndefined();
  });

  it("resolves the stable symlink under PLAYWRIGHT_BROWSERS_PATH", () => {
    expect(
      resolveChromiumExecutable({
        env: { PLAYWRIGHT_BROWSERS_PATH: "/opt/pw-browsers" },
        exists: exists(new Set(["/opt/pw-browsers/chromium"])),
      }),
    ).toBe("/opt/pw-browsers/chromium");
  });

  it("falls back to the documented default path when the env var is unset", () => {
    expect(
      resolveChromiumExecutable({
        env: {},
        exists: exists(new Set(["/opt/pw-browsers/chromium"])),
      }),
    ).toBe("/opt/pw-browsers/chromium");
  });

  it("honors an explicit PLAYWRIGHT_CHROMIUM_EXECUTABLE override", () => {
    expect(
      resolveChromiumExecutable({
        env: {
          PLAYWRIGHT_CHROMIUM_EXECUTABLE: "/custom/chrome",
          PLAYWRIGHT_BROWSERS_PATH: "/opt/pw-browsers",
        },
        exists: exists(new Set(["/custom/chrome", "/opt/pw-browsers/chromium"])),
      }),
    ).toBe("/custom/chrome");
  });

  it("ignores a non-existent explicit override and continues probing", () => {
    expect(
      resolveChromiumExecutable({
        env: {
          PLAYWRIGHT_CHROMIUM_EXECUTABLE: "/gone",
          PLAYWRIGHT_BROWSERS_PATH: "/opt/pw-browsers",
        },
        exists: exists(new Set(["/opt/pw-browsers/chromium"])),
      }),
    ).toBe("/opt/pw-browsers/chromium");
  });

  it("prefers the env-declared browsers path over the hardcoded default", () => {
    expect(
      resolveChromiumExecutable({
        env: { PLAYWRIGHT_BROWSERS_PATH: "/custom/browsers" },
        exists: exists(new Set(["/custom/browsers/chromium", "/opt/pw-browsers/chromium"])),
      }),
    ).toBe("/custom/browsers/chromium");
  });
});
