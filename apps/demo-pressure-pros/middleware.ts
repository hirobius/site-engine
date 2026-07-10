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
 *  - Otherwise (spec sites / previews / EVERY env incl. production): HTTP Basic
 *    auth via PREVIEW_USER / PREVIEW_PASS + `X-Robots-Tag: noindex`. A fabricated
 *    spec site under a real business's name is thus never publicly exposed or
 *    indexed until SITE_LIVE is explicitly flipped. (vercel.json headers can't be
 *    env-scoped, so the noindex lives here.)
 */
export const config = {
  // Skip Vercel internals; gate everything else (HTML + assets).
  matcher: ["/((?!_vercel/).*)"],
};

export default function middleware(request: Request) {
  // Public ONLY when explicitly marked live (client signed). Until then the site
  // is gated + noindex on every environment — production included.
  if (process.env.SITE_LIVE === "true") {
    return next();
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
