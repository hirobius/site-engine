import { test } from "node:test";
import assert from "node:assert/strict";

import type { ClientConfig } from "@hirobius/schema";
import { brandStyle } from "./theme.js";

// brandStyle() is the seam that turns a config's density into the
// `--brand-space-scale` custom property the @theme `--spacing` calc consumes.
// Expected scales come from DENSITY_SCALES (0.85 / 1 / 1.2), asserted against
// the real emitted style string — not recomputed here.

const withDensity = (density: ClientConfig["brand"]["density"]): ClientConfig =>
  ({
    brand: {
      palettePreset: "landscaping",
      cssVarOverrides: {},
      font: "system",
      radius: "md",
      density,
    },
  }) as unknown as ClientConfig;

test("brandStyle emits --brand-space-scale matching the density dial", () => {
  assert.match(brandStyle(withDensity("compact")), /--brand-space-scale:0\.85(?:;|$)/);
  assert.match(brandStyle(withDensity("comfortable")), /--brand-space-scale:1(?:;|$)/);
  assert.match(brandStyle(withDensity("loose")), /--brand-space-scale:1\.2(?:;|$)/);
});
