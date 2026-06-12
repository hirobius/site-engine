import type { ClientConfig } from "@hirobius/schema";
import { PALETTE_PRESETS, FONT_STACKS } from "@hirobius/schema/presets";

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
export function resolvePalette(config: ClientConfig): Record<string, string> {
  const preset = PALETTE_PRESETS[config.brand.palettePreset];
  return { ...preset, ...config.brand.cssVarOverrides };
}

/**
 * Build the inline style string for the <html> element. Inline element styles
 * beat stylesheet rules, so this is what actually themes the page per client.
 */
export function brandStyle(config: ClientConfig): string {
  const palette = resolvePalette(config);
  const stack = FONT_STACKS[config.brand.font];
  const vars: Record<string, string> = {
    ...palette,
    "--brand-font-heading": stack,
    "--brand-font-body": stack,
    "--brand-radius": RADIUS_PX[config.brand.radius],
  };
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}

/** Web font href to preconnect+load, or `null` for the system stack. */
export function fontHref(config: ClientConfig): string | null {
  return FONT_HREFS[config.brand.font];
}

/** Canonical `tel:` href from a display phone number. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
