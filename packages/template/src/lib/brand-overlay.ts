/* Vendored from @hirobius/design-system/src/brand/overlay.ts (clients #42).
 * Dependency-free palette -> HDS-semantic bridge. Copied so the factory no
 * longer depends on the (now-frozen) @hirobius/design-system package; it only
 * ever used this ~130-line function + the token vars (see styles/tokens.css). */
/**
 * overlay.ts — pure palette → HDS-semantic overlay bridge.
 *
 * The seam that lets a downstream render target (a static Astro site, an email,
 * an SSR shell) theme itself from a small brand palette while inheriting HDS's
 * semantic contract — contrast-checked pairs, accent states, density, dark mode.
 *
 * A consumer resolves a brand palette (six colours + optional font/radius) and
 * this module maps it onto the HDS semantic custom properties. Everything HDS
 * ships downstream of those semantics (component tokens, utilities) then reads
 * the brand automatically via the `var()` reference chain — the same strategy
 * as the checked-in `[data-brand]` tenant overlays (`src/styles/tenants.css`),
 * but computed at the consumer instead of at HDS build time, so HDS never has
 * to know the client roster.
 *
 * Deliberately dependency-free (no React, no Node) so it runs in any render
 * target and is unit-testable in isolation. Mirrors the zero-dependency idiom
 * of `box-sx.ts`.
 *
 * Interactive accent states (hover/pressed/subtle) are derived from the primary
 * with CSS `color-mix()` — no colour-math dependency, resolved by the browser.
 * `color-mix()` is Baseline-supported (all evergreen engines since 2023); the
 * factory ships new sites, so this is a safe floor.
 *
 * @packageDocumentation
 */

/** A resolved brand palette — the minimal input needed to theme a surface. */
export interface BrandPalette {
  /** Primary brand colour — accent rest, key surfaces, links. */
  primary: string;
  /** Text/icon colour that sits on top of `primary`. */
  onPrimary: string;
  /** Page background. */
  bg: string;
  /** Body/foreground text colour. */
  fg: string;
  /** Muted surface — raised cards, subtle fills. */
  muted: string;
  /** Optional secondary accent. Kept brand-level (HDS has one accent ramp). */
  accent?: string;
  /** Optional corner radius as a CSS length (e.g. `'8px'`). */
  radius?: string;
  /** Optional heading font stack. */
  fontHeading?: string;
  /** Optional body font stack. */
  fontBody?: string;
  /**
   * Shadow-character dial (issue #157). `'soft'` (or omitted) leaves the
   * `--semantic-shadow-*` vars untouched — `tokens.css`'s own values ARE the
   * "soft" set, so this is what keeps the default path byte-identical.
   * `'flat'`/`'hard'` swap in {@link SHADOW_SETS}.
   */
  shadow?: 'flat' | 'soft' | 'hard';
  /**
   * Spacing-density dial (issue #86, spacing-density slice). `'comfortable'`
   * (or omitted) leaves the `--semantic-spacing-section-y*` vars untouched —
   * `tokens.css`'s own values ARE the "comfortable" set, so this is what keeps
   * the default path byte-identical. `'compact'`/`'airy'` swap in
   * {@link SPACING_DENSITY_SETS}. Scoped to section vertical rhythm only.
   */
  spacingDensity?: 'compact' | 'comfortable' | 'airy';
}

/**
 * The `flat` and `hard` shadow-tier sets for the `brand.shadow` dial
 * (issue #157). `soft` is deliberately absent — it's `tokens.css`'s existing
 * default, so leaving it out of this table (no override emitted) is what
 * guarantees the default path renders byte-identical.
 */
const SHADOW_SETS: Record<'flat' | 'hard', { subtle: string; floating: string; overlay: string }> = {
  // Depth cue moves to borders instead of shadow — a deliberately flat look.
  flat: {
    subtle: 'none',
    floating: 'none',
    overlay: 'none',
  },
  // Solid, no-blur offset shadows — a graphic/brutalist drop-shadow look.
  // Same offset:blur:opacity idiom as the `soft` tiers (subtle < floating <
  // overlay), just with blur zeroed and the offset carrying the weight.
  hard: {
    subtle: '2px 2px 0 0 hsl(var(--primitive-shadow-color) / 0.9)',
    floating: '4px 4px 0 0 hsl(var(--primitive-shadow-color) / 0.9)',
    overlay: '6px 6px 0 0 hsl(var(--primitive-shadow-color) / 0.9)',
  },
};

/**
 * The `compact` and `airy` tiers for the `brand.spacingDensity` dial
 * (issue #86, spacing-density slice). `comfortable` is deliberately absent —
 * it's `tokens.css`'s existing default (`--primitive-space-16`/`-20`, i.e.
 * `Section.astro`'s `py-16 sm:py-20`), so leaving it out of this table (no
 * override emitted) is what guarantees the default path renders
 * byte-identical. Both tiers keep the base→lg step on the same primitive
 * scale as the default (one scale rung apart), just shifted down/up it:
 * `compact` ~0.75-0.8x the comfortable values, `airy` ~1.5-1.6x.
 */
