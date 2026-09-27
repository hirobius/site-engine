import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildFfmpegArgs,
  buildPlaywrightArgs,
  linkOutputPaths,
  parseCaptureArgs,
  resolveBriefDirs,
  runCapture,
  type SpawnSyncLike,
} from "./inspiration-capture.js";

/**
 * Coverage for `pnpm inspiration:capture` (epic #173, slice S3) — the
 * design-time extraction helper that drops a reference-link screenshot or
 * sampled video frames into `docs/inspiration/<brief>/assets/`. Real
 * Playwright/ffmpeg runs are never spawned here; every seam takes an injected
 * `SpawnSyncLike`, so these tests pin the exact argv and the fail-loud
 * messages without a browser or ffmpeg on the box.
 */

describe("parseCaptureArgs", () => {
  it("parses a link capture with repeated --url and --full-page", () => {
    expect(
      parseCaptureArgs(["calm-coastal", "--url", "https://a.example/x", "--url", "https://b.example", "--full-page"]),
    ).toEqual({
      mode: "link",
      brief: "calm-coastal",
      urls: ["https://a.example/x", "https://b.example"],
      fullPage: true,
    });
  });

  it("defaults --full-page to false", () => {
    expect(parseCaptureArgs(["calm-coastal", "--url", "https://a.example"])).toMatchObject({ fullPage: false });
  });

  it("parses a video capture with the default fps of 1", () => {
    expect(parseCaptureArgs(["calm-coastal", "--video", "docs/inspiration/calm-coastal/assets/clip.mp4"])).toEqual({
      mode: "video",
      brief: "calm-coastal",
      video: "docs/inspiration/calm-coastal/assets/clip.mp4",
      fps: 1,
    });
  });

  it("accepts a custom --fps, including fractional", () => {
    expect(parseCaptureArgs(["b", "--video", "c.mp4", "--fps", "0.5"])).toMatchObject({ fps: 0.5 });
  });

  it.each([
    [[], /brief/i],
    [["--url", "https://a.example"], /brief/i],
    [["calm"], /--url or --video/],
    [["calm", "--url"], /--url needs a value/],
    [["calm", "--url", "ftp://a.example"], /http/],
    [["calm", "--url", "not a url"], /http/],
    [["calm", "--video", "c.mp4", "--url", "https://a.example"], /not both/],
    [["calm", "--video", "c.mp4", "--fps", "0"], /--fps/],
    [["calm", "--video", "c.mp4", "--fps", "abc"], /--fps/],
    [["calm", "--url", "https://a.example", "--fps", "2"], /--fps only applies to --video/],
    [["calm", "--url", "https://a.example", "--bogus"], /Unknown option --bogus/],
  ])("rejects %j", (argv, message) => {
    expect(() => parseCaptureArgs(argv as string[])).toThrow(message);
  });
});

describe("resolveBriefDirs", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "insp-capture-"));
    mkdirSync(join(root, "docs/inspiration/calm-coastal"), { recursive: true });
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("returns the brief and assets dirs for an existing kebab-case brief", () => {
    expect(resolveBriefDirs(root, "calm-coastal")).toEqual({
      briefDir: resolve(root, "docs/inspiration/calm-coastal"),
      assetsDir: resolve(root, "docs/inspiration/calm-coastal/assets"),
    });
  });

  it.each(["Calm-Coastal", "_template", "../escape", "calm_coastal", "calm--coastal", "-calm", "a/b"])(
    "rejects non-kebab-case slug %j",
    (slug) => {
      expect(() => resolveBriefDirs(root, slug)).toThrow(/kebab-case/);
    },
  );

  it("fails loud when the brief dir does not exist, naming how to start one", () => {
    expect(() => resolveBriefDirs(root, "no-such-brief")).toThrow(
      /docs\/inspiration\/no-such-brief\/ doesn't exist[\s\S]*_template\/BRIEF\.md/,
    );
  });
});

describe("linkOutputPaths", () => {
  const assets = "/r/docs/inspiration/b/assets";

  it("names desktop + mobile PNGs deterministically from host and 1-based index", () => {
    expect(linkOutputPaths(assets, "https://www.Example.com/pricing?x=1", 2)).toEqual({
      desktop: "/r/docs/inspiration/b/assets/link-www.example.com-2.png",
      mobile: "/r/docs/inspiration/b/assets/link-www.example.com-2-mobile.png",
    });
  });

  it("sanitizes a port out of the filename", () => {
    expect(linkOutputPaths(assets, "http://localhost:4321/", 1).desktop).toBe(
      "/r/docs/inspiration/b/assets/link-localhost-4321-1.png",
    );
  });
});

describe("buildPlaywrightArgs", () => {
  it("builds the exact gallery-scoped playwright screenshot argv", () => {
    expect(buildPlaywrightArgs("https://a.example", "/abs/out.png", { width: 1440, height: 900 }, false)).toEqual([
      "--filter",
      "@hirobius/gallery",
      "exec",
      "playwright",
      "screenshot",
      "--viewport-size=1440,900",
      "https://a.example",
      "/abs/out.png",
    ]);
  });

  it("adds --full-page before the viewport flag when asked", () => {
    expect(buildPlaywrightArgs("https://a.example", "/abs/out.png", { width: 390, height: 844 }, true)).toEqual([
      "--filter",
      "@hirobius/gallery",
      "exec",
      "playwright",
      "screenshot",
      "--full-page",
      "--viewport-size=390,844",
      "https://a.example",
      "/abs/out.png",
    ]);
  });
});

