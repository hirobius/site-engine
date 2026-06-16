#!/usr/bin/env tsx
/**
 * agent CLI — run the lead → site pipeline on one business.
 *
 *   ANTHROPIC_API_KEY=... pnpm agent --name "Rojo Moss Removal" --city Seattle --region WA
 *   ANTHROPIC_API_KEY=... pnpm agent --lead ./lead.json
 *
 * Prints each step as it happens, then the validated config + the eval scorecard.
 */
import { readFileSync } from "node:fs";
import { runPipeline } from "./pipeline.js";

function parseArgs(argv: string[]) {
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) flags[a.slice(2)] = argv[++i] ?? "";
  }
  return flags;
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));

  const lead = flags.lead
    ? JSON.parse(readFileSync(flags.lead, "utf8"))
    : {
        name: flags.name,
        city: flags.city,
        region: flags.region,
        category: flags.category ?? "local service business",
        phone: flags.phone,
        website: flags.website,
        notes: flags.notes,
      };

  if (!lead.name || !lead.city || !lead.region) {
    console.error("Usage: pnpm agent --name <name> --city <city> --region <ST>  (or --lead <file.json>)");
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("✖ ANTHROPIC_API_KEY is not set.");
    process.exit(1);
  }

  const result = await runPipeline(lead, {
    onStep: (step, detail) => console.error(`  • ${step}${detail ? ` — ${detail}` : ""}`),
  });

  const v = result.judge;
  console.log("\n" + "─".repeat(60));
  console.log(`✓ ${result.config.business.name} — ${result.config.seo.city}, ${result.config.seo.region}`);
  console.log(`  attempts: ${result.attempts}  regenerated: ${result.regenerated}`);
  console.log(
    `  eval: overall ${v.overall}/5  ${v.pass ? "PASS" : "FAIL"}  ` +
      `(copy ${v.scores.copyQuality}, complete ${v.scores.completeness}, seo ${v.scores.localSeo}, tone ${v.scores.toneFit})`,
  );
  console.log(`  notes: ${v.notes}`);
  console.log("─".repeat(60));
  console.log("\nHeadline:", result.config.copy.heroHeadline);
  console.log("Sub:     ", result.config.copy.heroSub);
  console.log("\nFull config (drop into apps/<slug>/client.config.ts):");
  console.log(JSON.stringify(result.config, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
