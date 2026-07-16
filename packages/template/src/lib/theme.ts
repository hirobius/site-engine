import type { ClientConfig } from "@hirobius/schema";
import { PALETTE_PRESETS, FONT_STACKS, FONT_PAIRINGS, type PaletteTokens } from "@hirobius/schema/presets";
import { brandOverlayStyle } from "./brand-overlay";

const RADIUS_PX: Record<ClientConfig["brand"]["radius"], string> = {
  none: "0px",
  sm: "4px",
  md: "8px",
  lg: "14px",
  xl: "22px",
};

/**
 * Google Fonts hrefs for the non-system stacks. `null` => no web load needed.
 * `inter`/`geist` trip impeccable's overused-font rule — deliberate: these
 * are two of five selectable `brand.font` options a client site picks
 * explicitly (not an engine-imposed default); `inter` is a live choice
 * today (e.g. `apps/monroe-street-power-wash`). Disabled inline rather
 * than dropped.
 */
const FONT_HREFS: Record<keyof typeof FONT_STACKS, string | null> = {
  system: null,
  inter: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap", // impeccable-disable-line overused-font -- selectable brand.font option, not the engine default
  geist: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap", // impeccable-disable-line overused-font -- selectable brand.font option, not the engine default
  "work-sans":
    "https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600;700&display=swap",
  slab: "https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400;500;700&display=swap",
};

// Every non-system pairing uses Inter for the body stack at this same weight
// range as `FONT_HREFS.inter` above — factored out so it's declared once
// instead of repeated verbatim in every pairing href below.
const INTER_FAMILY_PARAM = "family=Inter:wght@400;500;600;700";

/**
 * Google Fonts hrefs for `brand.fontPairing` (issue #155) — one stylesheet
 * link carrying both families (Google's css2 API accepts repeated `family=`
 * params) so a pairing still costs one `<link rel="stylesheet">` + the
 * shared preconnect pair in `BaseHead.astro`. `system` needs no web load —
 * it's the same system stack both places, matching the plain `brand.font`
 * "system" behavior. `editorial`/`modern` trip impeccable's overused-font
 * rule on Fraunces/Space Grotesk — deliberate: these are curated heading
 * faces paired against Inter body text, two of five selectable
 * `brand.fontPairing` art directions a client site opts into, not an
 * engine-imposed default.
 */
const FONT_PAIRING_HREFS: Record<keyof typeof FONT_PAIRINGS, string | null> = {
  system: null,
  editorial: `https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600;700&${INTER_FAMILY_PARAM}&display=swap`, // impeccable-disable-line overused-font -- selectable brand.fontPairing option, not the engine default
  modern: `https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&${INTER_FAMILY_PARAM}&display=swap`, // impeccable-disable-line overused-font -- selectable brand.fontPairing option, not the engine default
  industrial: `https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700&${INTER_FAMILY_PARAM}&display=swap`,
  slab: `https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400;500;700&${INTER_FAMILY_PARAM}&display=swap`,
};

/**
 * Resolve the heading/body font stacks for a config. When `brand.fontPairing`
 * is unset (the default), both stacks come from `brand.font` — today's
 * single-stack behavior, unchanged — so this is the seam that keeps the
 * default path byte-identical. When set, the pairing's own heading/body
 * stacks win and `brand.font` is not consulted for the pair.
 */
function resolveFontStacks(config: ClientConfig): { fontHeading: string; fontBody: string } {
  const { fontPairing, font } = config.brand;
  if (fontPairing) {
    const pairing = FONT_PAIRINGS[fontPairing];
    return { fontHeading: pairing.heading, fontBody: pairing.body };
  }
  const stack = FONT_STACKS[font];
  return { fontHeading: stack, fontBody: stack };
}

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
 * properties via the vendored `./brand-overlay` bridge (clients#42; originally
 * `@hirobius/design-system/brand`, hirobius/design-system#64), so a client site
 * inherits HDS's contrast-checked semantics, `color-mix`-derived accent states,
 * and radius — one token spine, not a parallel `--brand-*` system.
 * The secondary `--brand-accent` is passed through by the bridge (HDS owns a
 * single accent ramp, so it stays brand-level).
 */
export function brandStyle(config: ClientConfig): string {
  const palette = resolvePalette(config);
  const { fontHeading, fontBody } = resolveFontStacks(config);
  return brandOverlayStyle({
    primary: palette["--brand-primary"],
    onPrimary: palette["--brand-on-primary"],
    bg: palette["--brand-bg"],
    fg: palette["--brand-fg"],
    muted: palette["--brand-muted"],
    accent: palette["--brand-accent"],
    radius: RADIUS_PX[config.brand.radius],
    fontHeading,
    fontBody,
    shadow: config.brand.shadow,
    spacingDensity: config.brand.spacingDensity,
  });
}

/**
 * Web font href to preconnect+load, or `null` when no web font is needed.
 * `brand.fontPairing`, when set, wins over `brand.font` (mirrors
 * {@link resolveFontStacks}) since the pairing dictates both stacks.
 */
export function fontHref(config: ClientConfig): string | null {
  if (config.brand.fontPairing) {
    return FONT_PAIRING_HREFS[config.brand.fontPairing];
  }
  return FONT_HREFS[config.brand.font];
}

/** Canonical `tel:` href from a display phone number. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
