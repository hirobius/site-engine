import type { ClientConfig } from "@hirobius/schema";
import { PALETTE_PRESETS, FONT_STACKS, type PaletteTokens } from "@hirobius/schema/presets";
import { brandOverlayStyle } from "@hirobius/design-system/brand";

const RADIUS_PX: Record<ClientConfig["brand"]["radius"], string> = {
  none: "0px",
  sm: "4px",
  md: "8px",
  lg: "14px",
  xl: "22px",
};

/** Google Fonts hrefs for the non-system stacks. `null` => no web load needed. */
const FONT_HREFS: Record<keyof typeof FONT_STACKS, string | null> = {
  system: null,
  inter: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
  geist: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap",
  "work-sans":
    "https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600;700&display=swap",
  slab: "https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400;500;700&display=swap",
};

/**
 * Resolve a client's palette: preset tokens merged with `cssVarOverrides`.
 * Overrides win. Returns a flat `--brand-*` => value map.
 */
export function resolvePalette(config: ClientConfig): PaletteTokens {
  const preset = PALETTE_PRESETS[config.brand.palettePreset];
  return { ...preset, ...config.brand.cssVarOverrides };
}

/**
 * Build the inline style string for the <html> element. Inline element styles
 * beat stylesheet rules, so this is what actually themes the page per client.
 *
 * The resolved `--brand-*` palette is mapped onto the HDS semantic custom
 * properties via `@hirobius/design-system/brand` (hirobius/design-system#64), so
 * a client site inherits HDS's contrast-checked semantics, `color-mix`-derived
 * accent states, and radius — one token spine, not a parallel `--brand-*` system.
 * The secondary `--brand-accent` is passed through by the bridge (HDS owns a
 * single accent ramp, so it stays brand-level).
 */
export function brandStyle(config: ClientConfig): string {
  const palette = resolvePalette(config);
  const stack = FONT_STACKS[config.brand.font];
  return brandOverlayStyle({
    primary: palette["--brand-primary"],
    onPrimary: palette["--brand-on-primary"],
    bg: palette["--brand-bg"],
    fg: palette["--brand-fg"],
    muted: palette["--brand-muted"],
    accent: palette["--brand-accent"],
    radius: RADIUS_PX[config.brand.radius],
    fontHeading: stack,
    fontBody: stack,
  });
}

/** Web font href to preconnect+load, or `null` for the system stack. */
export function fontHref(config: ClientConfig): string | null {
  return FONT_HREFS[config.brand.font];
}

/** Canonical `tel:` href from a display phone number. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
