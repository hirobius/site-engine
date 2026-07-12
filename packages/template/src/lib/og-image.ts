import sharp from "sharp";
import type { ClientConfig } from "@hirobius/schema";
import { FONT_STACKS } from "@hirobius/schema/presets";
import { resolvePalette } from "./theme.js";

/**
 * Branded OG card, generated at build time when a client doesn't supply
 * `seo.ogImage` (issue #105). Sharp-only SVG->PNG composite — no new
 * dependency, `sharp` is already in every app's stack for astro:assets.
 * Escalate to `astro-og-canvas` (pre-approved, see issue #105) only if this
 * typography doesn't hold up under review.
 */

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

/** Public path the generated card is written to and referenced from. */
export const OG_IMAGE_PATH = "/og-image.png";

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&apos;";
    }
  });
}

/** "pressure-washing" -> "Pressure Washing". */
function tradeLabel(palettePreset: ClientConfig["brand"]["palettePreset"]): string {
  return palettePreset
    .split("-")
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(" ");
}

function truncate(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, maxChars - 1).trimEnd()}…` : text;
}

/** Bold sans-serif average glyph width as a fraction of font size — a
 *  deliberately generous estimate (real fonts run narrower) so the fit below
 *  never lets a headline overflow the card into the decorative circles. */
const AVG_GLYPH_WIDTH_RATIO = 0.62;

/** Font sizes tried largest-first when fitting the headline. */
const HEADLINE_FONT_SIZES = [72, 60, 50, 42, 36, 32] as const;

function estimatedTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * AVG_GLYPH_WIDTH_RATIO;
}

/**
 * Long business names shrink first, then truncate at the smallest size —
 * never overflow the card. Width is estimated (no real font metrics
 * available at SVG-string build time), so this is deliberately conservative.
 */
function fitHeadline(name: string, availableWidth: number): { text: string; fontSize: number } {
  for (const fontSize of HEADLINE_FONT_SIZES) {
    if (estimatedTextWidth(name, fontSize) <= availableWidth) return { text: name, fontSize };
  }
  const smallest = HEADLINE_FONT_SIZES[HEADLINE_FONT_SIZES.length - 1]!;
  const maxChars = Math.floor(availableWidth / (smallest * AVG_GLYPH_WIDTH_RATIO));
  return { text: truncate(name, maxChars), fontSize: smallest };
}

/** Build the 1200x630 OG card as an SVG string (business name + trade/city line, on the resolved brand palette). */
export function ogImageSvg(config: ClientConfig): string {
  const palette = resolvePalette(config);
  const fontFamily = FONT_STACKS[config.brand.font];
  const bg = palette["--brand-bg"];
  const fg = palette["--brand-fg"];
  const primary = palette["--brand-primary"];
  const accent = palette["--brand-accent"];

  const barWidth = 28;
  const padX = barWidth + 88;
  const rightMargin = 64;
  const availableWidth = OG_IMAGE_WIDTH - padX - rightMargin;

  const headline = fitHeadline(config.business.name, availableWidth);
  const sublineFontSize = 32;
  const sublineMaxChars = Math.floor(availableWidth / (sublineFontSize * AVG_GLYPH_WIDTH_RATIO));
  const subline = truncate(
    `${tradeLabel(config.brand.palettePreset)} · ${config.seo.city}, ${config.seo.region}`,
    sublineMaxChars,
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}">
  <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="${bg}" />
  <circle cx="${OG_IMAGE_WIDTH - 90}" cy="90" r="150" fill="${accent}" opacity="0.16" />
  <circle cx="${OG_IMAGE_WIDTH - 30}" cy="${OG_IMAGE_HEIGHT - 40}" r="100" fill="${primary}" opacity="0.12" />
  <rect width="${barWidth}" height="${OG_IMAGE_HEIGHT}" fill="${primary}" />
  <text x="${padX}" y="300" font-family="${fontFamily}" font-size="${headline.fontSize}" font-weight="700" fill="${fg}">${escapeXml(headline.text)}</text>
  <rect x="${padX}" y="336" width="72" height="8" rx="4" fill="${accent}" />
  <text x="${padX}" y="404" font-family="${fontFamily}" font-size="${sublineFontSize}" font-weight="600" fill="${primary}">${escapeXml(subline)}</text>
</svg>`;
}

/** Rasterize the branded OG card to a PNG buffer. */
export async function renderOgImagePng(config: ClientConfig): Promise<Buffer> {
  return sharp(Buffer.from(ogImageSvg(config))).png().toBuffer();
}
