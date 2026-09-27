import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Turbo runs builds in strict env mode on Vercel: any variable not declared in
 * turbo.json is stripped before the build sees it. PREVIEW_BUILD was missing, so
 * the gated-preview exception (#188) could never fire on Vercel and every
 * outreach preview's production build failed the acceptance gate.
 */
const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const SCAN = ["packages/template/src", "packages/schema/src", "apps/_template"];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (name === "node_modules" || name === "dist") return [];
    if (statSync(p).isDirectory()) return files(p);
    return /\.(ts|mjs|astro)$/.test(name) && !name.includes(".test.") ? [p] : [];
  });
}

describe("turbo.json declares every build-time env var", () => {
  const turbo = JSON.parse(readFileSync(join(ROOT, "turbo.json"), "utf8"));
  const declared = new Set<string>([...(turbo.globalEnv ?? []), ...(turbo.tasks?.build?.env ?? [])]);
  const used = new Set<string>();
  for (const dir of SCAN) {
    for (const f of files(join(ROOT, dir))) {
      for (const m of readFileSync(f, "utf8").matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) if (m[1]) used.add(m[1]);
    }
  }

  it.each([...used].sort())("%s", (name) => {
    expect(declared.has(name)).toBe(true);
  });
});
