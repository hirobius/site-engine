#!/usr/bin/env tsx
/**
 * deploy-preview — one command for a gated Vercel preview link (issue #154).
 *
 *   pnpm deploy-preview <slug>
 *
 * Automates the cold-outreach preview sequence that had been run by hand
 * ~15x in one session:
 *
 *   1. `pnpm eject-client <slug>`               -> ejected/<slug>, a standalone build
 *   2. `vercel link`                              -> link ejected/<slug> to its Vercel project
 *   3. set `PREVIEW_TOKEN` (+ `PREVIEW_USER`/      -> the `?key=` gate secret middleware.ts reads,
 *      `PREVIEW_PASS`) in BOTH the preview and         plus Basic-auth creds so the *no-key* path
 *      production scopes                               fails closed with 401, not a bare 503 —
 *                                                       a fresh project's first deploy is classed
 *                                                       production (issues #188, #222)
 *   4. disable Vercel Deployment Protection       -> Vercel's own SSO gate 401s the keyed
 *      ("Vercel Authentication")                     link before middleware.ts ever runs
 *   5. `vercel deploy --target=preview`           -> NEVER --prod: a first deploy to a fresh
 *                                                     project lands on production otherwise,
 *                                                     which arms the acceptance/placeholder
 *                                                     gate and blocks the deploy (issue #154)
 *   6. verify the gate for real (fetch with/without the key), then print
 *      `https://<deployment>.vercel.app/?key=<token>`
 *
 * Idempotent: re-running for the same slug re-ejects (eject-client itself is
 * idempotent), re-links safely, reuses the previously generated PREVIEW_TOKEN
 * and PREVIEW_USER/PASS (persisted at `ejected/<slug>/.vercel/`, a dir
 * eject-client already gitignores) so the *secrets* stay stable, and re-sets
 * the envs without piling up side effects. NOTE: `vercel deploy` (unaliased,
 * not git-linked) mints a fresh hash-suffixed URL every run — the token in a
 * previously shared link keeps validating, but the *host* changes, so re-send
 * the freshly printed link after any re-run.
 *
 * Preview only: this script refuses to ever pass `--prod` to `vercel deploy`
 * (see `assertPreviewTarget`). Production go-live is the separate `pnpm
 * go-live` runbook (#152) — that is the only place `--prod` is allowed.
 *
 * Fails loud + actionable (ops working convention) when `VERCEL_TOKEN` is
 * missing, naming the var and the fix. Any dashboard step the API can't
 * script (Deployment Protection may reject the write depending on plan/scope)
 * prints a clickable deep link instead of failing silently. The gate is then
 * verified for real against the deployed URL (200 with the key, closed
 * without it) rather than just asked of the operator on faith.
 *
 * File-pattern note: issue #154 asked for `deploy-preview.mjs`. This repo's
 * script pattern is `.ts` + tsx + an `isMain()` CLI guard (see render-site.ts,
 * go-live.ts, and the precedent set by #176/#177) — using that instead, not
 * `.mjs`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function die(msg: string): never {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

export interface SpawnResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

export type SpawnFn = (cmd: string, args: string[], opts: Record<string, unknown>) => SpawnResult;

const defaultSpawn: SpawnFn = (cmd, args, opts) => {
  const res = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  return { status: res.status, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
};

export interface FsLike {
  existsSync: typeof existsSync;
  readFileSync: typeof readFileSync;
  writeFileSync: typeof writeFileSync;
  mkdirSync: typeof mkdirSync;
}

const defaultFs: FsLike = { existsSync, readFileSync, writeFileSync, mkdirSync };

/** Fleet project-naming convention — matches `new-client.ts`. */
export function projectName(slug: string): string {
  return `hirobius-${slug}`;
}

/** Where `eject-client <slug>` (default `--out`) lands. */
export function ejectedDir(slug: string): string {
  return resolve(ROOT, "ejected", slug);
}

/**
 * `VERCEL_TOKEN` drives non-interactive `vercel` CLI auth AND the Deployment
 * Protection REST call. Missing it must fail loud + actionable, never a bare
 * "command failed" once `vercel` itself rejects an empty token.
 */
