import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  brandPaletteFields,
  contractDrift,
  declaredNames,
  FACTORY_OWNED,
  readNames,
  writtenNames,
  type HdsContractSnapshot,
  type TemplateNames,
} from "./hds-contract.js";

/**
 * The HDS name contract (ADR-0005), held against the template.
 *
 * `hds-contract.ts` says what the contract is; this file reads the real
 * snapshot and the real template, runs the drift check, and proves the check
 * can fail. Refresh the snapshot with `pnpm template:snapshot-hds`. A red test
 * after a refresh is a real drift (a name HDS renamed or removed) to decide on
 * here, never to silence by editing the snapshot by hand.
 */

const here = fileURLToPath(new URL(".", import.meta.url));
const read = (relative: string) => readFileSync(join(here, relative), "utf-8");

const snapshot: HdsContractSnapshot = JSON.parse(read("../hds-contract.snapshot.json"));

/** Every stylesheet, component and module under src/, tests excluded: what ships to a client site. */
const sources = readdirSync(here, { recursive: true, encoding: "utf-8" })
  .filter((file) => /\.(css|astro|ts)$/.test(file) && !/\.test\.ts$/.test(file))
  .map((file) => readFileSync(join(here, file), "utf-8"));

const template: TemplateNames = {
  declared: declaredNames(read("styles/tokens.css")),
  written: writtenNames(read("lib/brand-overlay.ts")),
  read: [...new Set(sources.flatMap(readNames))].sort(),
  paletteFields: brandPaletteFields(read("lib/brand-overlay.ts")),
};

const drift = contractDrift(snapshot, template);

const REFRESH_HINT = `Refresh with \`pnpm template:snapshot-hds\` (snapshot is ${snapshot.package}@${snapshot.version}), then decide the drift here.`;
const list = (names: string[]) => names.join("\n");

describe("HDS name contract (ADR-0005)", () => {
  it("reads a real snapshot and a real template, never an empty one", () => {
    expect(snapshot.variables.length).toBeGreaterThan(100);
    expect(snapshot.bridge.writes.length).toBeGreaterThan(10);
    expect(snapshot.bridge.fields.length).toBeGreaterThanOrEqual(5);
    expect(template.declared.length).toBeGreaterThan(50);
    expect(template.written.length).toBeGreaterThan(10);
    expect(template.read.length).toBeGreaterThan(10);
    expect(template.paletteFields.length).toBeGreaterThanOrEqual(snapshot.bridge.fields.length);
  });

  it("every custom property tokens.css declares exists in the published HDS, or is factory-owned", () => {
    expect(drift.unknownDeclared, `tokens.css declares names HDS no longer publishes:\n${list(drift.unknownDeclared)}\n${REFRESH_HINT}`).toEqual([]);
  });

  it("every custom property the brand bridge writes exists in the published HDS, or is factory-owned", () => {
    expect(drift.unknownWritten, `brand-overlay.ts writes names HDS no longer publishes:\n${list(drift.unknownWritten)}\n${REFRESH_HINT}`).toEqual([]);
  });

  it("every HDS-namespaced name a component reads is declared in tokens.css or written by the bridge", () => {
    expect(
      drift.unresolvedReads,
      `components read names nothing in the factory provides (there is no HDS stylesheet to fall back on):\n${list(drift.unresolvedReads)}`,
    ).toEqual([]);
  });

  it("a factory-owned name never collides with a name HDS later publishes", () => {
    expect(drift.collisions, `HDS now publishes a name the factory owns; pick one owner:\n${list(drift.collisions)}`).toEqual([]);
  });

  it("the bridge writes every variable HDS's own bridge writes", () => {
    expect(drift.missingWrites, `HDS's brand bridge writes these and ours does not:\n${list(drift.missingWrites)}`).toEqual([]);
  });

  it("the bridge keeps every BrandPalette field HDS's bridge accepts", () => {
    expect(drift.missingFields, `HDS's BrandPalette has fields ours dropped:\n${list(drift.missingFields)}`).toEqual([]);
  });

  // Self-test: proves the guard catches each kind of drift, seeded on the real
  // snapshot, so a parser that silently matched nothing could not pass above.
  it("self-test: flags a dropped name, a collision, a dropped field and an unresolved read", () => {
    const [dropped] = template.declared.filter((name) => snapshot.variables.includes(name));
    const [owned] = FACTORY_OWNED;
    if (!dropped || !owned) throw new Error("expected a shared name and a factory-owned name to seed with");

    const seeded = structuredClone(snapshot);
    seeded.variables = [...seeded.variables.filter((name) => name !== dropped), owned];
    seeded.bridge.fields = [...seeded.bridge.fields, "tone"];
    const reading = { ...template, read: [...template.read, "--semantic-color-surface-nowhere"] };

    const found = contractDrift(seeded, reading);

    expect(found.unknownDeclared).toEqual([dropped]);
    expect(found.collisions).toEqual([owned]);
    expect(found.missingFields).toEqual(["tone"]);
    expect(found.unresolvedReads).toEqual(["--semantic-color-surface-nowhere"]);
  });
});
