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
import { defineClient, type ClientConfigDraft } from "../packages/schema/src/index.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function die(msg: string): never {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
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
 */
export function writeClientConfig(appDir: string, configJson: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(configJson);
  } catch (err) {
    throw new Error(`config is not valid JSON: ${(err as Error).message}`);
  }
  // Fail fast on a malformed dispatch payload — the same guard the build's
  // `astro build -> defineClient()` runs, just surfaced before scaffolding.
  const validated = defineClient(parsed as ClientConfigDraft);
  writeFileSync(resolve(appDir, "client.config.ts"), renderConfigFile(validated));
}

function isMain(): boolean {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(resolve(entry)).href;
}

if (isMain()) {
  const { positionals, flags } = parseArgs(process.argv.slice(2));
  const slug = positionals[0];
  const configPath = flags.config;

  if (!slug || !configPath) {
    die("Usage: pnpm render-site <slug> --config <path-to-config.json>");
  }

  const appDir = resolve(ROOT, "apps", slug);
  if (!existsSync(appDir)) {
    die(`apps/${slug} does not exist — run "pnpm new-client ${slug}" first.`);
  }

  const configJson = readFileSync(resolve(configPath), "utf8");
  try {
    writeClientConfig(appDir, configJson);
  } catch (err) {
    die((err as Error).message);
  }

  console.log(`✓ Wrote apps/${slug}/client.config.ts`);
}