describe("buildFfmpegArgs", () => {
  it("builds the exact ffmpeg frame-sampling argv, named after the clip", () => {
    expect(buildFfmpegArgs("/r/clips/hero clip.mp4", "/r/docs/inspiration/b/assets", 2)).toEqual([
      "-i",
      "/r/clips/hero clip.mp4",
      "-vf",
      "fps=2",
      "/r/docs/inspiration/b/assets/hero clip-frame-%03d.png",
    ]);
  });
});

describe("runCapture", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "insp-capture-"));
    mkdirSync(join(root, "docs/inspiration/calm-coastal"), { recursive: true });
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  type Call = { command: string; args: string[]; cwd: string };
  function recorder(result: ReturnType<SpawnSyncLike> = { status: 0 }): { calls: Call[]; spawn: SpawnSyncLike } {
    const calls: Call[] = [];
    return {
      calls,
      spawn: (command, args, options) => {
        calls.push({ command, args, cwd: options.cwd });
        return result;
      },
    };
  }

  it("captures desktop + mobile for every url, all inside the brief's assets dir", () => {
    const { calls, spawn } = recorder();
    const assets = resolve(root, "docs/inspiration/calm-coastal/assets");
    const result = runCapture(
      { mode: "link", brief: "calm-coastal", urls: ["https://a.example", "https://b.example/p"], fullPage: false },
      { root, spawnSync: spawn },
    );
    expect(result).toEqual({
      ok: true,
      written: [
        `${assets}/link-a.example-1.png`,
        `${assets}/link-a.example-1-mobile.png`,
        `${assets}/link-b.example-2.png`,
        `${assets}/link-b.example-2-mobile.png`,
      ],
    });
    expect(calls.map((c) => c.command)).toEqual(["pnpm", "pnpm", "pnpm", "pnpm"]);
    expect(calls.every((c) => c.cwd === root)).toBe(true);
    expect(calls[1].args).toContain("--viewport-size=390,844");
  });

  it("runs ffmpeg for a video capture and reports the frame pattern", () => {
    const { calls, spawn } = recorder();
    const assets = resolve(root, "docs/inspiration/calm-coastal/assets");
    const result = runCapture(
      { mode: "video", brief: "calm-coastal", video: "docs/inspiration/calm-coastal/assets/clip.mp4", fps: 1 },
      { root, spawnSync: spawn },
    );
    expect(result).toEqual({ ok: true, written: [`${assets}/clip-frame-%03d.png`] });
    expect(calls).toEqual([
      {
        command: "ffmpeg",
        args: ["-i", resolve(root, "docs/inspiration/calm-coastal/assets/clip.mp4"), "-vf", "fps=1", `${assets}/clip-frame-%03d.png`],
        cwd: root,
      },
    ]);
  });

  it("fails loud and actionable when ffmpeg is not installed (ENOENT)", () => {
    const enoent = Object.assign(new Error("spawnSync ffmpeg ENOENT"), { code: "ENOENT" });
    const { spawn } = recorder({ status: null, error: enoent });
    const result = runCapture(
      { mode: "video", brief: "calm-coastal", video: "clip.mp4", fps: 1 },
      { root, spawnSync: spawn },
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/ffmpeg not found/);
    expect(result.error).toMatch(/install ffmpeg/);
    expect(result.error).toMatch(/mcr\.microsoft\.com\/playwright:v1\.60\.0-noble/);
  });

  it("fails loud and actionable when Chromium is missing", () => {
    const { spawn } = recorder({
      status: 1,
      stderr: "browserType.launch: Executable doesn't exist at /x/chrome\nPlease run: npx playwright install",
    });
    const result = runCapture(
      { mode: "link", brief: "calm-coastal", urls: ["https://a.example"], fullPage: false },
      { root, spawnSync: spawn },
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/pnpm --filter @hirobius\/gallery exec playwright install chromium/);
  });

  it("fails loud when pnpm itself is missing (ENOENT)", () => {
    const enoent = Object.assign(new Error("spawnSync pnpm ENOENT"), { code: "ENOENT" });
    const { spawn } = recorder({ status: null, error: enoent });
    const result = runCapture(
      { mode: "link", brief: "calm-coastal", urls: ["https://a.example"], fullPage: false },
      { root, spawnSync: spawn },
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/pnpm not found/);
  });

  it("stops at the first failed screenshot and reports the url", () => {
    const { calls, spawn } = recorder({ status: 1, stderr: "net::ERR_NAME_NOT_RESOLVED" });
    const result = runCapture(
      { mode: "link", brief: "calm-coastal", urls: ["https://a.example", "https://b.example"], fullPage: false },
      { root, spawnSync: spawn },
    );
    expect(calls).toHaveLength(1);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/https:\/\/a\.example/);
    expect(result.error).toMatch(/ERR_NAME_NOT_RESOLVED/);
  });

  it("refuses a bad brief before spawning anything", () => {
    const { calls, spawn } = recorder();
    expect(() =>
      runCapture({ mode: "link", brief: "missing-brief", urls: ["https://a.example"], fullPage: false }, { root, spawnSync: spawn }),
    ).toThrow(/doesn't exist/);
    expect(calls).toHaveLength(0);
  });
});
