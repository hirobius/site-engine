/**
 * Trade palette presets.
 *
 * Each preset is a set of semantic brand tokens. Apps map these to Tailwind via
 * `@theme` (see packages/template/src/styles/theme.css) by way of `--brand-*`
 * CSS custom properties injected at build time from the resolved config.
 *
 * Keep these to the four shipped trades. Per-client tweaks belong in
 * `brand.cssVarOverrides`, NOT in new presets — adding a preset is a product
 * decision, overriding a var is a config-only customization.
 */

export const PALETTE_PRESET_IDS = [
  "landscaping",
  "junk-removal",
  "pressure-washing",
  "concrete-fencing",
] as const;

export type PalettePresetId = (typeof PALETTE_PRESET_IDS)[number];

/** The semantic tokens every preset must define. Mirrors theme.css `@theme`. */
export interface PaletteTokens {
  /** Primary brand color — buttons, links, key accents. */
  "--brand-primary": string;
  /** Secondary / highlight color. */
  "--brand-accent": string;
  /** Page background. */
  "--brand-bg": string;
  /** Default foreground / body text. */
  "--brand-fg": string;
  /** Muted surface (cards, alternating sections). */
  "--brand-muted": string;
  /** Text/icon color that sits on top of `--brand-primary`. */
  "--brand-on-primary": string;
}

export const PALETTE_PRESETS: Record<PalettePresetId, PaletteTokens> = {
  landscaping: {
    "--brand-primary": "#2f6f3e",
    "--brand-accent": "#a7c957",
    "--brand-bg": "#f7f8f3",
    "--brand-fg": "#1f2a1c",
    "--brand-muted": "#e7ecdd",
    "--brand-on-primary": "#ffffff",
  },
  "junk-removal": {
    "--brand-primary": "#f26419",
    "--brand-accent": "#ffb703",
    "--brand-bg": "#ffffff",
    "--brand-fg": "#161616",
    "--brand-muted": "#f3f0ec",
    "--brand-on-primary": "#0d0d0d",
  },
  "pressure-washing": {
    "--brand-primary": "#0a6cb5",
    "--brand-accent": "#21d4c4",
    "--brand-bg": "#f4fafd",
    "--brand-fg": "#0b2230",
    "--brand-muted": "#dceef6",
    "--brand-on-primary": "#ffffff",
  },
  "concrete-fencing": {
    "--brand-primary": "#3f4754",
    "--brand-accent": "#c9a227",
    "--brand-bg": "#f2f3f5",
    "--brand-fg": "#1b1f26",
    "--brand-muted": "#e2e4e8",
    "--brand-on-primary": "#ffffff",
  },
};

/** Built-in font stacks keyed by `brand.font`. Self-hostable; no FOUT risk. */
export const FONT_STACKS = {
  system:
    "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  inter:
    "'Inter', ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  geist:
    "'Geist', ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  "work-sans":
    "'Work Sans', ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  slab:
    "'Roboto Slab', Georgia, Cambria, 'Times New Roman', serif",
} as const;

export type FontId = keyof typeof FONT_STACKS;
export const FONT_IDS = Object.keys(FONT_STACKS) as [FontId, ...FontId[]];

/**
 * Heading↔body font pairings for the optional `brand.fontPairing` dial
 * (issue #155). `brand.font` alone applies one stack to both headings and
 * body — no type contrast, one driver of the "every site looks the same"
 * audit finding. Each pairing frees the two apart; all are self-hostable
 * Google Fonts (see `FONT_PAIRING_HREFS` in `packages/template/src/lib/theme.ts`).
 *
 * `brand.fontPairing` is optional and consulted ONLY when set —
 * `lib/theme.ts` derives both stacks from `brand.font` (today's behavior)
 * when it's omitted, so this table never affects an existing config and
 * every existing site renders byte-identical.
 *
 * `system` reproduces the plain `brand.font` "system" behavior verbatim
 * (same stack both places, no web font) so it's available as an explicit
 * choice, e.g. to opt back out of a pairing without unsetting the field.
 */
export const FONT_PAIRINGS = {
  system: {
    heading: FONT_STACKS.system,
    body: FONT_STACKS.system,
  },
  editorial: {
    heading: "'Fraunces', Georgia, Cambria, 'Times New Roman', serif",
    body: FONT_STACKS.inter,
  },
  modern: {
    heading:
      "'Space Grotesk', ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    body: FONT_STACKS.inter,
  },
  industrial: {
    heading: "'Archivo', ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    body: FONT_STACKS.inter,
  },
  slab: {
    heading: FONT_STACKS.slab,
    body: FONT_STACKS.inter,
  },
} as const;

export type FontPairingId = keyof typeof FONT_PAIRINGS;
export const FONT_PAIRING_IDS = Object.keys(FONT_PAIRINGS) as [FontPairingId, ...FontPairingId[]];
