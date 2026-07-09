import { test } from "node:test";
import assert from "node:assert/strict";

import { BrandSchema } from "./index.js";

// The density dial is additive: existing client configs that never set
// `brand.density` must keep rendering as before, which is guaranteed only if
// the schema defaults it to "comfortable" (scale 1). These tests lock that in.

test("brand.density defaults to comfortable (existing configs unchanged)", () => {
  const brand = BrandSchema.parse({ palettePreset: "landscaping", cssVarOverrides: {} });
  assert.equal(brand.density, "comfortable");
});

test("brand.density accepts the three dial values", () => {
  for (const density of ["compact", "comfortable", "loose"] as const) {
    const brand = BrandSchema.parse({ palettePreset: "landscaping", cssVarOverrides: {}, density });
    assert.equal(brand.density, density);
  }
});

test("brand.density rejects unknown values", () => {
  assert.throws(() =>
    BrandSchema.parse({ palettePreset: "landscaping", cssVarOverrides: {}, density: "cramped" }),
  );
});