const SPACING_DENSITY_SETS: Record<'compact' | 'airy', { sectionY: string; sectionYLg: string }> = {
  compact: {
    sectionY: 'var(--primitive-space-12)', // 48px (comfortable: 64px)
    sectionYLg: 'var(--primitive-space-16)', // 64px (comfortable: 80px)
  },
  airy: {
    sectionY: 'var(--primitive-space-24)', // 96px (comfortable: 64px)
    sectionYLg: 'var(--primitive-space-32)', // 128px (comfortable: 80px)
  },
};

/** How dark/light a derived accent state sits relative to the primary. */
const ACCENT_HOVER_MIX = 88; // % primary, remainder black
const ACCENT_PRESSED_MIX = 76; // % primary, remainder black
const ACCENT_SUBTLE_MIX = 12; // % primary, remainder white
const CONTENT_SECONDARY_MIX = 66; // % fg, remainder bg

const darken = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, #000)`;
const lighten = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, #fff)`;
const blend = (a: string, b: string, pct: number) => `color-mix(in srgb, ${a} ${pct}%, ${b})`;

/**
 * Map a brand palette onto HDS semantic (and a few primitive) custom
 * properties. Returns a flat `--var` → value record; the caller decides how to
 * apply it (inline style string via {@link brandOverlayStyle} or a scoped CSS
 * rule via {@link brandOverlayCss}).
 *
 * Only the accent ramp, page/content colours, and — when provided — radius and
 * font families are overridden. All other semantics inherit HDS defaults
 * unchanged, so a partial palette still yields a coherent theme.
 */
export function brandOverlayVars(palette: BrandPalette): Record<string, string> {
  const { primary, onPrimary, bg, fg, muted, accent, radius, fontHeading, fontBody, shadow, spacingDensity } =
    palette;

  const vars: Record<string, string> = {
    // ── accent ramp (rest + derived interactive states) ──
    '--semantic-accent-rest': primary,
    '--semantic-accent-hover': darken(primary, ACCENT_HOVER_MIX),
    '--semantic-accent-pressed': darken(primary, ACCENT_PRESSED_MIX),
    '--semantic-accent-subtle': lighten(primary, ACCENT_SUBTLE_MIX),
    '--semantic-accent-content': primary,
    '--semantic-color-surface-accent': primary,
    '--semantic-color-surface-accentSubtle': lighten(primary, ACCENT_SUBTLE_MIX),
    '--semantic-color-border-accent': primary,
    '--semantic-color-content-onAccent': onPrimary,
    // ── page + content ──
    '--semantic-color-surface-page': bg,
    '--semantic-color-surface-raised': muted,
    '--semantic-color-content-primary': fg,
    '--semantic-color-content-secondary': blend(fg, bg, CONTENT_SECONDARY_MIX),
    // `fg` is the one surface dark enough to use as an inverted (dark) hero
    // background (`bg-fg`); `bg` is guaranteed high-contrast against it, since
    // fg/bg is already the page's base body-text/background pairing. Pairing
    // hero text with `onPrimary` instead (designed for `primary`, not `fg`)
    // was issue #79 — near-black-on-near-black on the junk-removal preset.
    '--semantic-color-content-inverse': bg,
  };

  // Secondary accent has no 1:1 HDS home — kept brand-level (Adrian, 2026-07-08).
  if (accent) vars['--brand-accent'] = accent;

  if (radius) {
    vars['--semantic-radius-action'] = radius;
    // Pass-through for consumers whose utility layer still reads --brand-radius.
    vars['--brand-radius'] = radius;
  }

  if (fontHeading) vars['--primitive-typography-family-display'] = fontHeading;
  if (fontBody) vars['--primitive-typography-family-primary'] = fontBody;

  if (shadow && shadow !== 'soft') {
    const set = SHADOW_SETS[shadow];
    vars['--semantic-shadow-subtle'] = set.subtle;
    vars['--semantic-shadow-floating'] = set.floating;
    vars['--semantic-shadow-overlay'] = set.overlay;
  }

  if (spacingDensity && spacingDensity !== 'comfortable') {
    const set = SPACING_DENSITY_SETS[spacingDensity];
    vars['--semantic-spacing-section-y'] = set.sectionY;
    vars['--semantic-spacing-section-y-lg'] = set.sectionYLg;
  }

  return vars;
}

/**
 * Serialize a palette to an inline `style` string (`k:v;k:v`) for the `<html>`
 * element. Inline element styles beat stylesheet rules, so this is the most
 * direct per-surface theming path (the model the clients factory already uses).
 */
export function brandOverlayStyle(palette: BrandPalette): string {
  return Object.entries(brandOverlayVars(palette))
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
}

/**
 * Serialize a palette to a scoped CSS rule (`<selector>{ --var: value; }`) for
 * a static stylesheet — e.g. `[data-brand="acme"]` blocks in an Astro layout,
 * mirroring the checked-in tenant overlays. `selector` is emitted verbatim; the
 * caller owns its trust (typically a slug it controls).
 */
export function brandOverlayCss(selector: string, palette: BrandPalette): string {
  const body = Object.entries(brandOverlayVars(palette))
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
  return `${selector} {\n${body}\n}`;
}
