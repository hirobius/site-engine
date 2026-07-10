import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Every deployed app's middleware.ts is a plain file copy of apps/_template's
 * (see that file's header) — there's no shared import, so drift is silent.
 * PR #34 fixed the closed-by-default gate only in _template + one app; four
 * other deployed apps kept running the old open-by-default logic (#50). This
 * asserts every app's middleware.ts is byte-identical to the canonical one,
 * so a future fix to _template that isn't backported fails the build.
 */
const APPS_DIR = fileURLToPath(new URL("../../../apps", import.meta.url));
const EXEMPT = new Set(["_template", "_gallery"]);

const canonical = readFileSync(join(APPS_DIR, "_template", "middleware.ts"), "utf8");

const apps = readdirSync(APPS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !EXEMPT.has(entry.name))
  .map((entry) => entry.name)
  .sort();

describe("app middleware.ts matches the canonical _template gate", () => {
  it.each(apps)("%s", (app) => {
    const actual = readFileSync(join(APPS_DIR, app, "middleware.ts"), "utf8");
    expect(actual).toBe(canonical);
  });
});
