#!/usr/bin/env tsx
/**
 * eject-client — flatten one client app + the workspace packages it depends on
 * into a standalone, handoff-ready repo folder.
 *
 *   pnpm eject-client <slug> [--out <dir>]
 *
 * Why this exists: client apps use `workspace:*` deps on @hirobius/template and
 * @hirobius/schema, so they are NOT standalone. "The client owns their site" is
 * only true after ejecting — this script inlines those packages, rewrites the
 * imports to relative paths, pins real dependency versions, and drops the
 * monorepo/Turborepo wiring. The result is a folder you can `git init` and hand
 * over. (See README → "Handoff".)
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { resolve, dirname, relative, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv: string[]) {
  const positionals: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg.startsWith("--")) flags[arg.slice(2)] = argv[++i] ?? "";
    else positionals.push(arg);
  }
  return { positionals, flags };
}

function die(msg: string): never {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

const { positionals, flags } = parseArgs(process.argv.slice(2));
const slug = positionals[0];
if (!slug) die("Usage: pnpm eject-client <slug> [--out <dir>]");

const appDir = resolve(ROOT, "apps", slug);
if (!existsSync(appDir)) die(`apps/${slug} does not exist.`);

const outDir = resolve(ROOT, flags.out ?? join("ejected", slug));
if (existsSync(outDir)) {
  rmSync(outDir, { recursive: true, force: true });
}
mkdirSync(outDir, { recursive: true });

const SKIP = /(?:^|[/\\])(?:node_modules|dist|\.astro|\.turbo)(?:[/\\]|$)/;

// 1) Copy the app itself.
cpSync(appDir, outDir, { recursive: true, filter: (from) => !SKIP.test(from) });

// 2) Inline the workspace packages into src/_vendor/{template,schema}.
const vendorDir = resolve(outDir, "src/_vendor");
cpSync(resolve(ROOT, "packages/template/src"), resolve(vendorDir, "template"), {
  recursive: true,
  filter: (from) => !SKIP.test(from),
});
cpSync(resolve(ROOT, "packages/schema/src"), resolve(vendorDir, "schema"), {
  recursive: true,
  filter: (from) => !SKIP.test(from),
});

// 3) Rewrite imports across every source file. Each `@hirobius/*` specifier is
//    replaced with a path relative to the file doing the import.
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function relSpecifier(fromFile: string, toFile: string): string {
  let rel = relative(dirname(fromFile), toFile).replace(/\\/g, "/");
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel;
}

const templateDir = resolve(vendorDir, "template");
const schemaDir = resolve(vendorDir, "schema");

const sourceFiles = walk(outDir).filter((f) => /\.(astro|ts|mjs|css)$/.test(f));

for (const file of sourceFiles) {
  let code = readFileSync(file, "utf8");
  const before = code;

  const tpl = (sub: string) => relSpecifier(file, join(templateDir, sub));
  const sch = (sub: string) => relSpecifier(file, join(schemaDir, sub));

  // Order matters: subpath specifiers before the bare package name.
  code = code
    .replace(/@hirobius\/template\/components\//g, `${tpl("components")}/`)
    .replace(/@hirobius\/template\/lib\//g, `${tpl("lib")}/`)
    .replace(/@hirobius\/template\/styles\//g, `${tpl("styles")}/`)
    .replace(/@hirobius\/template\b/g, tpl("index.ts"))
    .replace(/@hirobius\/schema\/presets/g, sch("presets.ts"))
    .replace(/@hirobius\/schema\b/g, sch("index.ts"));

  if (code !== before) writeFileSync(file, code);
}

// 4) Fix the Tailwind @source in global.css — the template now lives in-tree.
const globalCss = resolve(outDir, "src/styles/global.css");
if (existsSync(globalCss)) {
  let css = readFileSync(globalCss, "utf8");
  css = css
    .replace(/@source\s+"\.\.\/\.\.\/\.\.\/\.\.\/packages\/template\/src";?/g, '@source "../_vendor/template";')
    .replace(/@import\s+"[^"]*template\/styles\/theme\.css";?/g, '@import "../_vendor/template/styles/theme.css";');
  writeFileSync(globalCss, css);
}

// 5) Standalone package.json — no workspace deps, real pinned versions.
function readVersion(pkg: string): string {
  const candidates = [
    resolve(appDir, "node_modules", pkg, "package.json"),
    resolve(ROOT, "node_modules", pkg, "package.json"),
    resolve(ROOT, "packages/schema/node_modules", pkg, "package.json"),
    resolve(ROOT, "packages/template/node_modules", pkg, "package.json"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) {
      const v = JSON.parse(readFileSync(c, "utf8")).version;
      if (v) return `^${v}`;
    }
  }
  return "latest";
}

const runtimeDeps = ["@vercel/functions", "zod"];
const devDeps = [
  "astro",
  "@astrojs/check",
  "@astrojs/sitemap",
  "@tailwindcss/vite",
  "tailwindcss",
  "sharp",
  "typescript",
];

const ejectedPkg = {
  name: slug,
  version: "1.0.0",
  private: true,
  type: "module",
  scripts: {
    dev: "astro dev",
    build: "astro build",
    preview: "astro preview",
    check: "astro check",
  },
  dependencies: Object.fromEntries(runtimeDeps.map((d) => [d, readVersion(d)])),
  devDependencies: Object.fromEntries(devDeps.map((d) => [d, readVersion(d)])),
};
writeFileSync(resolve(outDir, "package.json"), JSON.stringify(ejectedPkg, null, 2) + "\n");

// 6) Standalone tsconfig (no repo base to extend).
writeFileSync(
  resolve(outDir, "tsconfig.json"),
  JSON.stringify(
    {
      extends: "astro/tsconfigs/strict",
      include: [".astro/types.d.ts", "**/*.ts", "**/*.astro"],
      exclude: ["dist"],
    },
    null,
    2,
  ) + "\n",
);

// 7) .gitignore + handoff README for the new owner.
writeFileSync(
  resolve(outDir, ".gitignore"),
  ["node_modules/", "dist/", ".astro/", ".vercel/", ".env", ".env.*", ".DS_Store", ""].join("\n"),
);

writeFileSync(
  resolve(outDir, "README.md"),
  `# ${slug}

Standalone marketing site (ejected from the hirobius-clients template).
This repo is fully self-contained — no workspace or external template dependency.

## Develop

\`\`\`bash
pnpm install   # or npm install
pnpm dev
pnpm build     # static output in dist/
\`\`\`

## Edit content

All site content lives in \`client.config.ts\`. Replace photos in
\`src/assets/photos\` (optimizable) and \`public\` (verbatim: og image, favicon).

## Vendored code

\`src/_vendor/template\` and \`src/_vendor/schema\` were inlined at eject time. They
are now yours to modify; there is no upstream link back to the template fleet.

## Deploy (Vercel)

Static Astro. \`vercel deploy --prod\`. The preview gate lives in \`middleware.ts\`
and reads \`PREVIEW_USER\` / \`PREVIEW_PASS\` on non-production deployments.
`,
);

console.log(`
✓ Ejected apps/${slug} -> ${relative(ROOT, outDir)}

  This folder is standalone. To hand it off:
    cd ${relative(ROOT, outDir)}
    pnpm install && pnpm build      # verify it stands on its own
    git init && git add -A && git commit -m "Initial commit"

  Then transfer the Vercel project ownership (or have the client create their own
  and deploy this repo).
`);