export function requireVercelToken(env: NodeJS.ProcessEnv = process.env): string {
  const token = env.VERCEL_TOKEN;
  if (!token) {
    throw new Error(
      "VERCEL_TOKEN is not set. deploy-preview needs it for non-interactive `vercel` CLI auth " +
        "and the Deployment Protection API call.\n" +
        "  Fix: create one at https://vercel.com/account/tokens, then `export VERCEL_TOKEN=<token>` " +
        "(or add it to your shell profile) before re-running.",
    );
  }
  return token;
}

/** Path where this slug's generated `PREVIEW_TOKEN` is persisted across re-runs. */
export function tokenFilePath(dir: string): string {
  return resolve(dir, ".vercel", "preview-token.txt");
}

/**
 * Reuses a previously generated `PREVIEW_TOKEN` for this slug (the secret
 * itself must stay stable across re-runs), or generates and persists a fresh
 * one on first run. Persisted under `.vercel/`, which `eject-client` already
 * writes into the ejected repo's `.gitignore` — no new secret-bearing path
 * enters version control.
 */
export function ensurePreviewToken(dir: string, fs: FsLike = defaultFs): string {
  const path = tokenFilePath(dir);
  if (fs.existsSync(path)) {
    const existing = fs.readFileSync(path, "utf8").trim();
    if (existing) return existing;
  }
  const token = randomBytes(16).toString("hex");
  fs.mkdirSync(dirname(path), { recursive: true });
  fs.writeFileSync(path, token + "\n");
  return token;
}

/**
 * Every env scope a gate var must live in. A fresh Vercel project's FIRST
 * deploy is classed `production` even for a gated preview (issue #188), so a
 * var set only in `preview` is missing at runtime and middleware.ts fails
 * closed with a 503 even with the `?key=` (issue #222). Safe: this is a
 * dedicated preview project; go-live (`SITE_LIVE=true`) bypasses the gate.
 */
export const GATE_ENV_SCOPES = ["preview", "production"] as const;

/**
 * Idempotently sets env var `name` to `value` in every `GATE_ENV_SCOPES`
 * scope: removes any existing value first (failure ignored — it may simply
 * not exist yet), then adds the current value on stdin (never argv, so a
 * secret never shows up in a process list). Re-running always converges on
 * the same env state instead of erroring on "already exists" or drifting.
 * True only when every scope's add succeeded.
 */
export function setEnvInGateScopes(
  dir: string,
  name: string,
  value: string,
  vercelToken: string,
  spawnImpl: SpawnFn = defaultSpawn,
): boolean {
  let ok = true;
  for (const scope of GATE_ENV_SCOPES) {
    spawnImpl("vercel", ["env", "rm", name, scope, "--yes", "--cwd", dir, "--token", vercelToken], {});
    const res = spawnImpl("vercel", ["env", "add", name, scope, "--cwd", dir, "--token", vercelToken], {
      input: `${value}\n`,
    });
    ok = ok && res.status === 0;
  }
  return ok;
}

/** Sets the `PREVIEW_TOKEN` gate secret in both scopes (see `setEnvInGateScopes`). */
export function setPreviewTokenEnv(
  dir: string,
  token: string,
  vercelToken: string,
  spawnImpl: SpawnFn = defaultSpawn,
): boolean {
  return setEnvInGateScopes(dir, "PREVIEW_TOKEN", token, vercelToken, spawnImpl);
}

/**
 * Idempotently sets `PREVIEW_BUILD=true` so `armAcceptanceGate` treats this as a
 * gated preview and does NOT arm the go-live acceptance checks even when Vercel
 * labels the deploy `production` — a fresh project's FIRST deploy is
 * misclassified `VERCEL_ENV=production` even for a `?key=` gated preview
 * (issue #188), which otherwise blocks the intended placeholder intake data.
 * Set for BOTH `preview` and `production` scopes so whichever environment Vercel
 * runs the build in, the signal is present. Safe: this is a dedicated preview
 * project; real go-live uses `SITE_LIVE=true`, which always arms regardless.
 */
export function setPreviewBuildEnv(
  dir: string,
  vercelToken: string,
  spawnImpl: SpawnFn = defaultSpawn,
): boolean {
  return setEnvInGateScopes(dir, "PREVIEW_BUILD", "true", vercelToken, spawnImpl);
}

