#!/usr/bin/env tsx
/**
 * inspiration-capture — S3 of epic #173: design-time extraction helpers that
 * drop a reference into an inspiration brief's `assets/` folder
 * (`docs/inspiration/README.md`, `docs/AUTHORING-SKINS.md` step 1).
 *
 *   pnpm inspiration:capture <brief> --url <u> [--url <u2>] [--full-page]
 *   pnpm inspiration:capture <brief> --video docs/inspiration/<brief>/assets/clip.mp4 [--fps 1]
 *
 * Link capture takes a 1440x900 desktop and a 390x844 mobile screenshot per
 * URL through the gallery's pinned Playwright
 * (`pnpm --filter @hirobius/gallery exec playwright screenshot`), saved as
 * `assets/link-<host>-<n>.png` / `…-<n>-mobile.png`. Video capture samples
 * frames with `ffmpeg -vf fps=<n>` into `assets/<clip>-frame-%03d.png`.
 *
 * This is a manual authoring tool, not a CI gate: it exits non-zero with an
 * actionable message when Chromium or ffmpeg is missing. It never writes
 * outside `docs/inspiration/<brief>/assets/`. The files it writes are
 * extraction input only; they are never shipped to a client site.
 */
import { existsSync, mkdirSync } from "node:fs";
import { spawnSync as nodeSpawnSync } from "node:child_process";
import { basename, dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const DESKTOP_VIEWPORT = { width: 1440, height: 900 } as const;
export const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;

const PLAYWRIGHT_CONTAINER = "mcr.microsoft.com/playwright:v1.60.0-noble";
const INSTALL_CHROMIUM = "pnpm --filter @hirobius/gallery exec playwright install chromium";

export type Viewport = { width: number; height: number };

export type CaptureArgs =
  | { mode: "link"; brief: string; urls: string[]; fullPage: boolean }
  | { mode: "video"; brief: string; video: string; fps: number };

/** Injectable for tests, so no real browser or ffmpeg runs per test. */
export type SpawnSyncLike = (
  command: string,
  args: string[],
  options: { cwd: string },
) => { status: number | null; error?: Error & { code?: string }; stderr?: string };

function defaultSpawnSync(command: string, args: string[], options: { cwd: string }) {
  const r = nodeSpawnSync(command, args, {
    cwd: options.cwd,
    // stdout streams to the terminal; stderr is captured so a missing
    // browser can be recognised (and is echoed back on failure).
    stdio: ["ignore", "inherit", "pipe"],
    encoding: "utf8",
  });
  return { status: r.status, error: r.error as (Error & { code?: string }) | undefined, stderr: r.stderr ?? "" };
}

export class CaptureUsageError extends Error {}

const USAGE =
  "Usage:\n" +
  "  pnpm inspiration:capture <brief> --url <u> [--url <u2>] [--full-page]\n" +
  "  pnpm inspiration:capture <brief> --video docs/inspiration/<brief>/assets/clip.mp4 [--fps 1]";

function usage(message: string): never {
  throw new CaptureUsageError(`${message}\n\n${USAGE}`);
}

export function parseCaptureArgs(argv: string[]): CaptureArgs {
  let brief: string | undefined;
  const urls: string[] = [];
  let video: string | undefined;
  let fpsRaw: string | undefined;
  let fullPage = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = (): string => {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith("--")) usage(`${arg} needs a value.`);
      i++;
      return v;
    };
    if (arg === "--url") urls.push(value());
    else if (arg === "--video") video = value();
    else if (arg === "--fps") fpsRaw = value();
    else if (arg === "--full-page") fullPage = true;
    else if (arg.startsWith("--")) usage(`Unknown option ${arg}.`);
    else if (brief === undefined) brief = arg;
    else usage(`Unexpected argument ${arg}: pass one brief name.`);
  }

  if (!brief) usage("Missing <brief>: the folder name under docs/inspiration/.");
  if (urls.length > 0 && video) usage("Pass --url or --video, not both.");
  if (urls.length === 0 && !video) usage("Nothing to capture: pass --url or --video.");

  if (video) {
    let fps = 1;
    if (fpsRaw !== undefined) {
      fps = Number(fpsRaw);
      if (!Number.isFinite(fps) || fps <= 0) usage(`--fps must be a positive number (got ${fpsRaw}).`);
    }
    return { mode: "video", brief, video, fps };
  }

  if (fpsRaw !== undefined) usage("--fps only applies to --video.");
  for (const u of urls) {
    let parsed: URL | undefined;
    try {
      parsed = new URL(u);
    } catch {
      parsed = undefined;
    }
    if (!parsed || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) {
      usage(`--url must be an absolute http(s) URL (got ${u}).`);
    }
  }
  return { mode: "link", brief, urls, fullPage };
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Validates the brief slug and that its folder exists; returns absolute dirs. */
export function resolveBriefDirs(root: string, brief: string): { briefDir: string; assetsDir: string } {
  if (!SLUG.test(brief)) {
    throw new CaptureUsageError(
      `Brief name "${brief}" must be a kebab-case slug (lowercase letters, digits, single hyphens), e.g. calm-coastal.`,
    );
  }
  const briefDir = resolve(root, "docs/inspiration", brief);
  if (!existsSync(briefDir)) {
    throw new CaptureUsageError(
      `docs/inspiration/${brief}/ doesn't exist. Start the brief first:\n` +
        `    mkdir -p docs/inspiration/${brief}/assets\n` +
        `    cp docs/inspiration/_template/BRIEF.md docs/inspiration/${brief}/BRIEF.md`,
    );
  }
  return { briefDir, assetsDir: resolve(briefDir, "assets") };
}

