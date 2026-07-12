/**
 * Template purity checker — the deterministic gate behind the harvest rules
 * (docs/harvesting.md). Every `.astro` component in this package must be
 * schema-driven and semantic-token-only, so a harvested section can never
 * smuggle in literal colors, its own fonts, third-party scripts, or new
 * dependencies. Config-editing agents never touch these files (Zod's closed
 * variant enums are that wall); this gate guards the harvesting sessions
 * themselves.
 *
 * Lexical by design: it can't judge whether a token PAIRING is right (that's
 * acceptance.ts's contrast check + code review) — it only rejects what should
 * never appear at all. Exceptions live in the allowlists below so every
 * escape hatch is a reviewed diff, not a silent bypass.
 */

export interface PurityViolation {
  rule:
    | "literal-color"
    | "palette-class"
    | "arbitrary-value"
    | "script"
    | "import"
    | "external-url"
    | "font-face"
    | "css-import";
  line: number;
  excerpt: string;
}

export interface PurityOptions {
  /** Component is allowed to ship `<script>` / `client:` islands. */
  allowScripts?: boolean;
  /** Component is allowed to reference external (https) endpoints. */
  allowExternalUrls?: boolean;
}

/**
 * Components allowed to ship JavaScript, each with the reason. Adding a file
 * here is a deliberate, reviewed decision — new harvested variants reuse the
 * Motion island's CSS classes instead of bringing their own scripts.
 */
export const SCRIPT_ALLOWLIST: ReadonlyArray<{ file: string; reason: string }> = [
  { file: "hero/video.astro", reason: "reduced-motion-guarded video playback starter (WCAG 2.2.2)" },
  { file: "BaseHead.astro", reason: "JSON-LD structured data script tag" },
  { file: "Motion.astro", reason: "the one IntersectionObserver motion island" },
  { file: "Document.astro", reason: "motion-ready class bootstrap, reduced-motion-guarded" },
  { file: "ContactForm.astro", reason: "hCaptcha loader — spam protection is a day-one requirement" },
  { file: "ServiceAreaMap.astro", reason: "lazy-mounts the maps iframe near viewport to protect LCP" },
];

/**
 * Components allowed to reference external URLs, each with the reason.
 * Harvested variants get their imagery via astro:assets and their fonts via
 * the theme — they never need this.
 */
export const EXTERNAL_URL_ALLOWLIST: ReadonlyArray<{ file: string; reason: string }> = [
  { file: "BaseHead.astro", reason: "Google Fonts preconnect for the brand.font stylesheet" },
  { file: "ContactForm.astro", reason: "Web3Forms submit endpoint + hCaptcha script host" },
  { file: "ServiceAreaMap.astro", reason: "Google Maps embed URL (lazy-loaded)" },
];

const COLOR_FUNCTION = /\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\s*\(/;

/**
 * Hex color literal. Fragment anchors like `#contact` don't match because
 * their letters aren't all hex digits; the lookahead stops partial matches
 * inside longer identifiers.
 */
const HEX_COLOR = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z-])/;

const PALETTE_NAMES =
  "white|black|slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const PALETTE_CLASS = new RegExp(
  `(?<![\\w-])(?:bg|text|border|from|to|via|ring|fill|stroke|decoration|divide|outline|accent|caret|shadow)-(?:${PALETTE_NAMES})(?:-\\d{2,3})?(?:/\\d{1,3})?(?![\\w-])`,
);

/** Tailwind arbitrary values carrying a color or url; structural ones pass. */
const ARBITRARY_COLOR_OR_URL =
  /\[[^\]]*(?:#[0-9a-fA-F]|rgba?\(|hsla?\(|oklch\(|oklab\(|url\()[^\]]*\]/;

const CLIENT_DIRECTIVE = /\bclient:(?:load|idle|visible|media|only)\b/;

const IMPORT_STATEMENT = /^\s*(?:import|export)\s+(?:type\s+)?(?:[\w${}*,\s]+\s+from\s+)?["']([^"']+)["']/;

function importAllowed(specifier: string): boolean {
  return (
    specifier.startsWith(".") ||
    specifier === "@hirobius/schema" ||
    specifier === "astro" ||
    specifier.startsWith("astro:")
  );
}

/**
 * Blank out comments (HTML, JS block, JS line) so attribution headers can
 * mention source URLs and original colors without tripping the rules.
 * Newlines are preserved so violation line numbers stay accurate.
 */
function stripComments(source: string): string {
  const blank = (match: string) => match.replace(/[^\n]/g, " ");
  return source
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|\s)\/\/[^\n]*/g, (match, lead: string) => lead + blank(match.slice(lead.length)));
}

/**
 * Check one `.astro` component source for purity violations. Returns an empty
 * array for a clean component.
 */
export function checkComponentPurity(
  source: string,
  options: PurityOptions = {},
): PurityViolation[] {
  const violations: PurityViolation[] = [];
  const lines = stripComments(source).split("\n");

  lines.forEach((text, index) => {
    const line = index + 1;
    const excerpt = text.trim().slice(0, 120);
    const add = (rule: PurityViolation["rule"]) => violations.push({ rule, line, excerpt });

    if (HEX_COLOR.test(text) || COLOR_FUNCTION.test(text)) add("literal-color");
    if (PALETTE_CLASS.test(text)) add("palette-class");
    if (ARBITRARY_COLOR_OR_URL.test(text)) add("arbitrary-value");
    if (!options.allowScripts && (/<script\b/i.test(text) || CLIENT_DIRECTIVE.test(text))) {
      add("script");
    }
    if (!options.allowExternalUrls && /https?:\/\//.test(text)) add("external-url");
    if (/@font-face\b/.test(text)) add("font-face");
    if (/@import\b/.test(text)) add("css-import");

    const specifier = IMPORT_STATEMENT.exec(text)?.[1];
    if (specifier !== undefined && !importAllowed(specifier)) add("import");
  });

  return violations;
}