export interface BasicAuthCreds {
  user: string;
  pass: string;
}

/** Path where this slug's generated PREVIEW_USER/PASS are persisted across re-runs. */
export function basicAuthFilePath(dir: string): string {
  return resolve(dir, ".vercel", "preview-basic-auth.json");
}

/**
 * `middleware.ts` only 401s the no-key request when `PREVIEW_USER`/
 * `PREVIEW_PASS` are also set — otherwise it fails closed with a bare 503
 * ("Preview access is not configured"). Issue #154's DoD wants the gate
 * itself proven (401 without the key), so deploy-preview provisions Basic
 * auth creds too, not just the token. Reuses persisted creds across re-runs
 * for the same reason `ensurePreviewToken` does.
 */
export function ensureBasicAuthCreds(dir: string, fs: FsLike = defaultFs): BasicAuthCreds {
  const path = basicAuthFilePath(dir);
  if (fs.existsSync(path)) {
    const parsed = JSON.parse(fs.readFileSync(path, "utf8")) as Partial<BasicAuthCreds>;
    if (parsed.user && parsed.pass) return { user: parsed.user, pass: parsed.pass };
  }
  const creds: BasicAuthCreds = { user: "preview", pass: randomBytes(12).toString("hex") };
  fs.mkdirSync(dirname(path), { recursive: true });
  fs.writeFileSync(path, JSON.stringify(creds, null, 2) + "\n");
  return creds;
}

/** Sets PREVIEW_USER/PREVIEW_PASS in both scopes the same way as `setPreviewTokenEnv`. */
export function setBasicAuthEnv(
  dir: string,
  creds: BasicAuthCreds,
  vercelToken: string,
  spawnImpl: SpawnFn = defaultSpawn,
): boolean {
  const userOk = setEnvInGateScopes(dir, "PREVIEW_USER", creds.user, vercelToken, spawnImpl);
  const passOk = setEnvInGateScopes(dir, "PREVIEW_PASS", creds.pass, vercelToken, spawnImpl);
  return userOk && passOk;
}

export interface ProjectLink {
  projectId: string;
  orgId: string;
}

/** Path to the `.vercel/project.json` that `vercel link` writes. */
export function projectLinkPath(dir: string): string {
  return resolve(dir, ".vercel", "project.json");
}

/** Reads the `projectId`/`orgId` that `vercel link` writes to `.vercel/project.json`. */
export function readProjectLink(dir: string, fs: FsLike = defaultFs): ProjectLink {
  const path = projectLinkPath(dir);
  if (!fs.existsSync(path)) {
    throw new Error(`${path} not found — \`vercel link\` should have created it; re-run deploy-preview.`);
  }
  const data = JSON.parse(fs.readFileSync(path, "utf8")) as { projectId?: string; orgId?: string };
  if (!data.projectId || !data.orgId) {
    throw new Error(`${path} is missing projectId/orgId — re-run \`vercel link\`.`);
  }
  return { projectId: data.projectId, orgId: data.orgId };
}

export type FetchFn = typeof fetch;

export interface SsoDisableResult {
  ok: boolean;
  deepLink: string;
}

/**
 * Vercel's own "Deployment Protection -> Vercel Authentication" (project-level
 * SSO) 401s the `?key=` link before `middleware.ts` ever runs, independent of
 * our own gate. Tries the REST API first; some plans/scopes reject this write,
 * so on any failure this returns a clickable deep link for Adrian to flip it
 * by hand instead of failing the whole run (per ops working conventions: hand
 * over the exact destination, not a breadcrumb trail).
 */
