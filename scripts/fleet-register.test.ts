import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { insertFleetEntry, readTemplateVersion } from "./fleet-register.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("readTemplateVersion", () => {
  it("reads the version straight from packages/template/package.json", () => {
    const pkg = JSON.parse(
      readFileSync(resolve(ROOT, "packages/template/package.json"), "utf8"),
    ) as { version: string };
    expect(readTemplateVersion()).toBe(pkg.version);
  });
});

describe("insertFleetEntry", () => {
  const FIXTURE = `export const FLEET: FleetSite[] = [
  {
    slug: "demo-pressure-pros",
    name: "Pressure Pros (demo)",
    url: "https://example.com",
    trade: "pressure-washing",
    templateVersion: "0.1.0",
    status: "preview",
  },
];
`;

  it("appends a new entry before the closing `];`", () => {
    const { source, inserted } = insertFleetEntry(FIXTURE, {
      slug: "mikes-junk",
      name: "Mike's Junk Removal",
      trade: "junk-removal",
      url: "https://mikes-junk.example",
      templateVersion: "0.7.0",
    });
    expect(inserted).toBe(true);
    expect(source).toContain('slug: "mikes-junk"');
    expect(source).toContain('name: "Mike\'s Junk Removal"');
    expect(source).toContain('trade: "junk-removal"');
    expect(source).toContain('templateVersion: "0.7.0"');
    expect(source).toContain('status: "preview"');
    // still contains the original entry, untouched
    expect(source).toContain('slug: "demo-pressure-pros"');
    // still valid-looking: exactly one closing `];`
    expect(source.match(/\n\];\s*\n/g)?.length).toBe(1);
  });

  it("defaults status to preview when not given", () => {
    const { source } = insertFleetEntry(FIXTURE, {
      slug: "acme",
      name: "Acme Co",
      trade: "landscaping",
      url: "https://acme.example",
      templateVersion: "0.7.0",
    });
    expect(source).toMatch(/slug: "acme"[\s\S]*?status: "preview"/);
  });

  it("respects an explicit status", () => {
    const { source } = insertFleetEntry(FIXTURE, {
      slug: "acme",
      name: "Acme Co",
      trade: "landscaping",
      url: "https://acme.example",
      templateVersion: "0.7.0",
      status: "live",
    });
    expect(source).toMatch(/slug: "acme"[\s\S]*?status: "live"/);
  });

  it("is idempotent: skips insertion if the slug already exists", () => {
    const { source, inserted } = insertFleetEntry(FIXTURE, {
      slug: "demo-pressure-pros",
      name: "Pressure Pros (demo)",
      trade: "pressure-washing",
      url: "https://example.com",
      templateVersion: "0.7.0",
    });
    expect(inserted).toBe(false);
    expect(source).toBe(FIXTURE);
  });

  it("throws a clear error if the FLEET array's closing bracket can't be found", () => {
    expect(() =>
      insertFleetEntry("export const FLEET: FleetSite[] = [", {
        slug: "acme",
        name: "Acme Co",
        trade: "landscaping",
        url: "https://acme.example",
        templateVersion: "0.7.0",
      }),
    ).toThrow(/closing/);
  });
});
