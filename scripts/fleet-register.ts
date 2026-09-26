/**
 * fleet-register — appends a launched/scaffolded client to the `_gallery`
 * fleet list (issue #12).
 *
 * A template version bump is a fleet event, not a routine commit: every site
 * should record which `@hirobius/template` version it shipped on. This is a
 * pure string-transform helper (reads the current fleet.ts source, returns
 * the new source) so `new-client.ts` can call it without any FS/network
 * coupling, and it's trivially unit-testable.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export interface FleetEntryInput {
  slug: string;
  name: string;
  /** Preset id — recorded as the FleetSite `trade`. */
  trade: string;
  url: string;
  status?: "live" | "preview" | "handed-off";
  templateVersion: string;
}

/** Reads the current `@hirobius/template` version from its package.json. */
export function readTemplateVersion(): string {
  const pkgPath = resolve(ROOT, "packages/template/package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
  if (!pkg.version) throw new Error(`packages/template/package.json has no "version" field.`);
  return pkg.version;
}

const FLEET_ARRAY_CLOSE = /\n(\];\s*\n)/;

/**
 * Inserts a new FleetSite entry into `fleet.ts` source, just before the
 * closing `];` of the `FLEET` array. Returns the source unchanged (with the
 * `inserted: false` flag) if `slug` is already present — new-client re-runs
 * and template re-scaffolds must stay idempotent.
 */
export function insertFleetEntry(
  fleetSource: string,
  entry: FleetEntryInput,
): { source: string; inserted: boolean } {
  const slugPattern = new RegExp(`slug:\\s*"${entry.slug}"`);
  if (slugPattern.test(fleetSource)) {
    return { source: fleetSource, inserted: false };
  }

  if (!FLEET_ARRAY_CLOSE.test(fleetSource)) {
    throw new Error("Could not find the FLEET array's closing `];` to insert before.");
  }

  const status = entry.status ?? "preview";
  const block =
    `  {\n` +
    `    slug: ${JSON.stringify(entry.slug)},\n` +
    `    name: ${JSON.stringify(entry.name)},\n` +
    `    url: ${JSON.stringify(entry.url)},\n` +
    `    trade: ${JSON.stringify(entry.trade)},\n` +
    `    templateVersion: ${JSON.stringify(entry.templateVersion)},\n` +
    `    status: ${JSON.stringify(status)},\n` +
    `  },\n`;

  const source = fleetSource.replace(FLEET_ARRAY_CLOSE, `\n${block}$1`);
  return { source, inserted: true };
}
