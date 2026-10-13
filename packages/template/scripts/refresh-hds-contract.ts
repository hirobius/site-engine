/**
 * Refreshes ../hds-contract.snapshot.json from the published
 * @hirobius/design-system package (ADR-0005).
 *
 * The factory keeps its own token VALUES (src/styles/tokens.css is fleet-owned
 * and versioned with @hirobius/template, so an HDS release never restyles a
 * client site) and shares the NAMES with HDS: every custom property the
 * template declares or the brand bridge writes must exist in the published
 * variables.css, and the bridge must keep HDS's BrandPalette fields and write
 * every variable HDS's bridge writes. This script records that contract from
 * the package with the parsers in src/hds-contract.ts; src/hds-contract.test.ts
 * holds the template to it with the same parsers. A red test after a refresh
 * is a real drift to decide on, never to silence.
 *
 * Usage:
 *   pnpm template:snapshot-hds                   # npm pack @hirobius/design-system@latest
 *   pnpm template:snapshot-hds -- --from <dir>   # an already unpacked tarball (its package/ dir)
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { brandPaletteFields, declaredNames, writtenNames, type HdsContractSnapshot } from "../src/hds-contract.js";

const PACKAGE = "@hirobius/design-system";
const OUT = fileURLToPath(new URL("../hds-contract.snapshot.json", import.meta.url));

const NOTE =
  "Names the published @hirobius/design-system declares (ADR-0005). The template's token VALUES " +
  "are fleet-owned; these NAMES are the contract src/hds-contract.test.ts holds them to. Regenerate " +
  "with `pnpm template:snapshot-hds`; a red test after a refresh is a real drift to decide on.";

function unpackLatest(): string {
  const dir = mkdtempSync(join(tmpdir(), "hds-contract-"));
  execFileSync("npm", ["pack", `${PACKAGE}@latest`, "--pack-destination", dir, "--silent"], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  const tgz = readdirSync(dir).find((f) => f.endsWith(".tgz"));
  if (!tgz) throw new Error(`npm pack wrote no tarball into ${dir}`);
  execFileSync("tar", ["-xzf", join(dir, tgz), "-C", dir]);
  return join(dir, "package");
}

/** Read the contract out of an unpacked package directory. Throws when a parser finds nothing: HDS moved a file, update the parser, never ship an empty list. */
export function snapshotFromPackage(pkgDir: string): HdsContractSnapshot {
  const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf-8")) as { name: string; version: string };
  if (pkg.name !== PACKAGE) throw new Error(`${pkgDir} holds ${pkg.name}, not ${PACKAGE}`);

  const snapshot: HdsContractSnapshot = {
    note: NOTE,
    package: PACKAGE,
    version: pkg.version,
    variables: declaredNames(readFileSync(join(pkgDir, "dist/variables.css"), "utf-8")),
    bridge: {
      fields: brandPaletteFields(readFileSync(join(pkgDir, "dist/types/src/brand/overlay.d.ts"), "utf-8")),
      writes: writtenNames(readFileSync(join(pkgDir, "dist/brand.js"), "utf-8")),
    },
  };

  const empty = (
    [
      ["variables", snapshot.variables],
      ["bridge.fields", snapshot.bridge.fields],
      ["bridge.writes", snapshot.bridge.writes],
    ] as const
  ).filter(([, names]) => names.length === 0);
  if (empty.length > 0) {
    throw new Error(
      `${PACKAGE}@${pkg.version} parsed to nothing for ${empty.map(([key]) => key).join(", ")}: ` +
        "HDS moved or renamed what the parser reads; fix src/hds-contract.ts rather than write an empty contract",
    );
  }
  return snapshot;
}

export function main(argv: string[] = process.argv.slice(2)): void {
  const fromFlag = argv.indexOf("--from");
  const pkgDir = fromFlag === -1 ? unpackLatest() : argv[fromFlag + 1];
  if (!pkgDir) throw new Error("--from needs the unpacked package directory");

  const snapshot = snapshotFromPackage(pkgDir);
  writeFileSync(OUT, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(
    `Wrote ${OUT} from ${PACKAGE}@${snapshot.version}: ${snapshot.variables.length} variables, ` +
      `${snapshot.bridge.fields.length} BrandPalette fields, ${snapshot.bridge.writes.length} bridge writes`,
  );
}

function isEntrypoint(): boolean {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(resolve(entry as string)).href;
}

if (isEntrypoint()) main();
