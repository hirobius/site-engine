import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ImpeccableFinding } from "../packages/template/src/design-quality.js";
import { buildGallery, formatReport, resolveGallerySkinsPage, type SpawnSyncLike } from "./skin-critique.js";

/**
 * Coverage for skin-critique's CLI plumbing (issue #177, the critic loop's
 * deterministic half — `docs/AUTHORING-SKINS.md` step 7 / `docs/SKIN-CRITIC.md`).
 * The real `impeccable detect` sweep itself is already covered end-to-end by
 * `packages/template/src/design-quality.test.ts` (#176) — this file only
 * exercises what's new here: locating the rendered gallery page, driving the
 * gallery build via an injectable `spawnSync`, and formatting the report /
 * exit-code contract the critic loop scripts against.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const FINDING: ImpeccableFinding = {
  antipattern: "overused-font",
  name: "Overused font",
  severity: "warning",
  file: "/abs/path/skins/index.html",
  line: 42,
  snippet: "Google Fonts: inter",
};

describe("resolveGallerySkinsPage", () => {
  it("points at the built skins page, not the source .astro file", () => {
    const target = resolveGallerySkinsPage(ROOT);
    expect(target).toBe(resolve(ROOT, "apps/_gallery/dist/skins/index.html"));
  });
});

describe("buildGallery", () => {
  it("returns true when the build exits 0", () => {
    const spawnSync: SpawnSyncLike = () => ({ status: 0 });
    expect(buildGallery(ROOT, spawnSync)).toBe(true);
  });

  it("returns false when the build exits non-zero", () => {
    const spawnSync: SpawnSyncLike = () => ({ status: 1 });
    expect(buildGallery(ROOT, spawnSync)).toBe(false);
  });

  it("invokes the gallery workspace filter, not a bare astro build", () => {
    let seenCommand = "";
    let seenArgs: string[] = [];
    const spawnSync: SpawnSyncLike = (command, args) => {
      seenCommand = command;
      seenArgs = args;
      return { status: 0 };
    };
    buildGallery(ROOT, spawnSync);
    expect(seenCommand).toBe("pnpm");
    expect(seenArgs).toEqual(["--filter", "@hirobius/gallery", "build"]);
  });
});

describe("formatReport", () => {
  it("reports a skip as clean (exit 0) — offline/no-npx never fails the loop", () => {
    const { text, exitCode } = formatReport({ skipped: true, reason: "npx timed out (offline?)" }, "target.html");
    expect(exitCode).toBe(0);
    expect(text).toMatch(/skipped/);
    expect(text).toMatch(/npx timed out/);
  });

  it("reports zero findings as clean (exit 0)", () => {
    const { text, exitCode } = formatReport({ skipped: false, findings: [] }, "target.html");
    expect(exitCode).toBe(0);
    expect(text).toMatch(/0 findings/);
  });

  it("reports findings as exit 2, mirroring impeccable's own eslint-style convention", () => {
    const { text, exitCode } = formatReport({ skipped: false, findings: [FINDING] }, "target.html");
    expect(exitCode).toBe(2);
    expect(text).toMatch(/1 finding/);
    expect(text).toMatch(/overused-font/);
    expect(text).toMatch(/Google Fonts: inter/);
  });
});
