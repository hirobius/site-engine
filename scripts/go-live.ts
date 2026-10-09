#!/usr/bin/env tsx
/**
 * go-live — orchestrate flipping apps/<slug> from preview to production.
 *
 *   pnpm go-live <slug>          # armed build -> print the Vercel steps
 *   pnpm go-live <slug> --yes    # armed build -> execute the Vercel steps -> verify
 *
 * Launch day used to be a hand-run ritual: flip SITE_LIVE in the Vercel
 * dashboard, redeploy, hope. This runs the ARMED acceptance build locally
 * first (SITE_LIVE=true — see build-gate.ts) so placeholder intake data fails
 * HERE, never touching Vercel, then drives the flip and checks the result
 * with verify-live.
 */
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { verifyLive } from "./verify-live.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function die(msg: string): never {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

export interface SpawnResult {
  status: number | null;
}

export type SpawnFn = (cmd: string, args: string[], opts: Record<string, unknown>) => SpawnResult;

const defaultSpawn: SpawnFn = (cmd, args, opts) => spawnSync(cmd, args, { encoding: "utf8", ...opts });

/**
 * Runs `astro build` for `slug` with SITE_LIVE=true — the same env the real
 * production build sees — so armAcceptanceGate's realData checks
 * (checkClientAcceptance) reject placeholder intake data before anything
 * touches Vercel.
 */
export function runArmedBuild(slug: string, spawnImpl: SpawnFn = defaultSpawn): boolean {
  const res = spawnImpl("pnpm", ["--filter", `@hirobius/${slug}`, "build"], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, SITE_LIVE: "true" },
  });
  return res.status === 0;
}

/**
 * The shipping-and-launch gate: before any site is set live, the
 * `shipping-and-launch` skill (.claude/skills/shipping-and-launch/SKILL.md) must
 * have been run and its result recorded in docs/launches/<slug>.md as a line
 * `Shipping-Checklist: PASS - <one line: what was reviewed>`.
 */
export function checkLaunchRecord(slug: string, root: string = ROOT): { ok: boolean; message: string } {
  const rel = `docs/launches/${slug}.md`;
  const file = resolve(root, rel);
  const text = existsSync(file) ? readFileSync(file, "utf8") : "";
  const m = text.match(/^\s*Shipping-Checklist:\s*PASS\b[\s:—–-]*(\S.*)$/im);
  if (m) return { ok: true, message: `Shipping-Checklist: PASS - ${m[1].trim()}` };
  return {
    ok: false,
    message:
      `No passing launch record for ${slug}. Run the \`shipping-and-launch\` skill ` +
      `(.claude/skills/shipping-and-launch/SKILL.md) and record the result in ${rel} as a line: ` +
      "`Shipping-Checklist: PASS - <one line: what was reviewed>` (see docs/PIPELINE-RUNBOOK.md, step 8).",
  };
}

/** Reads `seo.siteUrl` out of apps/<slug>/client.config.ts — the real production URL. */
export async function readSiteUrl(slug: string): Promise<string> {
  const cfgPath = resolve(ROOT, "apps", slug, "client.config.ts");
  const mod = (await import(pathToFileURL(cfgPath).href)) as { client: { seo: { siteUrl: string } } };
  return mod.client.seo.siteUrl;
}

function isMain(): boolean {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(resolve(entry)).href;
}

if (isMain()) {
  const argv = process.argv.slice(2);
  const yes = argv.includes("--yes");
  const slug = argv.find((a) => !a.startsWith("--"));

  if (!slug) die("Usage: pnpm go-live <slug> [--yes]");
  if (!existsSync(resolve(ROOT, "apps", slug))) die(`apps/${slug} does not exist.`);

  const appRel = `apps/${slug}`;

  const launch = checkLaunchRecord(slug);
  if (!launch.ok) die(launch.message);
  console.log(`✓ ${launch.message}\n`);

  console.log(`→ Running the armed acceptance build (SITE_LIVE=true) for ${appRel}...`);
  if (!runArmedBuild(slug)) {
    die(
      `Armed build failed — checkClientAcceptance rejected ${appRel}'s config. ` +
        "Fix the flagged placeholders (see the build output above) before going live.",
    );
  }
  console.log(`✓ Armed build passed — ${appRel} has no placeholder intake data.\n`);

  if (yes) {
    console.log("→ Setting SITE_LIVE=true in the Vercel production env...");
    spawnSync("vercel", ["env", "add", "SITE_LIVE", "production", "--cwd", appRel], {
      cwd: ROOT,
      stdio: ["pipe", "inherit", "inherit"],
      input: "true\n",
    });

    console.log("→ Deploying to production...");
    const deploy = spawnSync("vercel", ["deploy", "--prod", "--cwd", appRel], { cwd: ROOT, stdio: "inherit" });
    if (deploy.status !== 0) die("vercel deploy --prod failed — see output above.");

    const siteUrl = await readSiteUrl(slug);
    console.log(`\n→ Verifying the live deploy at ${siteUrl}...`);
    const results = await verifyLive(siteUrl);
    for (const r of results) console.log(`${r.pass ? "✓" : "✖"} ${r.name} — ${r.detail}`);
    if (results.some((r) => !r.pass)) die("verify-live found issues on the production deploy (see above).");
    console.log("\n✓ Live deploy verified.");
  } else {
    const siteUrl = await readSiteUrl(slug).catch(() => `https://${slug}.example`);
    console.log(`
Armed build passed locally. Run these to go live (or re-run with --yes to execute them):

  echo "true" | vercel env add SITE_LIVE production --cwd ${appRel}
  vercel deploy --prod --cwd ${appRel}

Then verify the live deploy:

  pnpm verify-live ${siteUrl}
`);
  }
}
