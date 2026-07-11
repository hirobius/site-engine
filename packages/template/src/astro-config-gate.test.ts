import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Every deployed app's astro.config.ts is a plain file copy of apps/_template's
 * (see middleware-gate.test.ts for the same drift risk on middleware.ts).
 * #78 armed the acceptance gate by adding an `armAcceptanceGate(client)` call
 * to every app; this asserts a future _template change (or a forgotten
 * backport on a new app) can't silently leave one app's build unarmed.
 */
const APPS_DIR = fileURLToPath(new URL("../../../apps", import.meta.url));
const EXEMPT = new Set(["_template", "_gallery"]);

const canonical = readFileSync(join(APPS_DIR, "_template", "astro.config.ts"), "utf8");

const apps = readdirSync(APPS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !EXEMPT.has(entry.name))
  .map((entry) => entry.name)
  .sort();

describe("app astro.config.ts matches the canonical _template acceptance gate", () => {
  it("the canonical _template config calls armAcceptanceGate", () => {
    expect(canonical).toContain("armAcceptanceGate(client)");
  });

  it.each(apps)("%s", (app) => {
    const actual = readFileSync(join(APPS_DIR, app, "astro.config.ts"), "utf8");
    expect(actual).toBe(canonical);
  });
});