export async function disableSsoProtection(
  link: ProjectLink,
  project: string,
  vercelToken: string,
  fetchImpl: FetchFn = fetch,
): Promise<SsoDisableResult> {
  const deepLink = `https://vercel.com/${link.orgId}/${project}/settings/deployment-protection`;
  try {
    const res = await fetchImpl(`https://api.vercel.com/v9/projects/${link.projectId}?teamId=${link.orgId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${vercelToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ssoProtection: null }),
    });
    return { ok: res.ok, deepLink };
  } catch {
    return { ok: false, deepLink };
  }
}

/**
 * Refuses any `vercel deploy` invocation that could land on production.
 * This is the load-bearing guard behind issue #154's DoD ("no production
 * deploy"): a first deploy to a fresh Vercel project lands on production by
 * default, which arms the acceptance/placeholder gate and blocks the deploy.
 * `pnpm go-live` (#152) is the only script allowed to pass `--prod`.
 */
export function assertPreviewTarget(args: string[]): void {
  if (args.includes("--prod") || args.includes("-p")) {
    throw new Error(
      "Refusing to run `vercel deploy` with --prod from deploy-preview — this script is preview-only " +
        "(issue #154). Use `pnpm go-live <slug> --yes` for a production deploy.",
    );
  }
  if (!args.includes("--target=preview")) {
    throw new Error("`vercel deploy` must be called with --target=preview — deploy-preview is preview-only.");
  }
}

/**
 * Pulls the deployment URL `vercel deploy` prints on its final stdout line.
 * Stops at whitespace or quote/bracket/paren chars so a URL that appears inside
 * JSON-ish output (e.g. `"...vercel.app",`) doesn't capture a trailing `",` and
 * produce an unresolvable hostname.
 */
export function extractDeployUrl(stdout: string): string {
  const match = stdout.match(/https:\/\/[^\s"'<>)\]]+\.vercel\.app[^\s"'<>)\]]*/);
  if (!match) {
    throw new Error(`Could not find a deployment URL in \`vercel deploy\` output:\n${stdout}`);
  }
  return match[0];
}

/** Runs the guarded preview deploy and returns the deployment URL. */
export function runPreviewDeploy(dir: string, vercelToken: string, spawnImpl: SpawnFn = defaultSpawn): string {
  const args = ["deploy", "--target=preview", "--cwd", dir, "--token", vercelToken];
  assertPreviewTarget(args);
  const res = spawnImpl("vercel", args, {});
  if (res.status !== 0) {
    throw new Error(`\`vercel deploy --target=preview\` failed:\n${res.stderr || res.stdout}`);
  }
  return extractDeployUrl(res.stdout);
}

/** Assembles the reachable gated link: the deployment URL + `?key=<token>`. */
export function buildPreviewUrl(deployUrl: string, token: string): string {
  const url = new URL(deployUrl);
  url.searchParams.set("key", token);
  return url.toString();
}

export interface GateCheckResult {
  pass: boolean;
  detail: string;
}

export interface GateCheck {
  withKey: GateCheckResult;
  withoutKey: GateCheckResult;
}

/**
 * Proves the DoD line "gate intact (401 without key, 200 with key)" against
 * the real deployed URL instead of just telling the operator to eyeball it:
 * fetches the keyed link (expect 200) and the same URL with the key stripped
 * (expect the gate to hold — not 200; middleware.ts returns 401 once Basic
 * auth creds are set, which `ensureBasicAuthCreds` + `setBasicAuthEnv` do).
 */
export async function verifyPreviewGate(previewUrl: string, fetchImpl: FetchFn = fetch): Promise<GateCheck> {
  const withKeyRes = await fetchImpl(previewUrl);
  const withKey: GateCheckResult = { pass: withKeyRes.status === 200, detail: `status ${withKeyRes.status}` };

  const bare = new URL(previewUrl);
  bare.searchParams.delete("key");
  const withoutKeyRes = await fetchImpl(bare.toString());
  const withoutKey: GateCheckResult = {
    pass: withoutKeyRes.status !== 200,
    detail: `status ${withoutKeyRes.status}`,
  };

  return { withKey, withoutKey };
}

function isMain(): boolean {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(resolve(entry)).href;
}

if (isMain()) {
  const argv = process.argv.slice(2);
  const slug = argv.find((a) => !a.startsWith("--"));

  if (!slug) die("Usage: pnpm deploy-preview <slug>");
  if (!existsSync(resolve(ROOT, "apps", slug))) {
    die(`apps/${slug} does not exist. Scaffold it first with \`pnpm new-client ${slug} ...\`.`);
  }

  let vercelToken: string;
  try {
    vercelToken = requireVercelToken();
  } catch (err) {
    die((err as Error).message);
  }

  const project = projectName(slug);
  const outDir = ejectedDir(slug);

  console.log(`→ Ejecting apps/${slug} -> ${outDir} (standalone build)...`);
  const ejectRes = spawnSync("pnpm", ["eject-client", slug], { cwd: ROOT, stdio: "inherit" });
  if (ejectRes.status !== 0) die(`\`pnpm eject-client ${slug}\` failed — see output above.`);

  console.log(`\n→ Linking ${outDir} to Vercel project "${project}"...`);
  const linkRes = spawnSync(
    "vercel",
    ["link", "--cwd", outDir, "--project", project, "--yes", "--token", vercelToken],
    { stdio: "inherit" },
  );
  if (linkRes.status !== 0) {
    die(`\`vercel link\` failed — see output above. Confirm VERCEL_TOKEN has access to "${project}".`);
  }

  const token = ensurePreviewToken(outDir);
  console.log(`\n→ Setting PREVIEW_TOKEN (preview + production env — issue #222)...`);
  if (!setPreviewTokenEnv(outDir, token, vercelToken)) {
    die("`vercel env add PREVIEW_TOKEN` failed — see output above.");
  }

  const basicAuth = ensureBasicAuthCreds(outDir);
  console.log(`→ Setting PREVIEW_USER/PREVIEW_PASS (preview + production env, so the no-key path fails closed with 401)...`);
  if (!setBasicAuthEnv(outDir, basicAuth, vercelToken)) {
    die("`vercel env add PREVIEW_USER/PREVIEW_PASS` failed — see output above.");
  }

  console.log(`→ Setting PREVIEW_BUILD=true (keeps the gated preview from arming the go-live gate — issue #188)...`);
  if (!setPreviewBuildEnv(outDir, vercelToken)) {
    die("`vercel env add PREVIEW_BUILD` failed — see output above.");
  }

  let link: ProjectLink;
  try {
    link = readProjectLink(outDir);
  } catch (err) {
    die((err as Error).message);
  }

  console.log(`\n→ Disabling Vercel Deployment Protection so the ?key= link resolves without a Vercel login...`);
  const sso = await disableSsoProtection(link, project, vercelToken);
  if (sso.ok) {
    console.log("✓ Deployment Protection disabled via the API.");
  } else {
    console.log(
      `\n⚠ Could not disable Deployment Protection via the API (plan/scope may not allow scripting this).\n` +
        `  Disable it by hand, then re-run this command: ${sso.deepLink}\n`,
    );
  }

  console.log(`\n→ Deploying to Vercel preview (never production)...`);
  let deployUrl: string;
  try {
    deployUrl = runPreviewDeploy(outDir, vercelToken);
  } catch (err) {
    die((err as Error).message);
  }

  const previewUrl = buildPreviewUrl(deployUrl, token);

  console.log(`\n→ Verifying the gate against the real deploy (200 with the key, closed without)...`);
  try {
    const gate = await verifyPreviewGate(previewUrl);
    console.log(`${gate.withKey.pass ? "✓" : "✖"} with key — ${gate.withKey.detail}`);
    console.log(`${gate.withoutKey.pass ? "✓" : "✖"} without key (gate closed) — ${gate.withoutKey.detail}`);

    if (gate.withKey.pass && gate.withoutKey.pass && sso.ok) {
      console.log(`\n✓ Gated preview ready and verified:\n\n  ${previewUrl}\n`);
    } else {
      console.log(
        `\n⚠ Deployed, but not fully verified above — the link may not resolve yet ` +
          `(Vercel deploys can take a few seconds to propagate; re-run this command to re-check):\n\n  ${previewUrl}\n`,
      );
      if (!sso.ok) console.log(`  Deployment Protection still needs a manual disable: ${sso.deepLink}\n`);
    }
  } catch (err) {
    // The deploy already succeeded; a throw here is almost always the runner
    // being unable to resolve the .vercel.app host (no outbound DNS in some
    // CI/sandbox networks). Don't fail the command — print the link so it isn't
    // lost, and let the operator open it to confirm.
    console.log(
      `\n⚠ Deployed, but couldn't verify the gate from here (${(err as Error).message}).` +
        ` That's usually the runner's network, not the deploy — open the link to confirm:\n\n  ${previewUrl}\n`,
    );
    if (!sso.ok) console.log(`  Deployment Protection still needs a manual disable: ${sso.deepLink}\n`);
  }
}
