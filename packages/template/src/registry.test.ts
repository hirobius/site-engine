import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SECTION_VARIANTS } from "@hirobius/schema";
import { SECTION_COMPONENTS, SECTION_VARIANT_COMPONENTS } from "./index.js";

const componentsDir = fileURLToPath(new URL("./components", import.meta.url));

describe("SECTION_VARIANT_COMPONENTS", () => {
  it("covers exactly the sections in SECTION_VARIANTS", () => {
    expect(Object.keys(SECTION_VARIANT_COMPONENTS).sort()).toEqual(
      Object.keys(SECTION_VARIANTS).sort(),
    );
  });

  it.each(Object.keys(SECTION_VARIANTS) as Array<keyof typeof SECTION_VARIANTS>)(
    "maps every %s variant to a component file, no extras",
    (section) => {
      expect(Object.keys(SECTION_VARIANT_COMPONENTS[section]).sort()).toEqual(
        [...SECTION_VARIANTS[section]].sort(),
      );
    },
  );

  it("points every variant at a component file that exists on disk", () => {
    for (const [section, variants] of Object.entries(SECTION_VARIANT_COMPONENTS)) {
      for (const [variant, file] of Object.entries(variants)) {
        expect(
          existsSync(join(componentsDir, file)),
          `${section}.${variant} -> components/${file} is missing`,
        ).toBe(true);
      }
    }
  });
});

describe("SECTION_COMPONENTS", () => {
  it("points every orderable section at a component file that exists on disk", () => {
    for (const [section, file] of Object.entries(SECTION_COMPONENTS)) {
      expect(existsSync(join(componentsDir, file)), `${section} -> components/${file} is missing`).toBe(
        true,
      );
    }
  });
});
