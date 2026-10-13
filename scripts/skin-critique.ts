#!/usr/bin/env tsx
/**
 * skin-critique — the deterministic half of the skin-authoring critic loop
 * (issue #177, epic #173's amplification move ②, `docs/AUTHORING-SKINS.md`
 * step 7 / `docs/SKIN-CRITIC.md`).
 *
 *   pnpm skin-critique              # build the gallery, then scan every skin's page
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
 * against the **rendered** full-page skin renders —
 * `apps/_gallery/dist/skins/<id>/index.html`, one per `SKIN_IDS` entry, built
 * from `apps/_gallery/src/pages/skins/[id].astro` — rather than component
 * *source* (#176's target), and reports findings per skin. The `/skins`
 * overview page itself is only an iframe shell, so scanning it would see no
 * skin at all. This is a taste/rendering-output check on top of #176's
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
import { SKIN_IDS, type SkinId } from "@hirobius/schema";
import {
  runImpeccableDetect,
  type DesignQualityResult,
  type ImpeccableFinding,
} from "../packages/template/src/design-quality.js";

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

export interface SkinPage {
  id: SkinId;
  path: string;
}

/**
 * Where each skin's full-page render lands after a static `astro build` —
 * `apps/_gallery/dist/skins/<id>/index.html`, one per `SKIN_IDS` entry
 * (`apps/_gallery/src/pages/skins/[id].astro`'s `getStaticPaths`).
 */
export function resolveGallerySkinPages(root: string, ids: readonly SkinId[] = SKIN_IDS): SkinPage[] {
  return ids.map((id) => ({ id, path: resolve(root, "apps/_gallery/dist/skins", id, "index.html") }));
}

/** impeccable reports absolute or cwd-relative paths; match either form. */
function findingIsFor(file: string, pagePath: string): boolean {
  const norm = file.replace(/\\/g, "/").replace(/^\.\//, "");
  const page = pagePath.replace(/\\/g, "/");
  return norm === page || page.endsWith(`/${norm}`);
}

/**
 * Split one detect run over every skin page back into a result per skin, by
 * the file each finding names. A skipped run stays skipped for every skin.
 */
export function groupBySkin(
  result: DesignQualityResult,
  pages: readonly SkinPage[],
): Array<{ page: SkinPage; result: DesignQualityResult }> {
  if (result.skipped) return pages.map((page) => ({ page, result }));
  return pages.map((page) => {
    const findings: ImpeccableFinding[] = result.findings.filter((f) => findingIsFor(f.file, page.path));
    return { page, result: { skipped: false, findings } };
  });
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

  const pages = resolveGallerySkinPages(ROOT);
  const missing = pages.filter((p) => !existsSync(p.path));
  if (missing.length > 0) {
    console.error(
      `\n✖ ${missing.map((p) => p.path).join(", ")} missing. Run without --skip-build, or build the gallery first:\n` +
        `    pnpm --filter @hirobius/gallery build\n`,
    );
    process.exit(1);
  }

  const result = await runImpeccableDetect(
    pages.map((p) => p.path),
    { cwd: ROOT },
  );
  const perSkinResults = groupBySkin(result, pages);
  let exitCode: 0 | 2 = 0;
  for (const { page, result: perSkin } of perSkinResults) {
    const report = formatReport(perSkin, `skin "${page.id}" (${page.path})`);
    console.log(report.text);
    if (report.exitCode === 2) exitCode = 2;
  }

  if (outPath) {
    mkdirSync(dirname(resolve(ROOT, outPath)), { recursive: true });
    const bySkin = Object.fromEntries(perSkinResults.map(({ page, result: r }) => [page.id, r]));
    writeFileSync(resolve(ROOT, outPath), JSON.stringify(bySkin, null, 2));
    console.log(`\nWrote ${outPath}`);
  }

  process.exit(exitCode);
}
