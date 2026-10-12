#!/usr/bin/env tsx
/**
 * check-steering-budget — cap the always-on agent context (site-engine#229).
 *
 * Ported from hirobius/hds@511209ab527b67a1b68765f0b3122983dc8671a1
 * (scripts/check-steering-budget.mjs + scripts/lib/steering-budget.mjs, which
 * ported ops#292).
 *
 * Every file in docs/guardrails/steering-budget.json (CLAUDE.md and whatever it
 * marks read-first, here AGENTS.md, which the Ralph prompt reads first) is
 * loaded by every agent in every session before it reads a line of code. A
 * one-time trim regrows; a budget does not. The same files are the `alwaysOn`
 * list in docs/state-surfaces.json, which check-state-surfaces holds to rules,
 * read order and pointers (no derived facts); a test keeps the two lists equal.
 *
 * Fix a violation by moving history to an on-demand file, not by raising
 * maxTotalBytes. Raising the budget is a deliberate decision about what every
 * future session pays for, and belongs in a PR that says so.
 *
 * Usage:
 *   tsx scripts/check-steering-budget.ts          # report
 *   tsx scripts/check-steering-budget.ts --json   # { violations }
 *   FIXTURE_DIR=<dir> ...                         # a synthetic mini-root
 *
 * Exit codes: 0 within budget, 1 over budget / missing file, 2 invocation error.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface BudgetViolation {
  id: string;
  detail: string;
}

/** Human-readable byte count. */
export function fmt(n: number): string {
  return n >= 1024 ? `${(n / 1024).toFixed(1)}KB` : `${n}B`;
}

/**
 * Compare measured always-on context against the budget. `sizes` maps each
 * manifest path to its byte count, or null when the file is missing.
 */
export function evaluateBudget({
  maxTotalBytes,
  sizes,
}: {
  maxTotalBytes: number;
  sizes: Record<string, number | null>;
}): { total: number; over: number; violations: BudgetViolation[] } {
  const violations: BudgetViolation[] = [];
  let total = 0;

  for (const [file, size] of Object.entries(sizes)) {
    if (size === null || size === undefined) {
      violations.push({
        id: `missing-${file}`,
        detail: `${file} is listed in the steering budget but does not exist; remove it from the manifest or restore the file`,
      });
      continue;
    }
    total += size;
  }

  const over = total - maxTotalBytes;
  if (over > 0) {
    const worst = Object.entries(sizes)
      .filter((entry): entry is [string, number] => typeof entry[1] === "number")
      .sort((a, b) => b[1] - a[1])[0];
    violations.push({
      id: "steering-budget-exceeded",
      detail:
        `always-on agent context is ${fmt(total)} against a ${fmt(maxTotalBytes)} budget ` +
        `(${fmt(over)} over). Largest contributor: ${worst?.[0]} at ${fmt(worst?.[1] ?? 0)}. ` +
        `Move history to an on-demand file rather than raising the budget.`,
    });
  }

  return { total, over: Math.max(0, over), violations };
}

function main() {
  const root = process.env.FIXTURE_DIR
    ? resolve(process.env.FIXTURE_DIR)
    : resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const manifestPath = resolve(root, "docs", "guardrails", "steering-budget.json");
  const jsonMode = process.argv.includes("--json");

  const fail = (message: string): never => {
    if (jsonMode) {
      console.log(JSON.stringify({ violations: [{ id: "gate-error", detail: message }] }, null, 2));
      process.exit(1);
    }
    console.error(`check-steering-budget: ${message}`);
    process.exit(2);
  };

  if (!existsSync(manifestPath)) {
    fail(`no manifest at ${manifestPath}; create it listing the always-on files and maxTotalBytes.`);
  }
  let manifest: { files?: unknown; maxTotalBytes?: unknown } = {};
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (err) {
    fail(`manifest is not valid JSON: ${(err as Error).message}`);
  }
  const files = Array.isArray(manifest.files) ? (manifest.files as string[]) : [];
  const maxTotalBytes = Number(manifest.maxTotalBytes);
  if (!files.length) fail('manifest lists no files under "files".');
  if (!Number.isFinite(maxTotalBytes) || maxTotalBytes <= 0) {
    fail('manifest needs a positive numeric "maxTotalBytes".');
  }

  const sizes: Record<string, number | null> = {};
  for (const rel of files) {
    const abs = resolve(root, rel);
    sizes[rel] = existsSync(abs) ? statSync(abs).size : null;
  }
  const { total, violations } = evaluateBudget({ maxTotalBytes, sizes });

  if (jsonMode) {
    console.log(JSON.stringify({ violations }, null, 2));
    process.exit(violations.length ? 1 : 0);
  }
  for (const [rel, size] of Object.entries(sizes)) {
    console.log(`  ${size === null ? "  missing" : fmt(size).padStart(8)}  ${rel}`);
  }
  console.log(`  ${"-".repeat(8)}`);
  console.log(`  ${fmt(total).padStart(8)}  total (budget ${fmt(maxTotalBytes)})`);

  if (!violations.length) {
    console.log("\n✓ check-steering-budget: always-on context within budget.");
    process.exit(0);
  }
  console.error("");
  for (const v of violations) console.error(`✗ ${v.detail}`);
  process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
