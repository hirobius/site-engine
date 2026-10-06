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
 *       sent in cold outreach works without sharing credentials. The cookie
 *       carries the same token, so later requests pass with no query param.
 *    2. Sign-in page (operator path) via PREVIEW_USER / PREVIEW_PASS. A browser
 *       page load gets a real HTML form (username + password fields with
 *       autocomplete hints) instead of the native Basic-auth popup, so password
 *       managers (Bitwarden, iCloud Keychain) can autofill it. A correct
 *       sign-in sets an httpOnly cookie holding a SHA-256 of the credentials,
 *       so changing PREVIEW_PASS signs everyone out.
 *    3. HTTP Basic auth still works for scripts and non-browser requests
 *       (`scripts/verify-live.ts` expects the 401 + WWW-Authenticate challenge).
 *    Every path adds `X-Robots-Tag: noindex` — access grants *viewing*, never
 *    indexing. A fabricated spec site under a real business's name is thus
 *    never publicly exposed or indexed until SITE_LIVE is explicitly flipped.
 *    (vercel.json headers can't be env-scoped, so the noindex lives here.)
 */
export const config = {
  // Skip Vercel internals; gate everything else (HTML + assets).
  matcher: ["/((?!_vercel/).*)"],
};

const PREVIEW_TOKEN_COOKIE = "preview_token";
const PREVIEW_AUTH_COOKIE = "preview_auth";
const LOGIN_PATH = "/__preview-login";
const COOKIE_ATTRS = "Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000";
const NOINDEX = { "x-robots-tag": "noindex" } as const;

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

/** Hex SHA-256 of the operator credentials — the sign-in cookie's value. */
async function credentialDigest(user: string, pass: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${user}:${pass}`);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Only same-site paths are valid post-sign-in destinations (no open redirect). */
function safeNext(value: FormDataEntryValue | null): string {
  const path = typeof value === "string" ? value : "";
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith(LOGIN_PATH) ? path : "/";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** A browser navigation (vs. curl, scripts, asset fetches). */
function wantsHtml(request: Request): boolean {
  return /text\/html/i.test(request.headers.get("accept") ?? "");
}

function loginPage(nextPath: string, error: boolean): Response {
  const body = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Preview — sign in</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center;
    font: 16px/1.5 system-ui, -apple-system, sans-serif; background: Canvas; color: CanvasText; }
  form { width: min(22rem, calc(100% - 2rem)); display: grid; gap: .75rem; }
  h1 { font-size: 1.25rem; margin: 0 0 .25rem; }
  p { margin: 0; opacity: .7; font-size: .9rem; }
  label { display: grid; gap: .25rem; font-size: .9rem; }
  input { font: inherit; padding: .65rem .75rem; border: 1px solid GrayText; border-radius: .5rem; }
  button { font: inherit; font-weight: 600; padding: .7rem; border: 0; border-radius: .5rem;
    background: CanvasText; color: Canvas; cursor: pointer; }
  .error { color: #c62828; opacity: 1; }
</style></head>
<body>
<form method="post" action="${LOGIN_PATH}">
  <h1>Private preview</h1>
  <p>Sign in to view this site.</p>
  ${error ? '<p class="error" role="alert">That username or password is not right.</p>' : ""}
  <input type="hidden" name="next" value="${escapeHtml(nextPath)}">
  <label>Username <input name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required autofocus></label>
  <label>Password <input name="password" type="password" autocomplete="current-password" required></label>
  <button type="submit">Sign in</button>
</form>
</body></html>`;
  return new Response(body, {
    status: 401,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", ...NOINDEX },
  });
}

export default async function middleware(request: Request): Promise<Response> {
  // Public ONLY when explicitly marked live (client signed). Until then the site
  // is gated + noindex on every environment — production included.
  if (process.env.SITE_LIVE === "true") {
    return next();
  }

  const url = new URL(request.url);
  const previewToken = process.env.PREVIEW_TOKEN;
  if (previewToken) {
    const suppliedFromQuery = url.searchParams.get("key");
    const supplied = suppliedFromQuery || readCookie(request, PREVIEW_TOKEN_COOKIE);

    if (supplied && timingSafeEqual(supplied, previewToken)) {
      const headers: HeadersInit = { ...NOINDEX };
      if (suppliedFromQuery) {
        headers["set-cookie"] = `${PREVIEW_TOKEN_COOKIE}=${previewToken}; ${COOKIE_ATTRS}`;
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
      { status: 503, headers: { ...NOINDEX } },
    );
  }

  const digest = await credentialDigest(user, pass);

  // Sign-in form submission.
  if (url.pathname === LOGIN_PATH && request.method === "POST") {
    const form = await request.formData().catch(() => null);
    const nextPath = safeNext(form?.get("next") ?? null);
    const submittedUser = String(form?.get("username") ?? "");
    const submittedPass = String(form?.get("password") ?? "");
    const ok = timingSafeEqual(await credentialDigest(submittedUser, submittedPass), digest);
    if (!ok) return loginPage(nextPath, true);
    return new Response(null, {
      status: 303,
      headers: {
        location: nextPath,
        "set-cookie": `${PREVIEW_AUTH_COOKIE}=${digest}; ${COOKIE_ATTRS}`,
        "cache-control": "no-store",
        ...NOINDEX,
      },
    });
  }

  // Signed in earlier (cookie) or Basic auth (scripts / curl).
  const cookie = readCookie(request, PREVIEW_AUTH_COOKIE);
  const basicOk = request.headers.get("authorization") === "Basic " + btoa(`${user}:${pass}`);
  if ((cookie && timingSafeEqual(cookie, digest)) || basicOk) {
    if (url.pathname === LOGIN_PATH) {
      return new Response(null, { status: 303, headers: { location: "/", ...NOINDEX } });
    }
    return next({ headers: { ...NOINDEX } });
  }

  // Browsers get the autofillable sign-in page; everything else the Basic challenge.
  if (wantsHtml(request)) {
    return loginPage(url.pathname === LOGIN_PATH ? "/" : url.pathname + url.search, false);
  }
  return new Response("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Preview", charset="UTF-8"', ...NOINDEX },
  });
}
