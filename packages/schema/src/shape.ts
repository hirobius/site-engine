import type { ZodTypeAny } from "zod";
import { PALETTE_PRESET_IDS, PALETTE_PRESETS, FONT_IDS, FONT_STACKS } from "./presets.js";

/**
 * Structural shape of a Zod type, extracted via its internal `_def`
 * (undocumented, but stable enough for this — zod-to-json-schema relies on
 * the same fields). Captures field keys, nesting, and primitive kind while
 * ignoring check-level details (regex patterns, min/max, refinements) that
 * legitimately differ between this TS source and ops's hand-converted
 * `.mjs` vendor copy — those aren't part of the *contract shape*.
 */
export type SchemaShape =
  | { kind: "object"; fields: Record<string, FieldEntry> }
  | { kind: "array"; of: FieldEntry }
  | { kind: "record"; of: FieldEntry }
  | { kind: "enum"; values: string[] }
  | { kind: "literal"; value: string | number | boolean }
  | { kind: "primitive"; type: string }
  | { kind: "unknown"; typeName: string };

export interface FieldEntry {
  shape: SchemaShape;
  optional: boolean;
  hasDefault: boolean;
}

function unwrap(schema: ZodTypeAny): {
  inner: ZodTypeAny;
  optional: boolean;
  hasDefault: boolean;
} {
  let optional = false;
  let hasDefault = false;
  // Zod's runtime `_def` shape isn't exposed in the public types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = schema;
  for (;;) {
    const typeName = current._def?.typeName;
    if (typeName === "ZodOptional" || typeName === "ZodNullable") {
      optional = true;
      current = current._def.innerType;
      continue;
    }
    if (typeName === "ZodDefault") {
      hasDefault = true;
      current = current._def.innerType;
      continue;
    }
    break;
  }
  return { inner: current, optional, hasDefault };
}

function shapeOfInner(schema: ZodTypeAny): SchemaShape {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def = (schema as any)._def;
  switch (def.typeName) {
    case "ZodObject": {
      const rawShape = def.shape() as Record<string, ZodTypeAny>;
      const fields: Record<string, FieldEntry> = {};
      for (const key of Object.keys(rawShape).sort()) {
        fields[key] = shapeOf(rawShape[key] as ZodTypeAny);
      }
      return { kind: "object", fields };
    }
    case "ZodArray":
      return { kind: "array", of: shapeOf(def.type as ZodTypeAny) };
    case "ZodRecord":
      return { kind: "record", of: shapeOf(def.valueType as ZodTypeAny) };
    case "ZodEnum":
      return { kind: "enum", values: [...(def.values as string[])].sort() };
    case "ZodLiteral":
      return { kind: "literal", value: def.value };
    case "ZodString":
      return { kind: "primitive", type: "string" };
    case "ZodNumber":
      return { kind: "primitive", type: "number" };
    case "ZodBoolean":
      return { kind: "primitive", type: "boolean" };
    default:
      return { kind: "unknown", typeName: def.typeName ?? "?" };
  }
}

/** Normalize a Zod schema (field) into a comparable, JSON-serializable shape. */
export function shapeOf(schema: ZodTypeAny): FieldEntry {
  const { inner, optional, hasDefault } = unwrap(schema);
  return { shape: shapeOfInner(inner), optional, hasDefault };
}

export interface PresetsShape {
  palettePresetIds: string[];
  fontIds: string[];
  paletteTokenKeys: string[];
  fontStackKeys: string[];
}

/** Normalize `presets.ts`'s exports (not Zod — plain id lists + token maps). */
export function presetsShape(): PresetsShape {
  const firstPreset = PALETTE_PRESET_IDS[0];
  return {
    palettePresetIds: [...PALETTE_PRESET_IDS].sort(),
    fontIds: [...FONT_IDS].sort(),
    paletteTokenKeys: Object.keys(PALETTE_PRESETS[firstPreset]).sort(),
    fontStackKeys: Object.keys(FONT_STACKS).sort(),
  };
}

/**
 * Deep-diff two JSON-serializable values, returning one human-readable line
 * per differing path. Empty result means the shapes match.
 */
export function diffShapes(a: unknown, b: unknown, path = "$"): string[] {
  if (a === b) return [];
  if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b)) {
    return [`${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`];
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return JSON.stringify(a) === JSON.stringify(b)
      ? []
      : [`${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`];
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const diffs: string[] = [];
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      diffs.push(
        ...diffShapes(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
          `${path}.${key}`,
        ),
      );
    }
    return diffs;
  }
  return [`${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`];
}
