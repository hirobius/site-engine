import { afterEach, beforeEach, describe, expect, it } from "vitest";
import middleware, { timingSafeEqual } from "../middleware";

/**
 * Unit coverage for the tokenized preview-link path added alongside Basic
 * auth (issue #103). middleware.ts is copied byte-for-byte to every app
 * (see packages/template/src/middleware-gate.test.ts), so this suite runs
 * once against the canonical _template copy.
 */

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, ORIGINAL_ENV);
  delete process.env.SITE_LIVE;
  delete process.env.PREVIEW_TOKEN;
  delete process.env.PREVIEW_USER;
  delete process.env.PREVIEW_PASS;
}

beforeEach(resetEnv);
afterEach(resetEnv);

function request(url: string, headers: Record<string, string> = {}) {
  return new Request(url, { headers });
}

describe("timingSafeEqual", () => {
  it("returns true only for exact matches", async () => {
    expect(timingSafeEqual("abc123", "abc123")).toBe(true);
    expect(timingSafeEqual("abc123", "abc124")).toBe(false);
  });

  it("returns false for mismatched lengths without throwing", async () => {
    expect(timingSafeEqual("short", "much-longer-value")).toBe(false);
  });
});

describe("middleware — tokenized preview link", () => {
  it("valid ?key= matches PREVIEW_TOKEN: passes through, sets cookie, keeps noindex", async () => {
    process.env.PREVIEW_TOKEN = "s3cr3t-token";
    const res = await middleware(request("https://preview.example/?key=s3cr3t-token"));

    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
    const cookie = res.headers.get("set-cookie");
    expect(cookie).toContain("preview_token=s3cr3t-token");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
  });

  it("a valid cookie (no query param) passes through without re-setting the cookie", async () => {
    process.env.PREVIEW_TOKEN = "s3cr3t-token";
    const res = await middleware(
      request("https://preview.example/about", { cookie: "preview_token=s3cr3t-token" }),
    );

    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("an invalid token falls through to Basic auth (401 when creds are configured)", async () => {
    process.env.PREVIEW_TOKEN = "s3cr3t-token";
    process.env.PREVIEW_USER = "user";
    process.env.PREVIEW_PASS = "pass";

    const res = await middleware(request("https://preview.example/?key=wrong-token"));

    expect(res.status).toBe(401);
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
  });

  it("an invalid token falls through to the fail-closed 503 when no Basic auth creds are set", async () => {
    process.env.PREVIEW_TOKEN = "s3cr3t-token";

    const res = await middleware(request("https://preview.example/?key=wrong-token"));

    expect(res.status).toBe(503);
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
  });

  it("no PREVIEW_TOKEN configured leaves Basic-auth-only behavior unchanged", async () => {
    process.env.PREVIEW_USER = "user";
    process.env.PREVIEW_PASS = "pass";

    const res = await middleware(request("https://preview.example/?key=anything"));

    expect(res.status).toBe(401);
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
  });

  it("no PREVIEW_TOKEN and no Basic auth creds still fails closed with 503", async () => {
    const res = await middleware(request("https://preview.example/"));

    expect(res.status).toBe(503);
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
  });

  it("SITE_LIVE=true passes straight through regardless of a token", async () => {
    process.env.SITE_LIVE = "true";
    process.env.PREVIEW_TOKEN = "s3cr3t-token";

    const res = await middleware(request("https://preview.example/?key=wrong-token"));

    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(res.headers.get("x-robots-tag")).toBeNull();
  });
});
