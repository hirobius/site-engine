import { next } from "@vercel/functions";

/**
 * Preview gate — Vercel Routing Middleware (formerly "Edge Middleware").
 *
 * This is a PLATFORM feature, not Astro middleware: it lives at the project root
 * and runs on Vercel's edge for every request regardless of framework output.
 * That's the whole reason it works on a *static* Astro site — Astro's own
 * middleware does not run for static builds.
 *
 * Verified against Vercel docs (routing-middleware): a non-Next.js project gets
 * middleware via a root `middleware.ts` exporting a default
 * `(request: Request) => Response`, using `next()` from `@vercel/functions` to
 * continue to the static asset.
 *
 * Behavior — CLOSED BY DEFAULT:
 *  - Live (SITE_LIVE === "true"): pass through untouched — set this env var only
 *    once the client has signed and the site is on their real domain.
 *  - Otherwise (spec sites / previews / EVERY env incl. production):
 *    1. Tokenized link (`?key=<PREVIEW_TOKEN>`), when PREVIEW_TOKEN is set: a
 *       matching token sets an httpOnly cookie and continues, so the one link
 *       sent in cold outreach works without sharing Basic auth credentials.
 *       The cookie carries the same token, so later requests pass with no
 *       query param. A missing/wrong token (and no PREVIEW_TOKEN configured
 *       at all) falls through to Basic auth below — Basic auth is always the
 *       operator path.
 *    2. HTTP Basic auth via PREVIEW_USER / PREVIEW_PASS.
 *    Both paths add `X-Robots-Tag: noindex` — a token grants *viewing*, never
 *    indexing. A fabricated spec site under a real business's name is thus
 *    never publicly exposed or indexed until SITE_LIVE is explicitly flipped.
 *    (vercel.json headers can't be env-scoped, so the noindex lives here.)
 */
export const config = {
  // Skip Vercel internals; gate everything else (HTML + assets).
  matcher: ["/((?!_vercel/).*)"],
};

const PREVIEW_TOKEN_COOKIE = "preview_token";

// Constant-time string compare (equal-length inputs only compare in constant
// time; a length mismatch short-circuits, which only leaks length, not
// content) — avoids a timing side-channel on the preview token check.
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return null;
}

export default function middleware(request: Request) {
  // Public ONLY when explicitly marked live (client signed). Until then the site
  // is gated + noindex on every environment — production included.
  if (process.env.SITE_LIVE === "true") {
    return next();
  }

  const previewToken = process.env.PREVIEW_TOKEN;
  if (previewToken) {
    const url = new URL(request.url);
    const suppliedFromQuery = url.searchParams.get("key");
    const supplied = suppliedFromQuery || readCookie(request, PREVIEW_TOKEN_COOKIE);

    if (supplied && timingSafeEqual(supplied, previewToken)) {
      const headers: HeadersInit = { "x-robots-tag": "noindex" };
      if (suppliedFromQuery) {
        headers["set-cookie"] =
          `${PREVIEW_TOKEN_COOKIE}=${previewToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;
      }
      return next({ headers });
    }
  }

  const user = process.env.PREVIEW_USER;
  const pass = process.env.PREVIEW_PASS;

  // Fail closed: if creds aren't set, don't expose the site.
  if (!user || !pass) {
    return new Response(
      "Preview access is not configured. Set PREVIEW_USER and PREVIEW_PASS.",
      { status: 503, headers: { "x-robots-tag": "noindex" } },
    );
  }

  const expected = "Basic " + btoa(`${user}:${pass}`);
  if (request.headers.get("authorization") !== expected) {
    return new Response("Authentication required.", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Preview", charset="UTF-8"',
        "x-robots-tag": "noindex",
      },
    });
  }

  // Authenticated preview: continue to the static asset, but keep it unindexed.
  return next({ headers: { "x-robots-tag": "noindex" } });
}