/** Deterministic output names for the n-th (1-based) --url. */
export function linkOutputPaths(assetsDir: string, url: string, n: number): { desktop: string; mobile: string } {
  const host = new URL(url).host.toLowerCase().replace(/[^a-z0-9.-]+/g, "-");
  return {
    desktop: resolve(assetsDir, `link-${host}-${n}.png`),
    mobile: resolve(assetsDir, `link-${host}-${n}-mobile.png`),
  };
}

/** Argv for `pnpm`: gallery-scoped Playwright CLI screenshot. `out` must be absolute (exec runs in apps/_gallery). */
export function buildPlaywrightArgs(url: string, out: string, viewport: Viewport, fullPage: boolean): string[] {
  return [
    "--filter",
    "@hirobius/gallery",
    "exec",
    "playwright",
    "screenshot",
    ...(fullPage ? ["--full-page"] : []),
    `--viewport-size=${viewport.width},${viewport.height}`,
    url,
    out,
  ];
}

/** Output frame pattern for a clip: `<assets>/<clipbase>-frame-%03d.png`. */
export function frameOutputPattern(clip: string, assetsDir: string): string {
  const base = basename(clip, extname(clip));
  return resolve(assetsDir, `${base}-frame-%03d.png`);
}

/** Argv for `ffmpeg`: sample `fps` frames per second from `clip`. */
export function buildFfmpegArgs(clip: string, assetsDir: string, fps: number): string[] {
  return ["-i", clip, "-vf", `fps=${fps}`, frameOutputPattern(clip, assetsDir)];
}

function assertInside(dir: string, file: string): void {
  if (!file.startsWith(dir + sep)) throw new Error(`Refusing to write ${file}: outside ${dir}`);
}

function explainFailure(
  tool: "pnpm" | "ffmpeg",
  what: string,
  result: ReturnType<SpawnSyncLike>,
): string {
  if (result.error?.code === "ENOENT") {
    return tool === "ffmpeg"
      ? `ffmpeg not found on PATH. Install ffmpeg (e.g. apt-get install ffmpeg / brew install ffmpeg), ` +
          `or run this inside the ${PLAYWRIGHT_CONTAINER} container.`
      : `pnpm not found on PATH. Install pnpm (corepack enable), then re-run.`;
  }
  const stderr = (result.stderr ?? "").trim();
  if (tool === "pnpm" && /Executable doesn't exist|playwright install/i.test(stderr)) {
    return `Chromium is not installed for the gallery's Playwright. Run:\n    ${INSTALL_CHROMIUM}\n` +
      `(or run this inside the ${PLAYWRIGHT_CONTAINER} container).`;
  }
  const detail = result.error ? result.error.message : `exit ${result.status}`;
  return `${what} failed (${detail}).${stderr ? `\n${stderr}` : ""}`;
}

/** `error` is set (and actionable) whenever `ok` is false; `written` lists what landed before any failure. */
export type CaptureResult = { ok: boolean; written: string[]; error?: string };

/** Runs one capture. Throws CaptureUsageError on a bad brief (before any spawn). */
export function runCapture(
  args: CaptureArgs,
  deps: { root: string; spawnSync?: SpawnSyncLike },
): CaptureResult {
  const spawnSync = deps.spawnSync ?? defaultSpawnSync;
  const { assetsDir } = resolveBriefDirs(deps.root, args.brief);
  mkdirSync(assetsDir, { recursive: true });
  const written: string[] = [];

  if (args.mode === "video") {
    const clip = resolve(deps.root, args.video);
    const argv = buildFfmpegArgs(clip, assetsDir, args.fps);
    assertInside(assetsDir, argv[argv.length - 1]);
    const r = spawnSync("ffmpeg", argv, { cwd: deps.root });
    if (r.error || r.status !== 0) {
      return { ok: false, written, error: explainFailure("ffmpeg", `ffmpeg on ${clip}`, r) };
    }
    written.push(frameOutputPattern(clip, assetsDir));
    return { ok: true, written };
  }

  for (const [i, url] of args.urls.entries()) {
    const { desktop, mobile } = linkOutputPaths(assetsDir, url, i + 1);
    for (const [out, viewport] of [
      [desktop, DESKTOP_VIEWPORT],
      [mobile, MOBILE_VIEWPORT],
    ] as const) {
      assertInside(assetsDir, out);
      const r = spawnSync("pnpm", buildPlaywrightArgs(url, out, viewport, args.fullPage), { cwd: deps.root });
      if (r.error || r.status !== 0) {
        return { ok: false, written, error: explainFailure("pnpm", `Screenshot of ${url}`, r) };
      }
      written.push(out);
    }
  }
  return { ok: true, written };
}

function isMain(): boolean {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(resolve(entry)).href;
}

if (isMain()) {
  try {
    const result = runCapture(parseCaptureArgs(process.argv.slice(2)), { root: ROOT });
    for (const f of result.written) console.log(`wrote ${f.replace(ROOT + sep, "")}`);
    if (!result.ok) {
      console.error(`\n✖ ${result.error}\n`);
      process.exit(1);
    }
  } catch (err) {
    if (err instanceof CaptureUsageError) {
      console.error(`\n✖ ${err.message}\n`);
      process.exit(2);
    }
    throw err;
  }
}
