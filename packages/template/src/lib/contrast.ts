/**
 * WCAG 2.x contrast utilities for brand hex tokens.
 *
 * Used to guardrail token pairs (primary/on-primary, fg/bg) so a preset or
 * `cssVarOverrides` can't ship illegible text — see issue #79, where
 * junk-removal's `bg-fg text-on-primary` hero paired `--brand-on-primary`
 * (#0d0d0d) against `--brand-fg` (#161616), ~1.07:1.
 */

/** WCAG AA threshold for normal-size text (18px and under bold). */
export const WCAG_AA_NORMAL_TEXT = 4.5;

function expandHex(hex: string): string {
  const stripped = hex.replace("#", "");
  return stripped.length === 3
    ? stripped
        .split("")
        .map((c) => c + c)
        .join("")
    : stripped;
}

function channelLuminance(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a hex color (`#rgb` or `#rrggbb`), 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const full = expandHex(hex);
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/** WCAG contrast ratio between two hex colors, from 1 (no contrast) to 21. */
export function contrastRatio(a: string, b: string): number {
  const lumA = relativeLuminance(a);
  const lumB = relativeLuminance(b);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** True when a hex pair meets WCAG AA for normal-size text (>= 4.5:1). */
export function meetsAAContrast(a: string, b: string): boolean {
  return contrastRatio(a, b) >= WCAG_AA_NORMAL_TEXT;
}
