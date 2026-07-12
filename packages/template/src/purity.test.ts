import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  checkComponentPurity,
  EXTERNAL_URL_ALLOWLIST,
  SCRIPT_ALLOWLIST,
} from "./purity.js";

const CLEAN = `---
import type { ClientConfig } from "@hirobius/schema";
import Section from "../Section.astro";
import { telHref } from "../../lib/theme.js";

interface Props {
  config: ClientConfig;
}
const { config } = Astro.props;
---

<Section title="Hi" muted>
  <div class="rise bg-primary text-on-primary rounded-theme font-heading aspect-[8/5] from-fg/85 to-fg/40">
    <a href="#contact" class="border border-on-fg/40 hover:bg-on-fg/10">{config.copy.ctaLabel}</a>
  </div>
</Section>
`;

function violations(source: string, opts?: Parameters<typeof checkComponentPurity>[1]) {
  return checkComponentPurity(source, opts).map((v) => v.rule);
}

describe("checkComponentPurity", () => {
  it("passes a clean semantic-token component", () => {
    expect(checkComponentPurity(CLEAN)).toEqual([]);
  });

  it("flags literal hex colors", () => {
    expect(violations(`<div style="color: #1a2b3c">x</div>`)).toContain("literal-color");
    expect(violations(`<svg fill="#fff" />`)).toContain("literal-color");
  });

  it("does not flag fragment anchors or ids as hex colors", () => {
    expect(violations(`<a href="#contact" id="hero-video">x</a>`)).toEqual([]);
  });

  it("flags CSS color functions", () => {
    for (const bad of ["rgb(1,2,3)", "rgba(0,0,0,.5)", "hsl(120 50% 50%)", "oklch(0.7 0.1 200)"]) {
      expect(violations(`<div style="color: ${bad}">x</div>`)).toContain("literal-color");
    }
  });

  it("flags Tailwind palette and white/black utility classes", () => {
    for (const bad of ["bg-slate-900", "text-gray-500", "from-rose-400", "bg-white", "text-black"]) {
      expect(violations(`<div class="${bad}">x</div>`)).toContain("palette-class");
    }
  });

  it("does not flag semantic utilities that merely resemble palette classes", () => {
    expect(violations(`<div class="bg-bg text-fg bg-muted text-on-primary from-fg/85">x</div>`)).toEqual([]);
  });

  it("flags arbitrary color and url values", () => {
    for (const bad of ["bg-[#1a2b3c]", "text-[rgb(0,0,0)]", "bg-[url(/x.png)]"]) {
      expect(violations(`<div class="${bad}">x</div>`)).toContain("arbitrary-value");
    }
  });

  it("keeps structural arbitrary values legal", () => {
    expect(violations(`<div class="aspect-[8/5] grid-cols-[1fr_2fr] w-[calc(100%-2rem)]">x</div>`)).toEqual([]);
  });

  it("flags <script> and client: directives unless allowed", () => {
    expect(violations(`<script>alert(1)</script>`)).toContain("script");
    expect(violations(`<Widget client:load />`)).toContain("script");
    expect(violations(`<script is:inline>x()</script>`, { allowScripts: true })).toEqual([]);
  });

  it("flags imports outside the allowlist", () => {
    expect(violations(`---\nimport confetti from "canvas-confetti";\n---\n<div />`)).toContain(
      "import",
    );
    expect(violations(`---\nimport "some-css-lib/styles.css";\n---\n<div />`)).toContain("import");
  });

  it("allows relative, @hirobius/schema, astro, and astro:* imports", () => {
    const src = `---\nimport type { ClientConfig } from "@hirobius/schema";\nimport { Image } from "astro:assets";\nimport type { ImageMetadata } from "astro";\nimport X from "./X.astro";\nimport Y from "../lib/theme.js";\n---\n<div />`;
    expect(violations(src)).toEqual([]);
  });

  it("flags external URLs unless allowed", () => {
    expect(violations(`<img src="https://cdn.example.com/x.jpg" />`)).toContain("external-url");
    expect(violations(`<link href="https://fonts.example.com" />`)).toContain("external-url");
    expect(
      violations(`<form action="https://api.web3forms.com/submit" />`, { allowExternalUrls: true }),
    ).toEqual([]);
  });

  it("flags @font-face and @import", () => {
    expect(violations(`<style>@font-face { font-family: X; }</style>`)).toContain("font-face");
    expect(violations(`<style>@import "x.css";</style>`)).toContain("css-import");
  });

  it("ignores URLs and color words inside comments (attribution headers)", () => {
    const src = `---
// Harvested from https://github.com/example/theme (MIT), commit abc123.
/* original used #1a2b3c on bg-slate-900 */
import type { ClientConfig } from "@hirobius/schema";
---
<!-- see https://example.com/pattern -->
<div class="bg-primary">x</div>`;
    expect(violations(src)).toEqual([]);
  });

  it("reports the line number of a violation", () => {
    const result = checkComponentPurity(`<div>ok</div>\n<div style="color: #123456">x</div>`);
    expect(result[0]?.line).toBe(2);
  });
});

describe("template components sweep", () => {
  const componentsDir = fileURLToPath(new URL("./components", import.meta.url));
  const files = readdirSync(componentsDir, { recursive: true, encoding: "utf-8" })
    .filter((f) => f.endsWith(".astro"))
    .map((f) => f.replaceAll("\\", "/"));

  it("finds components to sweep", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s contains only schema-driven, semantic-token markup", (file) => {
    const source = readFileSync(join(componentsDir, file), "utf-8");
    const result = checkComponentPurity(source, {
      allowScripts: SCRIPT_ALLOWLIST.some((entry) => entry.file === file),
      allowExternalUrls: EXTERNAL_URL_ALLOWLIST.some((entry) => entry.file === file),
    });
    const report = result
      .map((v) => `  ${file}:${v.line} [${v.rule}] ${v.excerpt}`)
      .join("\n");
    expect(result, `purity violations:\n${report}`).toEqual([]);
  });

  it("keeps the allowlists free of stale entries", () => {
    for (const entry of [...SCRIPT_ALLOWLIST, ...EXTERNAL_URL_ALLOWLIST]) {
      expect(files, `allowlisted file ${entry.file} no longer exists`).toContain(entry.file);
      expect(entry.reason.length).toBeGreaterThan(10);
    }
  });
});
