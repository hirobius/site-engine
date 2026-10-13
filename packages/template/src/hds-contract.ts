/**
 * hds-contract.ts — the HDS name contract (ADR-0005), as code.
 *
 * `styles/tokens.css` holds the factory's own token VALUES (forked from
 * @hirobius/design-system in July 2026, versioned with @hirobius/template, so
 * an HDS release never restyles a client site). The NAMES are HDS's. This
 * module is the one place that says what that means: the parsers that turn a
 * stylesheet or a bridge source into custom-property names, the names the
 * factory owns outright, and the drift check. The refresh script
 * (`../scripts/refresh-hds-contract.ts`) writes `../hds-contract.snapshot.json`
 * with these parsers and the test (`hds-contract.test.ts`) reads the template
 * with the same ones, so the writer and the reader cannot drift apart.
 *
 * Pure: strings in, names out. No I/O here.
 */

/** What `pnpm template:snapshot-hds` records from the published package. */
export interface HdsContractSnapshot {
  note?: string;
  package: string;
  version: string;
  /** Every custom property `dist/variables.css` declares. */
  variables: string[];
  bridge: {
    /** The `BrandPalette` fields HDS's `@hirobius/design-system/brand` accepts. */
    fields: string[];
    /** Every custom property HDS's bridge writes. */
    writes: string[];
  };
}

/** What the template side of the contract consists of. */
export interface TemplateNames {
  /** Custom properties `styles/tokens.css` declares. */
  declared: string[];
  /** Custom properties `lib/brand-overlay.ts` writes. */
  written: string[];
  /** HDS-namespaced custom properties the template's components and styles read through `var()`. */
  read: string[];
  /** The fields of the template's `BrandPalette`. */
  paletteFields: string[];
}

export interface ContractDrift {
  /** `tokens.css` declares these; HDS no longer publishes them and the factory does not own them. */
  unknownDeclared: string[];
  /** The bridge writes these; HDS no longer publishes them and the factory does not own them. */
  unknownWritten: string[];
  /** Components read these HDS-namespaced names, but neither `tokens.css` nor the bridge provides them. */
  unresolvedReads: string[];
  /** Factory-owned names HDS now publishes too: two owners, pick one. */
  collisions: string[];
  /** HDS's bridge writes these; ours does not. */
  missingWrites: string[];
  /** HDS's `BrandPalette` has these fields; ours does not. */
  missingFields: string[];
}

/**
 * Custom properties the factory owns outright, by name: the dials HDS has no
 * token for. A new dial adds its names here, a reviewed diff; the test fails
 * if HDS ever publishes one of them, so an accidental collision cannot pass.
 */
export const FACTORY_OWNED: readonly string[] = ["--semantic-spacing-section-y", "--semantic-spacing-section-y-lg"];

/**
 * The `--brand-*` palette keys: written by both bridges (HDS's writes
 * `--brand-accent` and `--brand-radius`) for the consumer's own stylesheet
 * (`theme.css`'s `@theme` reads them), never part of the token spine on either
 * side, so they are outside the names contract.
 */
export const PALETTE_KEY = /^--brand-/;

/** The namespaces whose names belong to HDS; a `var()` read of one must resolve inside the factory. */
const HDS_NAMESPACE = /^--(semantic|primitive|component)-[A-Za-z0-9]/;

const CUSTOM_PROPERTY = "--[A-Za-z0-9-]+";

function captures(text: string, pattern: RegExp): string[] {
  const found = [...text.matchAll(pattern)].map((match) => match[1]).filter((value): value is string => value !== undefined);
  return [...new Set(found)].sort();
}

/** Custom properties a stylesheet declares (`--name: value`). */
export function declaredNames(css: string): string[] {
  return captures(css, new RegExp(`(${CUSTOM_PROPERTY})\\s*:`, "g"));
}

/** Custom properties a bridge writes: the quoted `'--name'` keys of its vars record. */
export function writtenNames(source: string): string[] {
  return captures(source, new RegExp(`["'](${CUSTOM_PROPERTY})["']`, "g"));
}

/** HDS-namespaced custom properties a source reads through `var(--name)`. */
export function readNames(source: string): string[] {
  return captures(source, new RegExp(`var\\(\\s*(${CUSTOM_PROPERTY})`, "g")).filter((name) => HDS_NAMESPACE.test(name));
}

/** The field names of the `BrandPalette` interface in a bridge source or its `.d.ts`. */
export function brandPaletteFields(source: string): string[] {
  const block = source.match(/interface BrandPalette \{([\s\S]*?)\n\}/)?.[1] ?? "";
  return captures(block, /^\s+(\w+)\??:/gm);
}

/** Compare the template against the snapshot. Every list empty means the contract holds. */
export function contractDrift(snapshot: HdsContractSnapshot, template: TemplateNames): ContractDrift {
  const hds = new Set(snapshot.variables);
  const owned = new Set(FACTORY_OWNED);
  const provided = new Set([...template.declared, ...template.written]);
  const known = (name: string) => hds.has(name) || owned.has(name);

  return {
    unknownDeclared: template.declared.filter((name) => !known(name)),
    unknownWritten: template.written.filter((name) => !PALETTE_KEY.test(name) && !known(name)),
    unresolvedReads: template.read.filter((name) => !provided.has(name)),
    collisions: [...provided].filter((name) => owned.has(name) && hds.has(name)).sort(),
    missingWrites: snapshot.bridge.writes.filter((name) => !template.written.includes(name)),
    missingFields: snapshot.bridge.fields.filter((field) => !template.paletteFields.includes(field)),
  };
}
