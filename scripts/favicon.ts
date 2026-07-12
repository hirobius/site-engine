/**
 * generateFaviconSvg — the scaffold's default monogram favicon (issue #106).
 *
 * Single source of truth for both `new-client` (per-client generation at
 * scaffold time) and `apps/_template`'s own stub favicon, so the two never
 * drift. A client's real logo simply overwrites the generated file later.
 */
import { PALETTE_PRESETS, type PalettePresetId } from "../packages/schema/src/presets.js";

const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

function escapeXml(char: string): string {
  return XML_ESCAPES[char] ?? char;
}

/** First character of the business name, uppercased and XML-escaped. */
export function faviconInitial(name: string): string {
  const char = name.trim().charAt(0) || "A";
  return escapeXml(char.toUpperCase());
}

export function generateFaviconSvg(name: string, preset: PalettePresetId): string {
  const { "--brand-primary": primary, "--brand-on-primary": onPrimary } = PALETTE_PRESETS[preset];
  const initial = faviconInitial(name);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="${primary}" />
  <text x="16" y="22" font-family="system-ui, sans-serif" font-size="16" font-weight="700" fill="${onPrimary}" text-anchor="middle">${initial}</text>
</svg>
`;
}
