import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineClient } from "@hirobius/schema";
import type { ClientConfigInput } from "@hirobius/schema";
import { OG_IMAGE_PATH } from "./lib/og-image.js";
import { ogImageIntegration } from "./og-image-integration.js";

const BASE_INPUT: ClientConfigInput = {
  slug: "acme-co",
  business: {
    name: "Acme Service Co.",
    phone: "(555) 010-0000",
    email: "hello@example.com",
    hours: [{ days: "Mon–Fri", hours: "8:00 AM – 6:00 PM" }],
    serviceAreas: ["Your City"],
  },
  brand: { palettePreset: "pressure-washing" },
  layout: { sectionOrder: ["services", "contact"] },
  services: [{ title: "Washing", description: "We wash things." }],
  copy: { heroHeadline: "Headline", heroSub: "Sub", about: "About us." },
  form: { provider: "web3forms", accessKey: "3fa85f64-5717-4562-b3fc-2c963f66afa6" },
  seo: {
    title: "Acme",
    description: "Acme description",
    city: "Springfield",
    region: "IL",
    siteUrl: "https://example.com",
  },
};

const fakeLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any;

let dir: string;

afterEach(async () => {
  fakeLogger.info.mockClear();
  if (dir) await rm(dir, { recursive: true, force: true });
});

async function runBuildDone(client: ReturnType<typeof defineClient>) {
  dir = await mkdtemp(join(tmpdir(), "og-image-integration-"));
  const integration = ogImageIntegration(client);
  const hook = integration.hooks!["astro:build:done"]!;
  await hook({ pages: [], dir: pathToFileURL(`${dir}/`), routes: [], assets: new Map(), logger: fakeLogger });
  return dir;
}

describe("ogImageIntegration", () => {
  it("writes a generated og-image.png when seo.ogImage is absent", async () => {
    const outDir = await runBuildDone(defineClient(BASE_INPUT));
    const outFile = join(outDir, OG_IMAGE_PATH);
    expect(existsSync(outFile)).toBe(true);
    const png = await readFile(outFile);
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a"); // PNG magic bytes
  });

  it("does nothing when seo.ogImage is explicit — explicit config wins", async () => {
    const client = defineClient({ ...BASE_INPUT, seo: { ...BASE_INPUT.seo, ogImage: "/photos/og.jpg" } });
    const outDir = await runBuildDone(client);
    expect(existsSync(join(outDir, OG_IMAGE_PATH))).toBe(false);
  });
});
