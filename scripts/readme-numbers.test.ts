import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

// hirobius/ops#681: every number the docs show is sourced or cut.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readme = readFileSync(resolve(root, "README.md"), "utf8");
const lhci = createRequire(import.meta.url)(
  resolve(root, "apps/demo-pressure-pros/lighthouserc.cjs"),
);

describe("README numbers", () => {
  it("states the Lighthouse performance floor that lighthouserc.cjs enforces", () => {
    const min = lhci.ci.assert.assertions["categories:performance"][1].minScore;
    expect(readme).toContain(`Performance ≥ ${Math.round(min * 100)}`);
    expect(readme).not.toContain("Performance ≥ 95");
  });

  it("carries no unproven timing or pricing claims", () => {
    expect(readme).not.toMatch(/in 10 minutes/i);
    expect(readme).not.toMatch(/\$9\/mo/);
  });
});
