#!/usr/bin/env tsx
/**
 * new-client — spin up a new client app from apps/_template.
 *
 *   pnpm new-client <slug> [--name "Business Name"] [--preset <preset>]
 *
 * Copies apps/_template -> apps/<slug>, stubs the config, and prints the exact
 * Vercel CLI commands to create the project, set env vars, and wire the domain.
 * Per-client Vercel setup is the #1 source of dashboard toil at scale, so it is
 * scripted, not clicked.
 */
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PALETTE_PRESET_IDS } from "../packages/schema/src/presets.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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

function die(msg: string): never {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

const { positionals, flags } = parseArgs(process.argv.slice(2));
const slug = positionals[0];

if (!slug) {
  die(
    "Usage: pnpm new-client <slug> [--name \"Business Name\"] [--preset <preset>]\n" +
      `  presets: ${PALETTE_PRESET_IDS.join(", ")}`,
  );
}
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  die(`Slug "${slug}" must be kebab-case (e.g. pressure-pros).`);
}

const preset = flags.preset ?? "pressure-washing";
if (!PALETTE_PRESET_IDS.includes(preset as (typeof PALETTE_PRESET_IDS)[number])) {
  die(`Unknown preset "${preset}". One of: ${PALETTE_PRESET_IDS.join(", ")}`);
}
const name = flags.name ?? "New Client";

const src = resolve(ROOT, "apps/_template");
const dest = resolve(ROOT, "apps", slug);

if (existsSync(dest)) die(`apps/${slug} already exists.`);

// Copy the template app, skipping build/dep artifacts.
cpSync(src, dest, {
  recursive: true,
  filter: (from) =>
    !/(?:^|[/\\])(?:node_modules|dist|\.astro|\.turbo)(?:[/\\]|$)/.test(from),
});

// 1) package.json name
const pkgPath = resolve(dest, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.name = `@hirobius/${slug}`;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

// 2) Stub client.config.ts — set slug, name, preset, and a placeholder siteUrl.
const cfgPath = resolve(dest, "client.config.ts");
let cfg = readFileSync(cfgPath, "utf8");
cfg = cfg
  .replace(/slug:\s*"[^"]*"/, `slug: "${slug}"`)
  .replace(/name:\s*"Acme Service Co\."/, `name: ${JSON.stringify(name)}`)
  .replace(/palettePreset:\s*"[^"]*"/, `palettePreset: "${preset}"`)
  .replace(/siteUrl:\s*"https:\/\/example\.com"/, `siteUrl: "https://${slug}.example"`);
writeFileSync(cfgPath, cfg);

const projectName = `hirobius-${slug}`;

console.log(`
✓ Created apps/${slug}

Next:
  1. Edit apps/${slug}/client.config.ts (business details, copy, services, SEO).
  2. Drop optimized photos in apps/${slug}/src/assets/photos (1600px max, ~200KB).
     Verbatim assets (og.jpg, favicon) go in apps/${slug}/public.
  3. pnpm install && pnpm --filter @hirobius/${slug} build

Go-live checklist (before flipping this site public):
  - Replace every placeholder: phone, email, form.accessKey, siteUrl, ogImage.
  - Set form.hcaptchaSiteKey (required once real data is live).
  - Set SITE_LIVE=true (or deploy to the Vercel "production" env, which sets
    VERCEL_ENV=production automatically) — astro build then runs
    checkClientAcceptance with realData:true and FAILS the build if any
    placeholder survived. Preview builds stay unarmed on purpose.

──────────────────────────────────────────────────────────────────────────────
Vercel setup (run from repo root; one project per client):

  # Create + link the project, pointing the Root Directory at this app.
  vercel link --cwd apps/${slug} --project ${projectName} --yes

  # Make Vercel build only this app's slice of the monorepo:
  #   Project Settings → Build & Development → Root Directory = apps/${slug}
  #   Ignored Build Step (command) = npx turbo-ignore
  vercel project ls   # confirm "${projectName}" exists

  # Preview gate credentials (basic auth on non-production deploys):
  vercel env add PREVIEW_USER preview --cwd apps/${slug}
  vercel env add PREVIEW_PASS preview --cwd apps/${slug}

  # Production form/captcha secrets if you keep them in env (optional):
  #   vercel env add WEB3FORMS_KEY production --cwd apps/${slug}

  # First deploy (preview), then promote:
  vercel deploy --cwd apps/${slug}
  vercel deploy --prod --cwd apps/${slug}

  # Custom domain:
  vercel domains add <clientdomain.com> ${projectName}
  vercel alias set <deployment-url> <clientdomain.com>
──────────────────────────────────────────────────────────────────────────────
`);
