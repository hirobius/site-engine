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
import { fileURLToPath, pathToFileURL } from "node:url";

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

/**
 * Resolves the installed version of `pkg` from the first candidate
 * `package.json` that exists. Throws rather than falling back to "latest" —
 * an un-pinned ejected dependency is a silent handoff-time landmine (issue
 * #109), so a workspace that hasn't been `pnpm install`-ed must fail loudly
 * here instead of shipping a client repo with a moving-target version range.
 */
export function readVersion(
  pkg: string,
  candidates: string[],
  io: { existsSync: typeof existsSync; readFileSync: typeof readFileSync } = { existsSync, readFileSync },
): string {
  for (const c of candidates) {
    if (io.existsSync(c)) {
      const v = JSON.parse(io.readFileSync(c, "utf8")).version;
      if (v) return `^${v}`;
    }
  }
  throw new Error(
    `Could not resolve an installed version for "${pkg}" in any workspace node_modules. ` +
      "Run `pnpm install` at the repo root before ejecting.",
  );
}

/** Minimal CI for a handed-off repo: install, build (Zod gate), acceptance test. */
export function buildCiWorkflow(): string {
  return `name: CI

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ci-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # pnpm version comes from "packageManager" in package.json
      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      # astro build imports client.config.ts, which runs defineClient(). An
      # invalid config throws there, so a bad post-handoff edit fails here.
      - name: Build (fails on invalid Zod config)
        run: pnpm build

      # tests/acceptance.test.ts (checkClientAcceptance) is the placeholder
      # guard — it used to only run inside the monorepo gate, which evaporates
      # at handoff. This is what keeps it armed.
      - name: Test (acceptance)
        run: pnpm test
`;
}

function isMain(): boolean {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(resolve(entry)).href;
}

function runEject() {
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
  // Vendored-package tests assert monorepo-fleet-wide invariants (every app under
  // apps/, an ops snapshot file, etc.) — they don't apply, and don't even resolve
  // their paths, once the package is inlined into a single standalone repo
  // (issue #109: this is exactly the "does the vendoring survive ejection" risk).
  const SKIP_VENDOR = /(?:^|[/\\])(?:node_modules|dist|\.astro|\.turbo)(?:[/\\]|$)|\.test\.ts$/;

  // 1) Copy the app itself.
  cpSync(appDir, outDir, { recursive: true, filter: (from) => !SKIP.test(from) });

  // 2) Inline the workspace packages into src/_vendor/{template,schema}.
  const vendorDir = resolve(outDir, "src/_vendor");
  cpSync(resolve(ROOT, "packages/template/src"), resolve(vendorDir, "template"), {
    recursive: true,
    filter: (from) => !SKIP_VENDOR.test(from),
  });
  cpSync(resolve(ROOT, "packages/schema/src"), resolve(vendorDir, "schema"), {
    recursive: true,
    filter: (from) => !SKIP_VENDOR.test(from),
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
  //    apps/_template/node_modules is a candidate because every client app is
  //    scaffolded FROM _template with the identical dependency set (new-client
  //    doesn't run `pnpm install` for the fresh app) — it's the reliable source
  //    for a version pin even before the new app has its own node_modules.
  function versionCandidates(pkg: string): string[] {
    return [
      resolve(appDir, "node_modules", pkg, "package.json"),
      resolve(ROOT, "apps/_template/node_modules", pkg, "package.json"),
      resolve(ROOT, "node_modules", pkg, "package.json"),
      resolve(ROOT, "packages/schema/node_modules", pkg, "package.json"),
      resolve(ROOT, "packages/template/node_modules", pkg, "package.json"),
    ];
  }
  const pinVersion = (pkg: string) => {
    try {
      return readVersion(pkg, versionCandidates(pkg));
    } catch (err) {
      die((err as Error).message);
    }
  };

  const runtimeDeps = ["@vercel/functions", "zod"];
  const devDeps = [
    "astro",
    "@astrojs/check",
    "@astrojs/sitemap",
    "@tailwindcss/vite",
    "tailwindcss",
    "sharp",
    "typescript",
    "vitest",
  ];

  const rootPkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));

  const ejectedPkg = {
    name: slug,
    version: "1.0.0",
    private: true,
    type: "module",
    packageManager: rootPkg.packageManager,
    scripts: {
      dev: "astro dev",
      build: "astro build",
      preview: "astro preview",
      check: "astro check",
      test: "vitest run",
    },
    dependencies: Object.fromEntries(runtimeDeps.map((d) => [d, pinVersion(d)])),
    devDependencies: Object.fromEntries(devDeps.map((d) => [d, pinVersion(d)])),
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

  // 7) Minimal CI — the monorepo's gate evaporates at handoff, so this is what
  //    keeps the build/acceptance gate armed post-ejection (issue #109).
  mkdirSync(resolve(outDir, ".github/workflows"), { recursive: true });
  writeFileSync(resolve(outDir, ".github/workflows/ci.yml"), buildCiWorkflow());

  // 8) .gitignore + handoff README for the new owner.
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

## CI

\`.github/workflows/ci.yml\` runs on every push and PR: install, build (fails on
an invalid \`client.config.ts\` — the same Zod gate the monorepo had), and the
acceptance test suite. Green build = safe to deploy.

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
}

if (isMain()) {
  runEject();
}
