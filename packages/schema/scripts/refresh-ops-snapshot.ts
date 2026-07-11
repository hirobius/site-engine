/**
 * Regenerates ops-shape.snapshot.json from the canonical schema in this repo.
 *
 * Run ONLY right after re-syncing ops/lib/schema (index.mjs, presets.mjs) to
 * match packages/schema/src — this snapshots *this* repo's shape as the new
 * baseline the drift test (src/ops-drift.test.ts) compares future changes
 * against. It cannot read ops's files (this repo has no access to that repo);
 * it's on whoever does the re-sync to make them match first, then run this.
 *
 * Usage: pnpm schema:snapshot-ops
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ClientConfigSchema } from "../src/index.js";
import { shapeOf, presetsShape } from "../src/shape.js";

const snapshot = {
  note:
    "Baseline shape of packages/schema, captured at the last known ops/lib/schema " +
    "re-sync. Regenerate with `pnpm schema:snapshot-ops` immediately after re-syncing " +
    "ops — never to silence a real, un-synced drift.",
  clientConfig: shapeOf(ClientConfigSchema),
  presets: presetsShape(),
};

const outPath = fileURLToPath(new URL("../ops-shape.snapshot.json", import.meta.url));
writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Wrote ${outPath}`);
