#!/usr/bin/env tsx
/**
 * new-client — spin up a new client app from apps/_template (or, with
 * --bespoke, from apps/_bespoke-template — se#210).
 *
 *   pnpm new-client <slug> [--name "Business Name"] [--preset <preset>]
 *   pnpm new-client <slug> --bespoke [--name "Business Name"]
 *
 * Copies the template app -> apps/<slug>, stubs the config, and prints the
 * exact Vercel CLI commands to create the project, set env vars, and wire the
 * domain. Per-client Vercel setup is the #1 source of dashboard toil at scale,
 * so it is scripted, not clicked.
 *
 * `--bespoke` scaffolds the BESPOKE tier (a different price tier — CLAUDE.md
 * "the one rule that matters"): copy source is `apps/_bespoke-template`, and
 * on top of `client.config.ts` the scaffold also stubs `site-spec.ts` (slug +
 * a wordmark split from --name). It is mutually exclusive with --preset — the
 * bespoke tier has no ClientConfig-driven palette; see docs/PIPELINE-RUNBOOK.md
 * step 3 for the config-only path this replaces.
 */
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PALETTE_PRESET_IDS, type PalettePresetId } from "../packages/schema/src/presets.js";
import { generateFaviconSvg } from "./favicon.js";
import { insertFleetEntry, readTemplateVersion } from "./fleet-register.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv: string[]) {
  const positionals: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      // Boolean flags (e.g. --bespoke) take no value: don't swallow the next
      // `--flag` (or run off the end of argv) as this flag's value.
      if (next === undefined || next.startsWith("--")) {
        flags[key] = "true";
      } else {
        flags[key] = next;
        i++;
      }
    } else {
      positionals.push(arg);
    }
  }
  return { positionals, flags };
}

/** Split a business name into a wordmark { lead, accent } pair for the
 * bespoke tier's site-spec.ts (se#210). "PNW Arborist" -> lead "PNW", accent
 * "Arborist". A single-word name has nothing to accent, so both halves fall
 * back to the whole name (the schema requires both non-empty). */
function splitWordmark(name: string): { lead: string; accent: string } {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const lead = words[0] ?? name;
  const accent = words.slice(1).join(" ") || lead;
  return { lead, accent };
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
      "   or: pnpm new-client <slug> --bespoke [--name \"Business Name\"]\n" +
      `  presets: ${PALETTE_PRESET_IDS.join(", ")}`,
  );
}
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  die(`Slug "${slug}" must be kebab-case (e.g. pressure-pros).`);
}

const bespoke = flags.bespoke !== undefined;
if (bespoke && flags.preset !== undefined) {
  die(
    "--bespoke and --preset are mutually exclusive: the bespoke tier is a " +
      "different price tier with no ClientConfig-driven palette (CLAUDE.md " +
      '"the one rule that matters"). Drop --bespoke for the config-only path.',
  );
}

const preset = flags.preset ?? "pressure-washing";
if (!PALETTE_PRESET_IDS.includes(preset as (typeof PALETTE_PRESET_IDS)[number])) {
  die(`Unknown preset "${preset}". One of: ${PALETTE_PRESET_IDS.join(", ")}`);
}
const name = flags.name ?? "New Client";

const src = resolve(ROOT, bespoke ? "apps/_bespoke-template" : "apps/_template");
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
  .replace(/name:\s*"(?:Acme Service Co\.|Bespoke Template Co)"/, `name: ${JSON.stringify(name)}`)
  .replace(/palettePreset:\s*"[^"]*"/, `palettePreset: "${preset}"`)
  .replace(/siteUrl:\s*"https:\/\/(?:example\.com|bespoke-template\.example)"/, `siteUrl: "https://${slug}.example"`);
writeFileSync(cfgPath, cfg);

// 2b) Bespoke tier only: stub site-spec.ts (slug + a wordmark split from
// --name). The `<slug>-display`/`<slug>-body` preview-font localStorage keys
// (src/pages/{index,v2}.astro) derive from `spec.slug` at runtime — no
// separate write needed once slug is set here.
if (bespoke) {
  const specPath = resolve(dest, "site-spec.ts");
  const { lead, accent } = splitWordmark(name);
  let spec = readFileSync(specPath, "utf8");
  spec = spec
    .replace(/slug:\s*"[^"]*"/, `slug: "${slug}"`)
    .replace(/client:\s*"[^"]*"/, `client: ${JSON.stringify(name)}`)
    .replace(
      /wordmark:\s*\{\s*lead:\s*"[^"]*",\s*accent:\s*"[^"]*",?\s*\}/,
      `wordmark: { lead: ${JSON.stringify(lead)}, accent: ${JSON.stringify(accent)} }`,
    );
  writeFileSync(specPath, spec);
}

// 3) Brand-colored monogram favicon (business initial on the preset primary),
// overwriting _template's generic stub. A real logo overwrites this later.
writeFileSync(
  resolve(dest, "public/favicon.svg"),
  generateFaviconSvg(name, preset as PalettePresetId),
);

const projectName = `hirobius-${slug}`;

// 4) Register the new site in the _gallery fleet list (issue #12) — a
// template-change is a fleet event, so every scaffolded app records the
// @hirobius/template version it started on. Idempotent: skipped if the slug
// is already there (e.g. a re-run after a partial scaffold).
const fleetPath = resolve(ROOT, "apps/_gallery/src/data/fleet.ts");
const templateVersion = readTemplateVersion();
const { source: nextFleetSource, inserted } = insertFleetEntry(readFileSync(fleetPath, "utf8"), {
  slug,
  name,
  trade: preset,
  url: `https://${slug}.example`,
  status: "preview",
  templateVersion,
});
if (inserted) {
  writeFileSync(fleetPath, nextFleetSource);
}

console.log(`
✓ Created apps/${slug}
${inserted ? `✓ Registered in apps/_gallery fleet list (template v${templateVersion})` : `• apps/_gallery fleet list already has "${slug}" — left untouched`}

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
  - Launch with: pnpm go-live ${slug}
    Runs that armed build locally, prints (or with --yes executes) the Vercel
    SITE_LIVE flip + prod deploy, then verifies the live result with
    pnpm verify-live.

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

  # Optional: one-click prospect link for cold outreach — https://<preview>/?key=<token>
  # sets a cookie so the link works with no Basic auth prompt. Still noindex'd,
  # still dies the moment SITE_LIVE flips (see README → Preview gating).
  vercel env add PREVIEW_TOKEN preview --cwd apps/${slug}

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
