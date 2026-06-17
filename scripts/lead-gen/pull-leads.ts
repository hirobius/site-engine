#!/usr/bin/env tsx
/**
 * pull-leads — source qualified exterior-cleaning leads across the PNW.
 *
 *   GOOGLE_PLACES_API_KEY=... pnpm pull-leads [--dry-run] [--max-per-query 60]
 *                                             [--limit N] [--no-qualify] [--out dir]
 *
 * Flow: build (metro × keyword) queries -> Places text search -> dedupe by
 * place id -> tech-detect each site -> write qualified leads to CSV + JSON.
 *
 * --dry-run prints the query plan, expected volume, and cost estimate WITHOUT
 * calling any API (no key needed) — use it to size the pipeline first.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildQueries, KEYWORDS, METROS, QUALIFYING_SIGNALS } from "./config.js";
import { searchText, type Place } from "./places.js";
import { inspectSite } from "./qualify.js";

const HERE = dirname(fileURLToPath(import.meta.url));

// Places API (New) Text Search pricing, ~USD per request (verify current rate).
const COST_PER_REQUEST = 0.032;

function parseArgs(argv: string[]) {
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = true;
    }
  }
  return flags;
}

interface Lead {
  place_id: string;
  name: string;
  primary_type: string;
  phone: string;
  address: string;
  website: string;
  rating: string;
  review_count: string;
  lat: string;
  lng: string;
  region: string;
  has_website: boolean;
  qualified: boolean;
  reason: string;
}

function toLead(p: Place, region: string): Omit<Lead, "qualified" | "reason"> {
  return {
    place_id: p.id,
    name: p.displayName?.text ?? "",
    primary_type: p.primaryType ?? "",
    phone: p.nationalPhoneNumber ?? "",
    address: p.formattedAddress ?? "",
    website: p.websiteUri ?? "",
    rating: p.rating?.toString() ?? "",
    review_count: p.userRatingCount?.toString() ?? "",
    lat: p.location?.latitude?.toString() ?? "",
    lng: p.location?.longitude?.toString() ?? "",
    region,
    has_website: Boolean(p.websiteUri),
  };
}

function csvCell(v: string | boolean): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(leads: Lead[]): string {
  const cols: (keyof Lead)[] = [
    "place_id", "name", "primary_type", "phone", "address", "website",
    "rating", "review_count", "lat", "lng", "region", "has_website",
    "qualified", "reason",
  ];
  const head = cols.join(",");
  const rows = leads.map((l) => cols.map((c) => csvCell(l[c])).join(","));
  return [head, ...rows].join("\n");
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const queries = buildQueries();
  // Default to a single page (20). Coverage comes from gridding 37 sub-areas ×
  // keywords, not from deep paging. (Pass --max-per-query 60 to opt into paging;
  // the nextPageToken path can stall behind some egress proxies, so the request
  // has a 20s timeout in places.ts.)
  const maxPerQuery = Number(flags["max-per-query"] ?? 20);
  const outDir = resolve(String(flags.out ?? resolve(HERE, "out")));

  const areaCount = METROS.reduce((n, m) => n + m.areas.length, 0);
  // Each query is up to 3 page requests (60 results / 20 per page).
  const estRequests = queries.length * Math.ceil(maxPerQuery / 20);

  console.log(`\nLead puller — exterior cleaning · PNW`);
  console.log(`  metros:   ${METROS.length}  (${areaCount} areas incl. suburbs)`);
  console.log(`  keywords: ${KEYWORDS.length}`);
  console.log(`  queries:  ${queries.length}  (metro-area × keyword)`);
  console.log(`  est. API requests: ~${estRequests}  (≈ $${(estRequests * COST_PER_REQUEST).toFixed(2)})`);
  console.log(`  theoretical max raw results: ~${(queries.length * maxPerQuery).toLocaleString()} (heavy overlap → dedupes down a lot)`);

  if (flags["dry-run"]) {
    console.log(`\n[dry-run] No API calls made. Set GOOGLE_PLACES_API_KEY and drop --dry-run to pull for real.\n`);
    return;
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error(`\n✖ GOOGLE_PLACES_API_KEY is not set. (Enable "Places API (New)" in Google Cloud.)\n`);
    process.exit(1);
  }

  const limit = flags.limit ? Number(flags.limit) : Infinity;
  const byId = new Map<string, Omit<Lead, "qualified" | "reason">>();

  // 1) Source + dedupe.
  let done = 0;
  for (const q of queries) {
    if (byId.size >= limit) break;
    try {
      const places = await searchText(apiKey, q.textQuery, maxPerQuery);
      for (const p of places) if (!byId.has(p.id)) byId.set(p.id, toLead(p, q.region));
    } catch (err) {
      console.error(`  ! query failed (${q.textQuery}): ${(err as Error).message}`);
    }
    done++;
    if (done % 10 === 0) console.log(`  …${done}/${queries.length} queries · ${byId.size} unique so far`);
  }

  // 2) Qualify (tech-detect each site; no-website = auto-qualified).
  const skipQualify = Boolean(flags["no-qualify"]);
  const leads: Lead[] = [];
  for (const base of byId.values()) {
    let qualified: boolean;
    let reason: string;
    if (!base.has_website) {
      qualified = true;
      reason = "no_website";
    } else if (skipQualify) {
      qualified = false;
      reason = "has_website (qualify skipped)";
    } else {
      const { signals } = await inspectSite(base.website);
      const hits = signals.filter((s) => QUALIFYING_SIGNALS.includes(s));
      qualified = hits.length > 0;
      reason = hits.join("|") || "site_ok";
    }
    leads.push({ ...base, qualified, reason });
  }

  // 3) Write output (qualified first).
  leads.sort((a, b) => Number(b.qualified) - Number(a.qualified));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, "leads.csv"), toCsv(leads));
  writeFileSync(resolve(outDir, "leads.json"), JSON.stringify(leads, null, 2));

  const qualifiedCount = leads.filter((l) => l.qualified).length;
  console.log(`\n✓ ${leads.length} unique businesses · ${qualifiedCount} qualified (${Math.round((qualifiedCount / Math.max(leads.length, 1)) * 100)}%)`);
  console.log(`  → ${resolve(outDir, "leads.csv")}`);
  console.log(`  → ${resolve(outDir, "leads.json")}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
