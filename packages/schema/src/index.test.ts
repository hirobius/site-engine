import { test } from "node:test";
import assert from "node:assert/strict";

import { BrandSchema, HeroSchema, LayoutSchema } from "./index.js";

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

// Per-section layout variants (Red Alert #2): the variant is localized to the
// Hero section, so shifting the Hero cannot move any other section. The global
// `layout.variant` toggle is removed.

test("hero.variant defaults to split", () => {
  assert.equal(HeroSchema.parse({}).variant, "split");
});

test("hero.variant accepts split and full-bleed", () => {
  assert.equal(HeroSchema.parse({ variant: "split" }).variant, "split");
  assert.equal(HeroSchema.parse({ variant: "full-bleed" }).variant, "full-bleed");
});

test("hero.variant rejects the old global A/B values and unknowns", () => {
  assert.throws(() => HeroSchema.parse({ variant: "A" }));
  assert.throws(() => HeroSchema.parse({ variant: "B" }));
  assert.throws(() => HeroSchema.parse({ variant: "wide" }));
});

test("layout no longer carries a global variant", () => {
  assert.ok(!("variant" in LayoutSchema.parse({})));
});
