/**
 * resolveChromiumExecutable — resolve a pre-installed Chromium for Playwright
 * in the remote execution sandbox (BS1b, mirrors ops BS1a).
 *
 * The sandbox ships Chromium under `PLAYWRIGHT_BROWSERS_PATH` (default
 * `/opt/pw-browsers`) behind a maintained, version-stable `chromium` symlink,
 * but Playwright's default resolution wants a build-numbered path
 * (`chromium_headless_shell-<build>`) that drifts from the installed build — so
 * without this, every session hand-symlinks binaries just to run the app smoke
 * suites. Passing `executablePath` = the stable symlink sidesteps the drift.
 *
 * Returns the executable path when a pre-installed browser is present, or
 * `undefined` so Playwright falls back to its normal resolution — CI and local
 * dev, where Playwright manages its own browsers, are left untouched.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

export interface ResolveOptions {
  env?: NodeJS.ProcessEnv;
  exists?: (p: string) => boolean;
}

export function resolveChromiumExecutable({
  env = process.env,
  exists = existsSync,
}: ResolveOptions = {}): string | undefined {
  // Operator escape hatch — an explicit path always wins when it exists.
  const explicit = env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  if (explicit && exists(explicit)) return explicit;

  // The sandbox's maintained, version-stable symlink (prefer the env-declared
  // browsers path, fall back to the documented default location).
  const candidates: string[] = [];
  if (env.PLAYWRIGHT_BROWSERS_PATH) {
    candidates.push(join(env.PLAYWRIGHT_BROWSERS_PATH, "chromium"));
  }
  candidates.push("/opt/pw-browsers/chromium");

  for (const candidate of candidates) {
    if (exists(candidate)) return candidate;
  }
  return undefined;
}
