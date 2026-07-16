#!/usr/bin/env tsx
/**
 * skin-critique — the deterministic half of the skin-authoring critic loop
 * (issue #177, epic #173's amplification move ②, `docs/AUTHORING-SKINS.md`
 * step 7 / `docs/SKIN-CRITIC.md`).
 *
 *   pnpm skin-critique              # build the gallery, then scan the skins page
 *   pnpm skin-critique --skip-build # scan an already-built apps/_gallery/dist
 *   pnpm skin-critique --out report.json
 *
 * `docs/SKIN-CRITIC.md`'s "Deterministic half" section investigated whether
 * `impeccable`'s `critique`/`polish` subcommands exist for #177 — they don't
 * (only `detect` is a real CLI subcommand on the pinned `impeccable@3`; the
 * ops#209/#175 references to `critique`/`polish` are provider *skills*
 * `impeccable install` fetches from `impeccable.style`, unreachable from this
 * repo's sandboxed sessions — HTTP 403 on the one attempt made investigating
 * this). So the deterministic half this script wires is `detect`, reusing
 * `runImpeccableDetect()` (`packages/template/src/design-quality.ts`, #176)
 * against the **rendered** `apps/_gallery/src/pages/skins.astro` page — every
 * `SKIN_IDS` entry side by side — rather than component *source* (#176's
 * target). This is a taste/rendering-output check on top of #176's
 * source-level gate, not a replacement for it.
 *
 * Same offline-safe contract as `design-quality.ts`: no network/npx available
 * → prints a skip reason and exits 0 (never fails the loop on infra it can't
 * reach). Exit code otherwise mirrors impeccable's own convention (0 clean,
 * 2 findings) so the critic loop can script "did detect pass" without parsing
 * output.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync as nodeSpawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runImpeccableDetect, type DesignQualityResult } from "../packages/template/src/design-quality.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Injectable for tests — avoids a real `pnpm --filter @hirobius/gallery build` per test run. */
export type SpawnSyncLike = (
  command: string,
  args: string[],
  options: { cwd: string; stdio: "inherit" },
) => { status: number | null };

function defaultSpawnSync(
  command: string,
  args: string[],
  options: { cwd: string; stdio: "inherit" },
): { status: number | null } {
  return nodeSpawnSync(command, args, options);
}

/** Where the gallery's rendered skins page lands after a static `astro build`. */
export function resolveGallerySkinsPage(root: string): string {
  return resolve(root, "apps/_gallery/dist/skins/index.html");
}

/**
 * Builds `@hirobius/gallery` (`pnpm --filter @hirobius/gallery build`) so the
 * skins page reflects whatever `SKINS` entry is currently being authored —
 * skipping this and scanning a stale `dist/` is the #1 way to critique the
 * wrong render. Returns false (and lets the caller decide what to do) rather
 * than throwing, so a build failure reports cleanly instead of a stack trace.
 */
export function buildGallery(root: string, spawnSync: SpawnSyncLike = defaultSpawnSync): boolean {
  const result = spawnSync("pnpm", ["--filter", "@hirobius/gallery", "build"], { cwd: root, stdio: "inherit" });
  return result.status === 0;
}

/**
 * Human-readable report + the exit code the critic loop should react to.
 * Mirrors impeccable's own eslint-style convention (0 clean, 2 findings) so
 * `pnpm skin-critique && …` composes the same way `impeccable detect` does —
 * a `skipped` result is treated as clean (0), never as a failure, per the
 * offline-safe contract every impeccable wrapper in this repo follows.
 */
export function formatReport(result: DesignQualityResult, target: string): { text: string; exitCode: 0 | 2 } {
  if (result.skipped) {
    return { text: `impeccable detect skipped for ${target} — ${result.reason}`, exitCode: 0 };
  }
  if (result.findings.length === 0) {
    return { text: `impeccable detect: 0 findings for ${target}`, exitCode: 0 };
  }
  const lines = result.findings.map(
    (f) => `  [${f.antipattern}] ${f.name} — ${f.file}:${f.line ?? "?"}${f.snippet ? `\n    ${f.snippet}` : ""}`,
  );
  return {
    text: `impeccable detect: ${result.findings.length} finding(s) for ${target}\n${lines.join("\n")}`,
    exitCode: 2,
  };
}

function isMain(): boolean {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(resolve(entry)).href;
}

if (isMain()) {
  const argv = process.argv.slice(2);
  const skipBuild = argv.includes("--skip-build");
  const outIdx = argv.indexOf("--out");
  const outPath = outIdx >= 0 ? argv[outIdx + 1] : undefined;

  if (!skipBuild) {
    const built = buildGallery(ROOT);
    if (!built) {
      console.error("\n✖ apps/_gallery build failed — fix the build before critiquing its render.\n");
      process.exit(1);
    }
  }

  const target = resolveGallerySkinsPage(ROOT);
  if (!existsSync(target)) {
    console.error(
      `\n✖ ${target} doesn't exist. Run without --skip-build, or build the gallery first:\n` +
        `    pnpm --filter @hirobius/gallery build\n`,
    );
    process.exit(1);
  }

  const result = await runImpeccableDetect([target], { cwd: ROOT });
  const { text, exitCode } = formatReport(result, target);
  console.log(text);

  if (outPath) {
    mkdirSync(dirname(resolve(ROOT, outPath)), { recursive: true });
    writeFileSync(resolve(ROOT, outPath), JSON.stringify(result, null, 2));
    console.log(`\nWrote ${outPath}`);
  }

  process.exit(exitCode);
}
