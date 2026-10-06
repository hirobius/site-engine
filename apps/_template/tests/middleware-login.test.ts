import { afterEach, beforeEach, describe, expect, it } from "vitest";
import middleware from "../middleware";

/**
 * Behavior of the canonical preview gate (this app's middleware.ts; every app
 * carries a byte-identical copy — see packages/template/src/middleware-gate.test.ts). Browsers
 * get an autofillable sign-in form instead of the native Basic-auth popup, so
 * password managers work; scripts still get the Basic challenge.
 */
const ENV = { PREVIEW_USER: "hirobius", PREVIEW_PASS: "s3cret-pass", PREVIEW_TOKEN: "a".repeat(32) };
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of [...Object.keys(ENV), "SITE_LIVE"]) saved[k] = process.env[k];
  Object.assign(process.env, ENV);
  delete process.env.SITE_LIVE;
});
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

const BASE = "https://preview.example.test";
const browser = (path = "/", headers: Record<string, string> = {}) =>
  new Request(BASE + path, { headers: { accept: "text/html,application/xhtml+xml", ...headers } });
const passedThrough = (res: Response) => res.headers.get("x-middleware-next") === "1";
const cookieFrom = (res: Response) => (res.headers.get("set-cookie") ?? "").split(";")[0] ?? "";

function signIn(username: string, password: string, nextPath = "/") {
  const body = new URLSearchParams({ username, password, next: nextPath });
  return middleware(
    new Request(BASE + "/__preview-login", {
      method: "POST",
      body,
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "text/html" },
    }),
  );
}

describe("preview gate — sign-in form", () => {
  it("serves an autofillable sign-in page to browsers, with no native popup", async () => {
    const res = await middleware(browser("/services?x=1"));
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toBeNull();
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
    const html = await res.text();
    expect(html).toContain('autocomplete="username"');
    expect(html).toContain('autocomplete="current-password"');
    expect(html).toContain('action="/__preview-login"');
    expect(html).toContain('value="/services?x=1"');
  });

  it("keeps the Basic challenge for non-browser requests (verify-live)", async () => {
    const res = await middleware(new Request(BASE + "/"));
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toMatch(/^Basic/);
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
  });

  it("signs in with the right credentials, redirects back, and the cookie grants access", async () => {
    const res = await signIn(ENV.PREVIEW_USER, ENV.PREVIEW_PASS, "/services");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/services");
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/^preview_auth=[0-9a-f]{64};/);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).not.toContain(ENV.PREVIEW_PASS);

    const after = await middleware(browser("/services", { cookie: cookieFrom(res) }));
    expect(passedThrough(after)).toBe(true);
    expect(after.headers.get("x-robots-tag")).toBe("noindex");
  });

  it("rejects wrong credentials with the form and an error", async () => {
    const res = await signIn(ENV.PREVIEW_USER, "nope");
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(await res.text()).toContain("not right");
  });

  it("never redirects off-site after sign-in", async () => {
    for (const evil of ["//evil.test", "https://evil.test", "/__preview-login"]) {
      const res = await signIn(ENV.PREVIEW_USER, ENV.PREVIEW_PASS, evil);
      expect(res.headers.get("location")).toBe("/");
    }
  });

  it("invalidates the sign-in cookie when PREVIEW_PASS changes", async () => {
    const res = await signIn(ENV.PREVIEW_USER, ENV.PREVIEW_PASS);
    process.env.PREVIEW_PASS = "rotated-pass";
    const after = await middleware(browser("/", { cookie: cookieFrom(res) }));
    expect(after.status).toBe(401);
  });

  it("still accepts Basic auth and the ?key= share link", async () => {
    const basic = await middleware(
      new Request(BASE + "/", { headers: { authorization: "Basic " + btoa(`${ENV.PREVIEW_USER}:${ENV.PREVIEW_PASS}`) } }),
    );
    expect(passedThrough(basic)).toBe(true);
    const keyed = await middleware(browser(`/?key=${ENV.PREVIEW_TOKEN}`));
    expect(passedThrough(keyed)).toBe(true);
    expect(keyed.headers.get("set-cookie")).toMatch(/^preview_token=/);
  });

  it("fails closed when credentials aren't configured, and opens only when SITE_LIVE", async () => {
    delete process.env.PREVIEW_PASS;
    expect((await middleware(browser("/"))).status).toBe(503);
    process.env.SITE_LIVE = "true";
    expect(passedThrough(await middleware(browser("/")))).toBe(true);
  });
});
