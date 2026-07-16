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
 *      `PREVIEW_PASS`)                                plus Basic-auth creds so the *no-key* path
 *                                                       fails closed with 401, not a bare 503
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
 * Idempotently sets the `PREVIEW_TOKEN` preview env var to `token`: removes
 * any existing value first (failure ignored — it may simply not exist yet),
 * then adds the current value. Re-running always converges on the same env
 * state instead of erroring on "already exists" or drifting.
 */
export function setPreviewTokenEnv(
  dir: string,
  token: string,
  vercelToken: string,
  spawnImpl: SpawnFn = defaultSpawn,
): boolean {
  spawnImpl("vercel", ["env", "rm", "PREVIEW_TOKEN", "preview", "--yes", "--cwd", dir, "--token", vercelToken], {});
  const res = spawnImpl(
    "vercel",
    ["env", "add", "PREVIEW_TOKEN", "preview", "--cwd", dir, "--token", vercelToken],
    { input: `${token}\n` },
  );
  return res.status === 0;
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

/** Idempotently sets PREVIEW_USER/PREVIEW_PASS the same rm-then-add way as `setPreviewTokenEnv`. */
export function setBasicAuthEnv(
  dir: string,
  creds: BasicAuthCreds,
  vercelToken: string,
  spawnImpl: SpawnFn = defaultSpawn,
): boolean {
  const set = (name: string, value: string): boolean => {
    spawnImpl("vercel", ["env", "rm", name, "preview", "--yes", "--cwd", dir, "--token", vercelToken], {});
    const res = spawnImpl("vercel", ["env", "add", name, "preview", "--cwd", dir, "--token", vercelToken], {
      input: `${value}\n`,
    });
    return res.status === 0;
  };
  const userOk = set("PREVIEW_USER", creds.user);
  const passOk = set("PREVIEW_PASS", creds.pass);
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

/** Pulls the deployment URL `vercel deploy` prints on its final stdout line. */
export function extractDeployUrl(stdout: string): string {
  const match = stdout.match(/https:\/\/\S+\.vercel\.app\S*/);
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
  console.log(`\n→ Setting PREVIEW_TOKEN (preview env)...`);
  if (!setPreviewTokenEnv(outDir, token, vercelToken)) {
    die("`vercel env add PREVIEW_TOKEN preview` failed — see output above.");
  }

  const basicAuth = ensureBasicAuthCreds(outDir);
  console.log(`→ Setting PREVIEW_USER/PREVIEW_PASS (preview env, so the no-key path fails closed with 401)...`);
  if (!setBasicAuthEnv(outDir, basicAuth, vercelToken)) {
    die("`vercel env add PREVIEW_USER/PREVIEW_PASS preview` failed — see output above.");
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
}
