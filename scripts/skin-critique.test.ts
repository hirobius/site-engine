import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ImpeccableFinding } from "../packages/template/src/design-quality.js";
import { SKIN_IDS } from "@hirobius/schema";
import {
  buildGallery,
  formatReport,
  groupBySkin,
  resolveGallerySkinPages,
  type SpawnSyncLike,
} from "./skin-critique.js";

/**
 * Coverage for skin-critique's CLI plumbing (issue #177, the critic loop's
 * deterministic half — `docs/AUTHORING-SKINS.md` step 7 / `docs/SKIN-CRITIC.md`).
 * The real `impeccable detect` sweep itself is already covered end-to-end by
 * `packages/template/src/design-quality.test.ts` (#176) — this file only
 * exercises what's new here: locating every skin's rendered gallery page,
 * splitting findings back per skin, driving the
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

describe("resolveGallerySkinPages", () => {
  it("lists one built full-page render per SKIN_IDS entry, not the iframe overview", () => {
    const pages = resolveGallerySkinPages(ROOT);
    expect(pages.map((p) => p.id)).toEqual([...SKIN_IDS]);
    for (const { id, path } of pages) {
      expect(path).toBe(resolve(ROOT, "apps/_gallery/dist/skins", id, "index.html"));
    }
    expect(pages.map((p) => p.path)).not.toContain(resolve(ROOT, "apps/_gallery/dist/skins/index.html"));
  });
});

describe("groupBySkin", () => {
  const pages = resolveGallerySkinPages(ROOT, ["classic", "warm-editorial"]);

  it("attributes each finding to the skin page it names (absolute or root-relative path)", () => {
    const onClassic = { ...FINDING, file: pages[0]!.path };
    const onWarm = { ...FINDING, file: "apps/_gallery/dist/skins/warm-editorial/index.html" };
    const grouped = groupBySkin({ skipped: false, findings: [onClassic, onWarm, onWarm] }, pages);
    expect(grouped.map(({ page, result }) => [page.id, result.skipped ? -1 : result.findings.length])).toEqual([
      ["classic", 1],
      ["warm-editorial", 2],
    ]);
  });

  it("keeps a skipped run skipped for every skin", () => {
    const grouped = groupBySkin({ skipped: true, reason: "offline" }, pages);
    expect(grouped.every(({ result }) => result.skipped)).toBe(true);
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
