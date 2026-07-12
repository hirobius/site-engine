#!/usr/bin/env tsx
/**
 * render-site — write a client app's client.config.ts from a lead's mapped
 * ClientConfig JSON.
 *
 *   pnpm render-site <slug> --config <path-to-config.json>
 *
 * Second half of scaffolding a site from an ops lead (issue #121): `new-client`
 * lays down the stub app; this overwrites its client.config.ts with the exact
 * config the ops board computed via `leadToConfig()` (issue #122) and
 * re-validates it through `defineClient()` so a malformed dispatch payload
 * fails HERE — before the build step — with a clear Zod error, not a cryptic
 * astro build crash.
 *
 * Used by `.github/workflows/render-site.yml`, which writes the dispatch
 * payload's `config` to a temp JSON file and calls this script.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { defineClient, type ClientConfig, type ClientConfigDraft } from "../packages/schema/src/index.js";
import { checkClientAcceptance } from "../packages/template/src/acceptance.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function die(msg: string): never {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

/** `checkClientAcceptance`'s realData issue codes that specifically mean
 *  "this field is still an intake-stage placeholder" — as opposed to
 *  "this field is merely absent" (missing-og-image, missing-hcaptcha-key),
 *  which says nothing about whether the site has already gone live. */
const PLACEHOLDER_ISSUE_CODES = new Set([
  "placeholder-email",
  "placeholder-site-url",
  "placeholder-phone",
  "placeholder-form-key",
  "placeholder-name",
]);

/**
 * True when `config` carries none of the fleet's intake-stage placeholders
 * (see `apps/_template`'s stub / `leadToConfig`'s fallbacks) — i.e. someone
 * has already taken this client live with real business data.
 */
function looksLive(config: ClientConfig): boolean {
  const issues = checkClientAcceptance(config, { realData: true });
  return !issues.some((issue) => PLACEHOLDER_ISSUE_CODES.has(issue.code));
}

/** Slices out the argument source between `defineClient(`'s matching parens. */
function extractDefineClientArg(src: string): string | null {
  const marker = "defineClient(";
  const start = src.indexOf(marker);
  if (start === -1) return null;
  const openParenIdx = start + marker.length - 1;
  let depth = 0;
  for (let i = openParenIdx; i < src.length; i++) {
    if (src[i] === "(") depth++;
    else if (src[i] === ")") {
      depth--;
      if (depth === 0) return src.slice(openParenIdx + 1, i);
    }
  }
  return null;
}

/**
 * Reads an existing `apps/<slug>/client.config.ts` and returns its validated
 * config, or `null` if it can't be read/parsed/validated. Deliberately avoids
 * `import()`-ing the file: right after `new-client` scaffolds a brand-new
 * `apps/<slug>`, pnpm hasn't relinked that package's `node_modules` yet, so a
 * bare `@hirobius/schema` import from inside it fails even though the file is
 * perfectly readable. Evaluating the `defineClient({...})` object literal as
 * plain source and validating it with the *script's own* `defineClient` sidesteps
 * that — this also handles hand-written config files (comments, unquoted keys),
 * not just the JSON this script itself emits.
 */
function readExistingConfig(cfgPath: string): ClientConfig | null {
  let src: string;
  try {
    src = readFileSync(cfgPath, "utf8");
  } catch {
    return null;
  }
  const argSrc = extractDefineClientArg(src);
  if (!argSrc) return null;
  let raw: unknown;
  try {
    // Evaluates a JS object-literal expression, not an ES module — no
    // `import` resolution involved, so this works before `pnpm install`
    // has linked a freshly-scaffolded app's node_modules.
    raw = new Function(`return (${argSrc});`)();
  } catch {
    return null;
  }
  try {
    return defineClient(raw as ClientConfigDraft);
  } catch {
    return null;
  }
}

function parseArgs(argv: string[]) {
  const positionals: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg.startsWith("--")) {
      flags[arg.slice(2)] = argv[++i] ?? "";
    } else {
      positionals.push(arg);
    }
  }
  return { positionals, flags };
}

/** Renders a `client.config.ts` source string wrapping an already-validated config. */
export function renderConfigFile(config: unknown): string {
  return `import { defineClient } from "@hirobius/schema";\n\nexport const client = defineClient(${JSON.stringify(
    config,
    null,
    2,
  )});\n`;
}

/**
 * Parses + validates a lead-mapped config and writes it into `apps/<slug>/client.config.ts`.
 * Throws (never fabricates a fallback) on invalid JSON or a config `defineClient()` rejects.
 *
 * Refuses to overwrite an existing `client.config.ts` that already looks live
 * (no intake placeholders left — see `looksLive`) unless `force` is set. A
 * slug collision or an accidental re-dispatch would otherwise silently
 * clobber a live client's production config with another business's data —
 * the same class of mistake `new-client`'s `existsSync(dest)` guard prevents
 * for the app directory itself.
 */
export function writeClientConfig(appDir: string, configJson: string, options: { force?: boolean } = {}): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(configJson);
  } catch (err) {
    throw new Error(`config is not valid JSON: ${(err as Error).message}`);
  }
  // Fail fast on a malformed dispatch payload — the same guard the build's
  // `astro build -> defineClient()` runs, just surfaced before scaffolding.
  const validated = defineClient(parsed as ClientConfigDraft);

  const cfgPath = resolve(appDir, "client.config.ts");
  if (existsSync(cfgPath) && !options.force) {
    const existing = readExistingConfig(cfgPath);
    if (existing === null) {
      throw new Error(
        `could not verify the existing ${cfgPath} is safe to overwrite. Pass --force to overwrite anyway.`,
      );
    }
    if (looksLive(existing)) {
      throw new Error(
        `${cfgPath} already has real business data (no intake placeholders left) — refusing to overwrite it. ` +
          "Pass --force if this overwrite is intentional.",
      );
    }
  }

  writeFileSync(cfgPath, renderConfigFile(validated));
}

function isMain(): boolean {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(resolve(entry)).href;
}

if (isMain()) {
  const rawArgv = process.argv.slice(2);
  const force = rawArgv.includes("--force");
  const { positionals, flags } = parseArgs(rawArgv.filter((a) => a !== "--force"));
  const slug = positionals[0];
  const configPath = flags.config;

  if (!slug || !configPath) {
    die("Usage: pnpm render-site <slug> --config <path-to-config.json> [--force]");
  }

  const appDir = resolve(ROOT, "apps", slug);
  if (!existsSync(appDir)) {
    die(`apps/${slug} does not exist — run "pnpm new-client ${slug}" first.`);
  }

  const configJson = readFileSync(resolve(configPath), "utf8");
  try {
    writeClientConfig(appDir, configJson, { force });
  } catch (err) {
    die((err as Error).message);
  }

  console.log(`✓ Wrote apps/${slug}/client.config.ts`);
}
