#!/usr/bin/env tsx
/**
 * verify-live — post-deploy assertions against a real Vercel deploy.
 *
 *   pnpm verify-live <url>                  # live-mode assertions
 *   pnpm verify-live <url> --expect-gated   # preview-gate assertions
 *
 * Nothing in this repo asserts a *deployed* site actually behaves — the build
 * gate (armAcceptanceGate) only checks the config that goes IN. This is the
 * other half: hit the real URL and check what comes OUT.
 *
 * Live mode expects what `apps/<slug>/middleware.ts` does once `SITE_LIVE=true`
 * (pass-through, no gate): 200, no `X-Robots-Tag: noindex`, a LocalBusiness
 * JSON-LD block (see `packages/template/src/lib/seo.ts`), `/sitemap-index.xml`
 * + `/robots.txt` + `/thanks` all reachable.
 *
 * `--expect-gated` expects the OPPOSITE — the closed-by-default preview gate:
 * 401 with `WWW-Authenticate` + `X-Robots-Tag: noindex`. Point it at any
 * preview deploy to get the behavioral proof issue #8 has been waiting on.
 */
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

export interface CheckResult {
  name: string;
  pass: boolean;
  detail: string;
}

function extractJsonLd(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    try {
      blocks.push(JSON.parse(match[1]!));
    } catch {
      // Not valid JSON — doesn't count as a LocalBusiness block either way.
    }
  }
  return blocks;
}

function hasLocalBusiness(blocks: unknown[]): boolean {
  return blocks.some((block) => {
    if (typeof block !== "object" || block === null) return false;
    const type = (block as Record<string, unknown>)["@type"];
    return type === "LocalBusiness" || (Array.isArray(type) && type.includes("LocalBusiness"));
  });
}

/** Live-mode assertions: the site is public and fully functional. */
export async function verifyLive(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CheckResult[]> {
  const root = baseUrl.replace(/\/$/, "");
  const results: CheckResult[] = [];

  const homeRes = await fetchImpl(root);
  const html = await homeRes.text();

  results.push({
    name: "home page returns 200",
    pass: homeRes.status === 200,
    detail: `status ${homeRes.status}`,
  });

  const robotsTag = homeRes.headers.get("x-robots-tag");
  results.push({
    name: "no noindex robots tag",
    pass: !robotsTag || !/noindex/i.test(robotsTag),
    detail: robotsTag ? `X-Robots-Tag: ${robotsTag}` : "header absent",
  });

  const jsonLd = extractJsonLd(html);
  results.push({
    name: "LocalBusiness JSON-LD present",
    pass: hasLocalBusiness(jsonLd),
    detail: jsonLd.length > 0 ? `found ${jsonLd.length} JSON-LD block(s), none LocalBusiness` : "no JSON-LD script found",
  });

  for (const path of ["/sitemap-index.xml", "/robots.txt", "/thanks"]) {
    const res = await fetchImpl(`${root}${path}`);
    results.push({
      name: `${path} reachable`,
      pass: res.status === 200,
      detail: `status ${res.status}`,
    });
  }

  return results;
}

/** Preview-gate assertions: the site is closed by default, per middleware.ts. */
export async function verifyGated(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CheckResult[]> {
  const root = baseUrl.replace(/\/$/, "");
  const res = await fetchImpl(root);
  const results: CheckResult[] = [];

  results.push({
    name: "home page returns 401",
    pass: res.status === 401,
    detail: `status ${res.status}`,
  });

  const auth = res.headers.get("www-authenticate");
  results.push({
    name: "WWW-Authenticate header present",
    pass: Boolean(auth),
    detail: auth ?? "header absent",
  });

  const robotsTag = res.headers.get("x-robots-tag");
  results.push({
    name: "noindex header present",
    pass: Boolean(robotsTag && /noindex/i.test(robotsTag)),
    detail: robotsTag ?? "header absent",
  });

  return results;
}

function report(results: CheckResult[]): void {
  for (const r of results) {
    console.log(`${r.pass ? "✓" : "✖"} ${r.name} — ${r.detail}`);
  }
  const failed = results.filter((r) => !r.pass);
  if (failed.length > 0) {
    console.error(`\n✖ ${failed.length} check(s) failed.\n`);
    process.exit(1);
  }
  console.log("\n✓ All checks passed.");
}

function isMain(): boolean {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(resolve(entry)).href;
}

if (isMain()) {
  const argv = process.argv.slice(2);
  const expectGated = argv.includes("--expect-gated");
  const url = argv.find((a) => !a.startsWith("--"));

  if (!url) {
    console.error("\n✖ Usage: pnpm verify-live <url> [--expect-gated]\n");
    process.exit(1);
  }

  const results = expectGated ? await verifyGated(url) : await verifyLive(url);
  report(results);
}
