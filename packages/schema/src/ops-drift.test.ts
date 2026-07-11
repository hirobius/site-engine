import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ClientConfigSchema } from "./index.js";
import { diffShapes, presetsShape, shapeOf, type FieldEntry, type PresetsShape } from "./shape.js";

interface OpsSnapshot {
  clientConfig: FieldEntry;
  presets: PresetsShape;
}

const snapshotPath = fileURLToPath(new URL("../ops-shape.snapshot.json", import.meta.url));
const snapshot: OpsSnapshot = JSON.parse(readFileSync(snapshotPath, "utf-8"));

const REFRESH_HINT =
  "Re-sync ops/lib/schema (index.mjs, presets.mjs) to match, then run " +
  "`pnpm schema:snapshot-ops` to refresh ops-shape.snapshot.json.";

describe("schema-drift guard vs. ops-shape.snapshot.json", () => {
  it("ClientConfigSchema matches the vendored ops snapshot", () => {
    const diffs = diffShapes(shapeOf(ClientConfigSchema), snapshot.clientConfig);
    expect(diffs, `packages/schema/src/index.ts has drifted:\n${diffs.join("\n")}\n${REFRESH_HINT}`).toEqual(
      [],
    );
  });

  it("presets.ts matches the vendored ops snapshot", () => {
    const diffs = diffShapes(presetsShape(), snapshot.presets);
    expect(diffs, `packages/schema/src/presets.ts has drifted:\n${diffs.join("\n")}\n${REFRESH_HINT}`).toEqual(
      [],
    );
  });

  // Self-test (issue #21 DoD): proves the guard actually catches a real drift
  // scenario — e.g. PR #40 adding `brand.motion` here before ops re-syncs.
  it("self-test: flags a field present here but absent from the snapshot", () => {
    const current = shapeOf(ClientConfigSchema);
    const seeded: FieldEntry = structuredClone(current);
    if (seeded.shape.kind !== "object") throw new Error("expected object shape");
    const brand = seeded.shape.fields.brand;
    if (!brand || brand.shape.kind !== "object") throw new Error("expected brand object");
    brand.shape.fields.motion = {
      shape: { kind: "primitive", type: "string" },
      optional: true,
      hasDefault: false,
    };

    const diffs = diffShapes(seeded, current);

    expect(diffs.length).toBeGreaterThan(0);
    expect(diffs.some((d) => d.includes("brand") && d.includes("motion"))).toBe(true);
  });
});
