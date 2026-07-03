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
 * Behavior:
 *  - Production (VERCEL_ENV === "production"): pass through untouched.
 *  - Preview / development: HTTP Basic auth via PREVIEW_USER / PREVIEW_PASS, and
 *    add `X-Robots-Tag: noindex` so previews never get indexed. (vercel.json
 *    headers can't be scoped to an environment, so the noindex lives here.)
 */
export const config = {
  // Skip Vercel internals; gate everything else (HTML + assets).
  matcher: ["/((?!_vercel/).*)"],
};

export default function middleware(request: Request) {
  if (process.env.VERCEL_ENV === "production") {
    return next();
  }

  const user = process.env.PREVIEW_USER;
  const pass = process.env.PREVIEW_PASS;

  // Fail closed: if creds aren't set on a preview, don't expose the site.
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
