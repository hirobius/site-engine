import { describe, expect, it } from "vitest";
import { verifyGated, verifyLive } from "./verify-live.js";

const LOCAL_BUSINESS_HTML =
  '<html><head><script type="application/ld+json">{"@type":"LocalBusiness","name":"Acme"}</script></head><body></body></html>';

function fakeFetch(routes: Record<string, Response>): typeof fetch {
  return (async (input: string | URL | Request) => {
    const key = input.toString();
    const res = routes[key];
    if (!res) throw new Error(`unexpected fetch: ${key}`);
    return res;
  }) as typeof fetch;
}

describe("verifyLive", () => {
  const ok = () => ({
    "https://acme.com": new Response(LOCAL_BUSINESS_HTML, { status: 200 }),
    "https://acme.com/sitemap-index.xml": new Response("", { status: 200 }),
    "https://acme.com/robots.txt": new Response("", { status: 200 }),
    "https://acme.com/thanks": new Response("", { status: 200 }),
  });

  it("passes every check for a healthy live site", async () => {
    const results = await verifyLive("https://acme.com", fakeFetch(ok()));
    expect(results.every((r) => r.pass)).toBe(true);
    expect(results).toHaveLength(6);
  });

  it("fails the noindex check when X-Robots-Tag: noindex is present", async () => {
    const routes = ok();
    routes["https://acme.com"] = new Response(LOCAL_BUSINESS_HTML, {
      status: 200,
      headers: { "x-robots-tag": "noindex" },
    });
    const results = await verifyLive("https://acme.com", fakeFetch(routes));
    const check = results.find((r) => r.name === "no noindex robots tag");
    expect(check?.pass).toBe(false);
  });

  it("fails the JSON-LD check when no LocalBusiness block is present", async () => {
    const routes = ok();
    routes["https://acme.com"] = new Response("<html><body>no structured data</body></html>", { status: 200 });
    const results = await verifyLive("https://acme.com", fakeFetch(routes));
    const check = results.find((r) => r.name === "LocalBusiness JSON-LD present");
    expect(check?.pass).toBe(false);
  });

  it("fails when a required route is unreachable", async () => {
    const routes = ok();
    routes["https://acme.com/thanks"] = new Response("Not Found", { status: 404 });
    const results = await verifyLive("https://acme.com", fakeFetch(routes));
    const check = results.find((r) => r.name === "/thanks reachable");
    expect(check?.pass).toBe(false);
  });

  it("strips a trailing slash from the base URL before building sub-paths", async () => {
    const results = await verifyLive("https://acme.com/", fakeFetch(ok()));
    expect(results.every((r) => r.pass)).toBe(true);
  });
});

describe("verifyGated", () => {
  it("passes when the preview is properly gated (401 + WWW-Authenticate + noindex)", async () => {
    const fetchImpl = fakeFetch({
      "https://preview.example": new Response("Authentication required.", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Preview"', "X-Robots-Tag": "noindex" },
      }),
    });
    const results = await verifyGated("https://preview.example", fetchImpl);
    expect(results.every((r) => r.pass)).toBe(true);
  });

  it("fails when the deploy is not actually gated", async () => {
    const fetchImpl = fakeFetch({
      "https://preview.example": new Response("ok", { status: 200 }),
    });
    const results = await verifyGated("https://preview.example", fetchImpl);
    expect(results.some((r) => !r.pass)).toBe(true);
    expect(results.find((r) => r.name === "home page returns 401")?.pass).toBe(false);
  });
});
